# Working on this experiment

Run `npm test` after changing checks. Every newly accepted animation case needs a complementary broken case that fails. Browser tests in `tests/browser.test.mjs` enforce the current cue, visibility, clipping, format, determinism and request controls.

Keep examples synthetic and credentials outside briefs, HTML and reports. `tools/generate.py` reads its key only from the server process; generation is a dry run unless `--execute` is supplied. `tools/evaluate.mjs` serves two allowlisted resources in a fresh browser context. This constrains development runs; it does not secure a hostile-code hosting service.

Preserve initial outputs and failed attempts. Results must name the model configuration, token and repair budgets, source hashes and limits. These are reporting rules, reviewed manually. Automated passing does not establish visual quality, factual truth, audio synchronization, human preference, or release approval.
