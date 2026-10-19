import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {validateBrief, sampleTimes, assessRead} from './contract.mjs';
import {observe} from './dom.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = data => createHash('sha256').update(data).digest('hex');
function pixelDifference(before, after) {
  const a=PNG.sync.read(before), b=PNG.sync.read(after);
  let changedPixels=0, significantPixels=0, maxChannelDelta=0;
  for(let i=0;i<a.data.length;i+=4) {
    let delta=0; for(let c=0;c<4;c++) delta=Math.max(delta,Math.abs(a.data[i+c]-b.data[i+c]));
    if(delta) changedPixels++; if(delta>2) significantPixels++; maxChannelDelta=Math.max(maxChannelDelta,delta);
  }
  return {changedPixels,significantPixels,maxChannelDelta};
}
export async function browserPath() {
  for (const candidate of [process.env.MOTION_CHROME, process.env.PRODUCER_HEADLESS_SHELL_PATH]) {
    if (candidate) { await fs.access(candidate); return candidate; }
  }
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'ms-playwright') : process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Caches/ms-playwright') : path.join(os.homedir(), '.cache/ms-playwright'));
  for (const dir of (await fs.readdir(cache).catch(() => [])).filter(s => /^chromium[-_]/.test(s)).sort().reverse()) {
    for (const relative of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium']) {
      const candidate = path.join(cache, dir, relative);
      if (await fs.access(candidate).then(() => true, () => false)) return candidate;
    }
  }
  throw Error('Chromium unavailable. Set MOTION_CHROME to an installed Chromium executable.');
}
async function sheet(images, destination) {
  if (!images.length) return;
  const width = 480, height = 290, columns = 3;
  const out = new PNG({width: columns * width, height: Math.ceil(images.length / columns) * height});
  out.data.fill(20);
  for (let i=3;i<out.data.length;i+=4) out.data[i]=255;
  for (let n = 0; n < images.length; n++) {
    const input = PNG.sync.read(await fs.readFile(images[n]));
    const scale = Math.min(width / input.width, height / input.height);
    const w = Math.floor(input.width * scale), h = Math.floor(input.height * scale);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = (Math.floor(y / scale) * input.width + Math.floor(x / scale)) * 4;
      const b = (((Math.floor(n / columns) * height) + y) * out.width + (n % columns) * width + x) * 4;
      input.data.copy(out.data, b, a, a + 4);
    }
  }
  await fs.writeFile(destination, PNG.sync.write(out));
}
export async function evaluate({html, brief, out, render = false}) {
  validateBrief(brief);
  out = path.resolve(out);
  await fs.mkdir(out, {recursive: true});
  const htmlInfo = await fs.stat(html);
  if (!htmlInfo.isFile() || htmlInfo.size > 2_000_000) throw Error('HTML exceeds 2 MB limit or is not a regular file');
  const [htmlBytes, gsap] = await Promise.all([fs.readFile(html), fs.readFile(path.join(root, 'node_modules/gsap/dist/gsap.min.js'))]);
  if (htmlBytes.length > 2_000_000) throw Error('HTML exceeds 2 MB limit');
  const server = http.createServer((req, res) => {
    const body = req.url === '/index.html' ? htmlBytes : req.url === '/gsap.min.js' ? gsap : null;
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(body ? 200 : 404, {'Content-Type': req.url === '/gsap.min.js' ? 'text/javascript' : 'text/html; charset=utf-8'}); res.end(body ?? 'Not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const allowed = new Set([`${origin}/index.html`, `${origin}/gsap.min.js`]);
  let browser;
  const report = {schemaVersion: 1, id: brief.id, htmlSha256: hash(htmlBytes), briefSha256: hash(JSON.stringify(brief)), duration: brief.duration, fps: brief.fps, seekPixelTolerance:2, formats: [], blockedRequests: [], limitations: ['DOM text checks do not establish visual quality, contrast, semantic correctness, or all occlusion.', 'Sampling checks frames plus exact hold endpoints; behavior between samples is not established.', 'Browser isolation restricts web access, not hostile browser exploits. Use trusted local generated HTML.']};
  const images = [];
  let expired = false;
  const deadline = setTimeout(() => { expired = true; void browser?.close(); }, render ? 300_000 : 120_000);
  try {
    const env = Object.fromEntries(['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'DISPLAY'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
    browser = await chromium.launch({headless: true, executablePath: await browserPath(), chromiumSandbox: true, env});
    for (const format of brief.formats) {
      const context = await browser.newContext({viewport: {width: format.width, height: format.height}, deviceScaleFactor: 1, serviceWorkers: 'block', acceptDownloads: false});
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      const evaluatePage = async (fn, arg) => {
        let timer;
        try { return await Promise.race([page.evaluate(fn, arg), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Scene evaluation exceeded 10 seconds')), 10_000); })]); }
        finally { clearTimeout(timer); }
      };
      context.on('page', popup => { if (popup !== page) void popup.close(); });
      await context.route('**/*', route => {
        const request = route.request();
        if (allowed.has(request.url()) && request.method() === 'GET') return route.continue();
        report.blockedRequests.push({format: format.id, url: request.url().slice(0, 300), method: request.method()});
        return route.abort('blockedbyclient');
      });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', message => {
        if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) report.blockedRequests.push({format: format.id, kind: 'csp', detail: message.text().slice(0, 300)});
      });
      await page.goto(`${origin}/index.html`, {waitUntil: 'load'});
      await evaluatePage(async () => { await document.fonts.ready; if (typeof window.seek !== 'function') throw Error('HTML must expose window.seek(seconds)'); });
      const seek = async t => {
        await evaluatePage(async time => { await window.seek(time); }, t);
        // Disable incidental native animation without advancing the scene clock.
        await evaluatePage(() => document.getAnimations().forEach(a => a.pause()));
      };
      const samples = new Map(brief.reads.map(r => [r.id, []]));
      for (const t of sampleTimes(brief)) {
        await seek(t);
        for (const read of await evaluatePage(observe, {reads: brief.reads, safe: format.safe})) samples.get(read.id).push({...read, t});
      }
      const reads = brief.reads.map(read => assessRead(read, samples.get(read.id), brief.fps));
      const times = [...new Set([0, brief.duration * .37, brief.duration * .67, brief.duration])];
      const hashes = new Map();
      for (const t of times) { await seek(t); hashes.set(t, await page.screenshot({type: 'png'})); }
      const nondeterministic = [], determinismImages = [], hashDifferences = [];
      for (const t of [...times].reverse()) {
        await seek(t); const actual = await page.screenshot({type:'png'}), expected = hashes.get(t);
        if (hash(actual) !== hash(expected)) {
          const difference=pixelDifference(expected,actual);
          hashDifferences.push({t,beforeSha256:hash(expected),afterSha256:hash(actual),...difference});
          if(difference.significantPixels) nondeterministic.push(t);
          const before = `${format.id}-seek-${t.toFixed(3)}-forward.png`, after = `${format.id}-seek-${t.toFixed(3)}-reverse.png`;
          await fs.writeFile(path.join(out,before), expected); await fs.writeFile(path.join(out,after), actual);
          determinismImages.push({t,before,after});
        }
      }
      const failures = reads.flatMap(r => r.failures.map(f => ({read: r.id, ...f})));
      const captureTimes = [...new Set([...failures.slice(0, 8).map(f => f.t), ...times])].sort((a, b) => a - b);
      const screenshots = [];
      for (let i = 0; i < captureTimes.length; i++) {
        await seek(captureTimes[i]);
        const name = `${format.id}-${i}-${captureTimes[i].toFixed(3)}s.png`, destination = path.join(out, name);
        await page.screenshot({path: destination}); images.push(destination); screenshots.push({t: captureTimes[i], file: name});
      }
      let video = null;
      if (render) {
        const frames = await fs.mkdtemp(path.join(out, `frames-${format.id}-`));
        for (let n = 0; n < Math.ceil(brief.duration * brief.fps); n++) { await seek(n / brief.fps); await page.screenshot({path: path.join(frames, `${String(n).padStart(6, '0')}.png`)}); }
        video = `${format.id}.mp4`;
        const result = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(brief.fps), '-i', path.join(frames, '%06d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, video)], {encoding: 'utf8', timeout: 120_000});
        if (result.status !== 0) throw Error(`ffmpeg failed: ${result.error?.message ?? result.stderr}`);
      }
      report.formats.push({id: format.id, viewport: [format.width, format.height], reads, failures, nondeterministic, hashDifferences, determinismImages, errors, screenshots, video});
      await context.close();
    }
  } finally { clearTimeout(deadline); await browser?.close(); await new Promise(resolve => server.close(resolve)); }
  if (expired) throw Error('Evaluation exceeded its whole-job time budget');
  report.pass = report.blockedRequests.length === 0 && report.formats.every(f => !f.failures.length && !f.nondeterministic.length && !f.errors.length);
  await sheet(images, path.join(out, 'contact-sheet.png'));
  await fs.writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--render') options.render = true;
      else if (['--html', '--brief', '--out'].includes(args[i]) && args[i + 1]) options[args[i].slice(2)] = args[++i];
      else throw Error(`Unknown/incomplete argument: ${args[i]}`);
    }
    if (!options.html || !options.brief || !options.out) throw Error('Usage: node tools/evaluate.mjs --html PATH --brief PATH --out DIR [--render]');
    options.brief = JSON.parse(await fs.readFile(options.brief, 'utf8'));
    const report = await evaluate(options);
    console.log(JSON.stringify({pass: report.pass, formats: report.formats.map(f => ({id: f.id, failures: f.failures.length, nondeterministic: f.nondeterministic.length})), report: path.resolve(options.out, 'report.json')}));
    process.exitCode = report.pass ? 0 : 1;
  } catch (e) { console.error(e.stack); process.exitCode = 2; }
}
