# A small generation and repair pilot

The useful result is a reproducible failure: a model can repair a landscape animation while leaving its portrait source line outside the reading area. Checking only the attractive final frame misses that regression.

The [recorded direct-API results](../results/pilot.json) cover three supplied synthetic briefs: a statistic with its qualifier and source, a staged process diagram, and original kinetic sample copy. Each has landscape and portrait layouts. Both direct-API models receive the same system prompt, brief, local GSAP allowance, default sans-serif, no tools, 10,000 output-token cap and one feedback repair. A repair receives that model's HTML and compact measured failures; the original requirements stay fixed.

| Route | Initial passing formats | After one repair | Generation and repair time | Inference cost |
|---|---|---|---|---|
| `deepseek-v4.1-flash-fast`, CoralBricks, reasoning `none` | 0/6 | 2/6: diagram wide and copy wide | 84.814 s | $0.03380124, provider-reported `usage.cost` |
| `claude-haiku-5-5`, thinking disabled, effort low | 0/6 | 1/6: diagram wide | 67.020 s | $0.0117625, estimated from actual tokens and listed rates |

No direct-API candidate passed both formats. These are strict sampled text/layout checks, not MotionBench scores. This is one sample per brief/model with no statistical comparison, and the checker conservatively fails unsupported masks and filters. It cannot rank aesthetic quality. Human preference has not been collected. A separately authored offline reference passes its own example brief in both formats and supplies a positive control; it uses a different safe rectangle and is not a passing entry in this comparison.

Follow-up checker validation found a false clipping result in this companion: body overflow can propagate to the viewport, so a zero-height body is not always its contents' clipping rectangle. The probe now follows that distinction and preserves genuine body, nested and containment clipping. Nine screenshot-backed browser cases cover two visible controls and seven clipping complements; the complete Node suite has 28 passing tests. This is a fix to this companion, not a reported defect in MotionBench's grader.

All twelve saved initial/repair HTML files were then re-evaluated without modifying their bytes or calling a model again. The [revalidation record](../results/revalidation.json) binds each HTML and brief to the corrected probe and new report hashes. The initial 0/12 and repaired 3/12 format totals, and every format's text-check failure count, were unchanged. Seek differences are reported separately and can vary between rechecks. Original reports and feedback remain preserved: these are post-fix checks of existing outputs, not a new generation/repair trial. Three additional hand-authored controls for the exact comparison briefs passed all six formats; they establish contract feasibility, not model success or aesthetic quality.

The elapsed figures sum model request latency only. Local rendering, check time and human review are separate. Anthropic's estimate uses [$0.10/M input and $0.50/M output](https://platform.claude.com/docs/en/about-claude/pricing), no cache, at the time of the experiment. It is not an invoice. Earlier adaptive-Haiku calibration used the same output cap: two calls truncated and one statistic completed. Those three calibration attempts cost an estimated $0.0131542 and remain separate from the thinking-disabled comparison. They are not discarded successes or repair attempts.

One CoralBricks diagram response included prose around a fenced complete HTML document. The single document was extracted without editing its code; that formatting failure is retained in the record. No candidate received a manual animation repair.

The original [system prompt](../results/comparison-system.txt) is archived with the three briefs. The optional generation adapter's prompt was tightened after the pilot to spell out that entrances finish by the cue. It is a practical follow-on, not a byte-identical replay of the historical experiment.

Observed failure classes:

- A reveal starts at the cue while the brief requires the complete claim to be readable then. A code comment calling it a hold does not change the pixels.
- The number fits in portrait, but its qualifier or attribution falls into the reserved upper/lower region.
- A masked line appears intact at a glance while clipping the comma or descender ink.
- A repair clears a landscape requirement without clearing the corresponding portrait requirement.
- A paused timeline still renders differently after a backward seek. Tiny browser color-rounding differences are retained separately from significant differences.

The practical next experiment is revision robustness: change the number and lengthen the qualifier, then require both layouts to preserve the original cue, source and complete hold. Keep this separate from the published benchmark until its maintainers choose how it fits.

## Exploratory configured Codex route

A separate [production-route record](../results/production-route.json) exercises the configured Codex CLI route with explicit model selection `gpt-6.1-sol` and reasoning effort `high`. The motion-generation production pin remains unverified, and the CLI supplies no per-response proof of the resolved model. The completed trial retained four started calls: the statistic's initial and single repair, plus timed-out diagram and kinetic-copy initials. Missing initials received no repair or retry.

| Brief | Initial automated result | After one repair | CLI process time |
|---|---|---|---|
| Statistic | 0/2 measured formats pass | 2/2 measured formats pass | 225.827 s across both calls |
| Diagram | Route timeout; no artifact measured | Unavailable: missing initial | 180.021 s |
| Kinetic sample copy | Route timeout; no artifact measured | Unavailable: missing initial | 180.027 s |

The statistic repair passed both available formats. Final artifact coverage is **2/6 planned formats**; the four unavailable diagram/copy formats have no text-check scores. The initial statistic's required number, qualifier and source retained `clip-path` values that the probe conservatively rejects. Its repair removed those masks at the 2.5-second cue, then passed all required holds in both layouts. The initial rejection measures the checker's supported CSS boundary; visual quality and human preference remain unmeasured.

This route used the same supplied public system prompt, briefs, local assets, no model tools and one repair allowance, with each repair receiving its own prior HTML and measured feedback. CLI orchestration and intrinsic context differ from direct API calls; high reasoning effort also differs from CoralBricks reasoning `none` and Haiku effort `low` with thinking disabled. The CLI requested 10,000 output tokens without an enforced supported output cap. These confounds prevent treating this follow-up as an equivalent-budget model ranking.

The four CLI subprocesses totaled **585.875 s**, including both 180-second timeouts. That boundary includes CLI startup and orchestration, while the historical table measures API request latency. Evaluation, rendering and human review are separate. Only the two completed calls returned token usage; timeout usage is unknown. This subscription route supplied no per-call USD invoice or defensible USD estimate, so its cost fields remain null. The record preserves prompt, HTML, receipt, report and evaluator hashes, plus zero observed tool-call events; diagnostic error items are recorded separately.

## Separate time-budget follow-up

The [time-budget follow-up](../results/time-budget-followup.json) selected only the diagram and kinetic-copy briefs after their earlier route timeouts. Each call received a 600-second process deadline, retaining the configured `gpt-6.1-sol` route, high effort, supplied system prompt, briefs, asset allowance, zero model tools and one feedback response. Four calls completed, producing these results:

| Brief | Initial | One feedback response |
|---|---|---|
| Diagram | 2/2 formats pass; 225.341 s | 2/2 formats pass; 89.014 s |
| Kinetic sample copy | 0/2 formats pass; 167.904 s | 2/2 formats pass; 72.046 s |

Within this two-brief cohort, initial results passed **2/4 formats** and feedback responses passed **4/4**. The diagram already passed before feedback. The initial copy retained unsupported masks on required text; its response removed those masks during the hold and passed both formats. Both final HTML files were rendered in landscape and portrait, with source, evaluation-report, render-report and video hashes retained in the record. Human preference and visual quality remain unmeasured.

These calls totaled **554.305 s** of CLI process time; all four returned token usage, while per-call USD remains unavailable. The earlier 180-second attempts remain in the [prior cohort](../results/production-route.json), with their timeouts and unknown usage intact. The statistic belongs only to that earlier cohort and is excluded from these counts. No pooled three-brief success rate is reported.

This follow-up generated new samples after selecting earlier failures. The copy initial completed in 167.904 s, below the earlier deadline, so a larger time budget alone does not establish why the earlier attempts failed or these samples completed. CLI/API context and latency boundaries, reasoning effort, the requested but unenforced output cap, unverified resolved-model identity, and the unverified motion-production pin remain the same confounds described above. These are exploratory route observations, not MotionBench scores or an equivalent-budget model ranking.

For a blind review, render each final candidate with `--render`, write a manifest of `{route, brief, revision, evaluation}` records, then run:

```sh
python tools/comparison.py gallery runs/comparison-manifest.json runs/blind-gallery
```

Open the resulting `index.html`. Candidate labels conceal route identities; `reveal.json` is separate. This is lightweight local blinding, not a controlled human study. Notes entered in the page are not saved automatically. Record ratings before opening the reveal file.
