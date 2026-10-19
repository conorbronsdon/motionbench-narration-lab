# Demo and workshop preparation

The builder value is a short feedback loop: generate a scene, find the exact frame where its meaning breaks, repair it, and check that another format still works. The result gives a maintainer reproducible failures and gives an editor something concrete to review.

These are outlines for recording or a workshop, not completed video deliveries or a scheduled event. All example copy is synthetic. Keep human visual preference separate from automated results.

## Two short videos

**A source line that survives the edit.** Start with the actual portrait failure: the number fits while its source sits below the supplied reading area. Show the timestamped failure, then the unchanged brief and the single repair attempt. End with both formats side by side. Retain failures rather than implying the model fixed them all. The offline example demonstrates a passing control under its own brief.

**Arrival means readable.** Show an entrance that starts at 2.50 s and finishes later. Freeze the cue frame and compare it with the required full claim. Run the corresponding timing mutation and the passing reference. Explain why source, qualifier and number must share a complete reading window. A code comment is not a measurement.

## Thirty-minute workshop

| Minutes | Activity | Evidence to keep |
|---|---|---|
| 0–4 | Show the synthetic brief and distinguish checks, watchability and approval | Fixed requirements and limits |
| 4–8 | Run the offline example; confirm environment and a passing control | Report and contact sheet |
| 8–13 | Generate one brief and evaluate both formats | Model ID, prompt/HTML hashes, usage and elapsed time |
| 13–18 | Inspect the first failed cue/hold/bounds frame | Timestamp and failure image |
| 18–23 | Allow one repair; rerun the whole original brief | Initial and repaired reports, including regressions |
| 23–27 | Review the unnamed final videos | Written clarity/pacing preferences before reveal |
| 27–30 | Reveal routes and collect reproducible failure reports | Actual observations, without a model-ranking claim |

Install and test using the root README. Start with the offline control if a provider is unavailable. To run a new public brief with the optional adapter:

```sh
python tools/generate.py --brief briefs/stat.json --out runs/workshop-initial --execute
node tools/evaluate.mjs --html runs/workshop-initial/index.html --brief briefs/stat.json --out runs/workshop-check --render
python tools/comparison.py compact runs/workshop-check/report.json runs/workshop-failures.json
python tools/generate.py --brief briefs/stat.json --repair-html runs/workshop-initial/index.html --failures runs/workshop-failures.json --out runs/workshop-repair --execute
node tools/evaluate.mjs --html runs/workshop-repair/index.html --brief briefs/stat.json --out runs/workshop-recheck --render
```

Evaluation exits 1 for a measured failure; continue to inspect that report. Setup/execution failures exit 2. Never reuse a generation output directory. The key stays in the server process environment. Use an account-side spending cap; the adapter's estimate depends on the configured plan prices and is not a billing enforcement service.

## Specific feedback for CoralBricks and benchmark maintainers

1. Keep attribution and qualifier visibility as per-format obligations. The pilot's repaired landscape output could pass while portrait still failed. A revision task can change copy length and frame shape without changing the approved cue or source.
2. Define the cue as completed readable arrival. Report entrance start and first complete visibility separately so a model can target the correct event.
3. Consider a strict artifact response mode. One completed API response wrapped its HTML in prose despite the requested output format; extracting a single complete document worked, but a supported structured artifact response would simplify clients.

The companion runner and experimental task are small proposals for discussion. They do not change published MotionBench results or replace its existing harness and grader.
