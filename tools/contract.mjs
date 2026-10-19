export const normalize = text => String(text).replace(/\s+/g, ' ').trim();
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function validateBrief(b) {
  if (!b || typeof b.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(b.id)) throw Error('brief.id must be a simple identifier');
  if (!finite(b.duration) || b.duration <= 0 || b.duration > 60 || !Number.isInteger(b.fps) || b.fps < 1 || b.fps > 60) throw Error('duration must be (0,60], fps an integer [1,60]');
  if (!Array.isArray(b.formats) || !b.formats.length || b.formats.length > 4) throw Error('supply 1–4 formats');
  const formats = new Set();
  for (const f of b.formats) {
    if (!/^[a-zA-Z0-9_-]+$/.test(f.id) || formats.has(f.id)) throw Error('format IDs must be unique simple identifiers');
    formats.add(f.id);
    if (![f.width, f.height].every(n => Number.isInteger(n) && n >= 100 && n <= 4096)) throw Error('invalid viewport');
    if (!Array.isArray(f.safe) || f.safe.length !== 4 || !f.safe.every(finite) || f.safe[0] < 0 || f.safe[1] < 0 || f.safe[2] > f.width || f.safe[3] > f.height || f.safe[0] >= f.safe[2] || f.safe[1] >= f.safe[3]) throw Error('safe must be an ordered viewport rectangle');
  }
  if (!Array.isArray(b.reads) || !b.reads.length || b.reads.length > 30) throw Error('supply 1–30 expected reads');
  const ids = new Set();
  for (const r of b.reads) {
    if (!/^[a-zA-Z0-9_-]+$/.test(r.id) || ids.has(r.id)) throw Error('read IDs must be unique simple identifiers');
    ids.add(r.id);
    if (typeof r.selector !== 'string' || !r.selector || typeof r.text !== 'string' || !normalize(r.text)) throw Error('each read needs selector and nonempty text');
    if (!Array.isArray(r.hold) || r.hold.length !== 2 || !r.hold.every(finite) || r.hold[0] < 0 || r.hold[1] > b.duration || r.hold[0] >= r.hold[1]) throw Error('hold must be an ordered interval inside duration');
    if (!finite(r.minFontPx) || r.minFontPx <= 0) throw Error('minFontPx must be positive');
    if (r.cue !== undefined && (!finite(r.cue) || r.cue < 0 || r.cue > b.duration || !Number.isInteger(r.toleranceFrames ?? 0) || (r.toleranceFrames ?? 0) < 0)) throw Error('invalid cue/tolerance');
    if (r.stable !== undefined && typeof r.stable !== 'boolean') throw Error('stable must be boolean');
  }
  return b;
}
export function sampleTimes(b) {
  const times = new Set([0, b.duration]);
  for (let frame = 0; frame <= Math.ceil(b.duration * b.fps); frame++) times.add(Math.min(frame / b.fps, b.duration));
  for (const r of b.reads) r.hold.forEach(t => times.add(t));
  return [...times].sort((a, z) => a - z);
}
export function assessRead(read, samples, fps) {
  const exact = s => s.text === normalize(read.text) && s.visible && s.fits && s.font >= read.minFontPx;
  const arrival = samples.find(s => exact(s))?.t ?? null;
  const failures = [];
  if (read.cue !== undefined && (arrival === null || Math.abs(arrival - read.cue) > ((read.toleranceFrames ?? 0) / fps) + 1e-7)) failures.push({kind: 'cue', t: arrival ?? read.cue, expected: read.cue, actual: arrival});
  const hold = samples.filter(s => s.t >= read.hold[0] - 1e-8 && s.t <= read.hold[1] + 1e-8);
  let anchor;
  for (const s of hold) {
    if (!exact(s)) failures.push({kind: 'hold', t: s.t, reasons: s.reasons, text: s.text});
    if (exact(s) && read.stable) {
      anchor ??= s.box;
      if (anchor.some((n, i) => Math.abs(n - s.box[i]) > 1)) failures.push({kind: 'unstable', t: s.t});
    }
  }
  return {id: read.id, arrival, holdSamples: hold.length, failures};
}
