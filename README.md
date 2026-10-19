# Narration Motion Lab

A runnable experiment for turning supplied narration cues into short HTML/GSAP motion graphics, then checking what the browser actually displays. It adds observable production constraints to experiments inspired by [MotionBench](https://github.com/Coral-Bricks-AI/motionbench): the correct number, its qualifier and source, cue timing, readable bounds, and a complete hold window across formats.

This is an independent prototype. It is not an official MotionBench score, a replacement for its grader, or a claim about model rankings. All animation examples use synthetic content. The checks do not establish aesthetic quality or editorial approval. See the [small generation/repair pilot](docs/pilot.md) and [demo/workshop outline](docs/demo.md).

## Run the example

Use Node 22+, an installed Chromium browser, and ffmpeg for MP4 output.

```sh
npm ci --ignore-scripts
# Only needed if Chromium is not already in the Playwright cache:
npx playwright-core install chromium
npm test
npm run example
node tools/evaluate.mjs --html examples/stat.html --brief examples/stat.json --out runs/example-video --render
```

The evaluator automatically finds Playwright Chromium on Windows, macOS, and Linux. Set `MOTION_CHROME` to an existing Chromium executable if needed. `PRODUCER_HEADLESS_SHELL_PATH` is also accepted. Set `FFMPEG` if ffmpeg is outside `PATH`. Browser and package installation require network access; evaluation runs with loopback-only browser requests. The optional render is silent video; it does not synthesize or align audio.

CI runs the browser controls on Windows. Linux requires a working Chromium sandbox; distributions restricting unprivileged user namespaces may need an administrator-provided configuration. See [Chromium's AppArmor guidance](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md). The evaluator keeps browser sandboxing enabled.

Open `runs/example/contact-sheet.png` and `report.json`. With `--render`, the output also contains `wide.mp4`, `tall.mp4`, and their source PNG sequences. Outputs stay under the supplied directory and are ignored by Git. Rendering at production resolution can produce substantial files.

Exit codes: `0` means the sampled automated checks passed; `1` means a measured failure; `2` means setup, input, or execution failed. A zero exit code still requires human visual and editorial review.

## Brief and HTML contract

See [`examples/stat.json`](examples/stat.json) and [`examples/stat.html`](examples/stat.html). A brief defines a duration, frame rate, viewports with safe rectangles, and expected text reads:

```json
{
  "id": "value",
  "selector": "[data-read=value]",
  "text": "1,284",
  "cue": 2.5,
  "toleranceFrames": 2,
  "hold": [2.5, 6.5],
  "minFontPx": 80,
  "stable": true
}
```

Each selector must match exactly one element. Whitespace is normalized; punctuation, numbers and words must match. `cue` is optional for a source or qualifier already present before the narrated number. When supplied, it checks the **first sampled fully visible exact text** against the cue. `hold` is independently enforced at every frame sample and both exact endpoints. A cue-tolerated late arrival can therefore still fail a hold that began earlier. `stable` rejects a required read whose bounds move by more than one pixel during its hold.

The HTML must:

- expose `window.seek(seconds)` that renders a complete frame directly from time, including backward and repeated seeks;
- load GSAP only from `/gsap.min.js` and keep all markup/styles/scripts in that one HTML file;
- use ordinary DOM text for required reads, with the brief's selectors;
- respond to the viewport without remote fonts, images, media, libraries, or other files;
- avoid autoplay and wall-clock driven animation. Use a paused GSAP timeline and set its time inside `seek`.

The evaluator serves exactly the input HTML and the pinned local GSAP file over a fresh loopback port. A restrictive content policy and request interceptor reject other browser requests. Each format gets a fresh browser context; service workers, downloads, popups and inherited browser profiles are excluded. Browser environment variables are restricted to OS launch essentials. API keys belong only in the calling server process, never in HTML, prompts, briefs, browser environment, or reports.

This is a constrained development runner, not a sandbox for actively malicious HTML or browser exploits. Review generated code before executing it. Keep Chromium current in environments where arbitrary authors can submit code.

## Generate, evaluate, repair

Send the same public brief, HTML contract, exact palette and asset allowance to each model. Require one standalone HTML response. Record the exact model ID, prompt hash, response hash, provider usage/cost, elapsed time, and whether the response completed. A response that exhausts its output budget without final HTML is a failed attempt.

1. Save the returned HTML under `runs/<model>/<brief>/initial.html`.
2. Run the evaluator with the unchanged brief and all required formats.
3. Give the model its own HTML, the original brief, and `report.json`, with a bounded repair allowance.
4. Save the repaired HTML separately. Rerun the **whole** original brief, including passing reads and formats. Compare every read's arrival and hold failures between runs.
5. Review the contact sheets and complete videos, ideally with model identities concealed. Record human clarity/preference separately from automated results. Leave preference unmeasured until a person actually rates it.

The evaluator contains no provider SDK or automatic credit spending. A caller can use its approved model route and budget while keeping credentials outside the generated artifact. A revision brief should retain prior approved cue/hold requirements while changing the number, qualifier length, or viewport. Passing a new requirement does not excuse a regression elsewhere.

The optional CoralBricks adapter requires an explicit execution flag and a server-side `CORALBRICKS_API_KEY`. Review its budget and output contract before running:

```sh
python tools/generate.py --brief briefs/stat.json --out runs/generated --execute
```

The offline example and evaluator do not call a model API. Keep the initial and repaired outputs separate so the original evidence remains available.

## What the checks establish

`report.json` records per-format cue arrivals, hold sample counts, timestamped failures, JavaScript errors, blocked requests, screenshot filenames and seek-determinism differences. It binds those observations to the SHA-256 of the HTML bytes and parsed brief. The runner measures text ranges, ancestor opacity/visibility, clipping rectangles, safe bounds, and transformed font size. Horizontal text uses Canvas font ink metrics to exclude empty ascender/descender space from vertical bounds; rotated text retains conservative Range bounds. Horizontal bounds remain conservative. It probes occlusion at the center of each text rectangle, and conservatively rejects filters and non-rectangular masks on checked text.

The runner samples the complete frame grid and exact hold endpoints, then compares screenshot hashes at four times after forward and reverse seeks. Exact hash differences, pixel counts and maximum channel differences remain in the report. Seek failures require at least one pixel to differ by more than two levels on a 0–255 color channel; this excludes observed Chromium rounding noise. It saves paired forward/reverse images for differences, representative frames plus the first eight failure events per format, and a contact sheet. Scene evaluations time out after ten seconds; the browser is closed after a two-minute check budget or five-minute render budget. ffmpeg has its own two-minute process timeout. These tests catch common failures; they do not prove determinism at every possible time, all occlusion, sufficient contrast, correct diagrams, good pacing, semantic preservation outside the specified reads, or audio sync. Narration cues are supplied inputs, not speech recognition or a truth check.

The adversarial tests include hidden exact text, clipped text, portrait-only overflow, an endpoint content regression, duplicate selectors, history-dependent rendering, and attempted network access. The clean reference must continue to pass while each corresponding mutation fails.

Viewport-overflow controls also inspect screenshot ink: visible root/body propagation cases must pass while ordinary body, nested and containment clipping still fail. See the pilot's [checker revalidation](docs/pilot.md) for the defect these controls exposed.

## References and license

- [MotionBench website](https://motionbench.sh/)
- [MotionBench source](https://github.com/Coral-Bricks-AI/motionbench)
- [MotionBench dataset](https://huggingface.co/datasets/coral-bricks-ai/motionbench)

Starter source is MIT licensed. GSAP, Playwright and pngjs retain their own licenses in the pinned dependencies. No MotionBench code, assets, prompts or reference animations are redistributed here.
