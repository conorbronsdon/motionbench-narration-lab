# A small generation and repair pilot

The useful result is a reproducible failure: a model can repair a landscape animation while leaving its portrait source line outside the reading area. Checking only the attractive final frame misses that regression.

The [recorded results](../results/pilot.json) cover three supplied synthetic briefs: a statistic with its qualifier and source, a staged process diagram, and original kinetic sample copy. Each has landscape and portrait layouts. Every model receives the same system prompt, brief, local GSAP allowance, default sans-serif, no tools, 10,000 output-token cap and one feedback repair. A repair receives that model's HTML and compact measured failures; the original requirements stay fixed.

| Route | Initial passing formats | After one repair | Generation and repair time | Inference cost |
|---|---|---|---|---|
| `deepseek-v4.1-flash-fast`, CoralBricks, reasoning `none` | 0/6 | 2/6: diagram wide and copy wide | 84.814 s | $0.03380124, provider-reported `usage.cost` |
| `claude-haiku-5-5`, thinking disabled, effort low | 0/6 | 1/6: diagram wide | 67.020 s | $0.0117625, estimated from actual tokens and listed rates |

No candidate passed both formats. These are strict sampled text/layout checks, not MotionBench scores. This is one sample per brief/model with no statistical comparison, and the checker conservatively fails unsupported masks and filters. It cannot rank aesthetic quality. Human preference has not been collected. A separately authored offline reference passes both formats and supplies a positive control.

The elapsed figures sum model request latency only. Local rendering, check time and human review are separate. Anthropic's estimate uses [$0.10/M input and $0.50/M output](https://platform.claude.com/docs/en/about-claude/pricing), no cache, at the time of the experiment. It is not an invoice. Earlier adaptive-Haiku calibration used the same output cap: two calls truncated and one statistic completed. Those three calibration attempts cost an estimated $0.0131542 and remain separate from the thinking-disabled comparison. They are not discarded successes or repair attempts.

One CoralBricks diagram response included prose around a fenced complete HTML document. The single document was extracted without editing its code; that formatting failure is retained in the record. No candidate received a manual animation repair.

Observed failure classes:

- A reveal starts at the cue while the brief requires the complete claim to be readable then. A code comment calling it a hold does not change the pixels.
- The number fits in portrait, but its qualifier or attribution falls into the reserved upper/lower region.
- A masked line appears intact at a glance while clipping the comma or descender ink.
- A repair clears a landscape requirement without clearing the corresponding portrait requirement.
- A paused timeline still renders differently after a backward seek. Tiny browser color-rounding differences are retained separately from significant differences.

The practical next experiment is revision robustness: change the number and lengthen the qualifier, then require both layouts to preserve the original cue, source and complete hold. Keep this separate from the published benchmark until its maintainers choose how it fits.

For a blind review, render each final candidate with `--render`, write a manifest of `{route, brief, revision, evaluation}` records, then run:

```sh
python tools/comparison.py gallery runs/comparison-manifest.json runs/blind-gallery
```

Open the resulting `index.html`. Candidate labels conceal route identities; `reveal.json` is separate. This is lightweight local blinding, not a controlled human study. Notes entered in the page are not saved automatically. Record ratings before opening the reveal file.
