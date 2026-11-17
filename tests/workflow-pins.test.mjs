// GitHub Actions supply-chain guard: every third-party action is pinned to a
// full 40-character commit SHA with its tag in a trailing `# vX.Y.Z` comment,
// every workflow declares top-level `permissions:`, and Dependabot keeps the
// pins current. A tag or branch ref can be moved to new code without a change
// here; a commit SHA cannot.
//
// Dependency-free (no YAML parser), so it checks shape, not truth: it can't
// tell that a SHA is the commit its comment names, or tell a SHA from a tag
// named with 40 hex characters. The SHAs were resolved from each action's tags
// with `git ls-remote` when they were written, and Dependabot proposes updates.
// Block-scalar bodies (`run: |`, `script: >`) are skipped, so a script that
// mentions `uses:` or `permissions:` neither trips nor satisfies a check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const USES = /^\s*(?:-\s+)?uses:\s*["']?([^\s"'#]+)["']?\s*(#.*)?$/;
// A step written as a flow mapping: `- {uses: owner/action@v4, with: ...}`.
const FLOW_USES = /^\s*-\s*\{[^}]*?\buses:\s*["']?([^\s"'#,}]+)/;
const BLOCK_SCALAR = /^(\s*)(?:-\s+)?[^\s#][^:#]*:\s*[|>][-+0-9]*\s*(?:#.*)?$/;
const VERSION_COMMENT = /#\s*v?\d/;
const SHA1 = '11d5960a326750d5838078e36cf38b85af677262';

function yamlFiles(dir) {
	if (!existsSync(dir)) return [];
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...yamlFiles(full));
		else if (/\.ya?ml$/.test(entry.name)) out.push(full);
	}
	return out;
}

/** Lines that are YAML structure, not the body of a block scalar. */
export function structuralLines(yaml) {
	const out = [];
	let blockIndent = null;
	for (const line of yaml.replace(/\r\n/g, '\n').split('\n')) {
		const indent = line.length - line.replace(/^ +/, '').length;
		if (blockIndent !== null) {
			if (!line.trim() || indent > blockIndent) continue;
			blockIndent = null;
		}
		out.push(line);
		const m = line.match(BLOCK_SCALAR);
		if (m) blockIndent = m[1].length;
	}
	return out;
}

/** True only for `owner/repo[/path]@<40 hex>`: one `@`, and the whole version is the SHA. */
export function isFullShaPin(ref) {
	const at = ref.indexOf('@');
	if (at <= 0) return false;
	return /^[0-9a-f]{40}$/.test(ref.slice(at + 1));
}

/** Every `uses:` that is not a full-SHA pin, or a pin with no version comment. */
export function pinProblems(yaml) {
	const bad = [];
	for (const line of structuralLines(yaml)) {
		const m = line.match(USES);
		const flow = m ? null : line.match(FLOW_USES);
		if (!m && !flow) continue;
		const ref = (m || flow)[1];
		if (ref.startsWith('./') || ref.startsWith('docker://')) continue;
		if (!isFullShaPin(ref)) bad.push(ref);
		else if (m && !VERSION_COMMENT.test(m[2] || '')) bad.push(`${ref} (no '# vX.Y.Z' comment)`);
	}
	return bad;
}

/** True when `permissions:` is a top-level key, above `jobs:`, with a value. */
export function topLevelPermissions(yaml) {
	const lines = structuralLines(yaml);
	for (let i = 0; i < lines.length; i++) {
		if (/^jobs:/.test(lines[i])) return false;
		const m = lines[i].match(/^permissions:[ \t]*(.*?)[ \t]*(?:#.*)?$/);
		if (!m) continue;
		if (!['', '~', 'null'].includes(m[1])) return true; // read-all, write-all, {}, {contents: read}
		const next = lines.slice(i + 1).find((l) => l.trim() && !l.trimStart().startsWith('#')) || '';
		return /^[ \t]+\S/.test(next);
	}
	return false;
}

/** The `updates:` entry for github-actions in dependabot.yml, or undefined. */
export function githubActionsUpdate(text) {
	const entries = text.replace(/\r\n/g, '\n').split(/^\s*-\s+(?=package-ecosystem:)/m).slice(1);
	return entries.find((entry) => /^package-ecosystem:\s*["']?github-actions["']?\s*$/m.test(entry));
}

const workflowDir = path.join(root, '.github/workflows');
const workflows = yamlFiles(workflowDir);
const actionFiles = yamlFiles(path.join(root, '.github/actions'));

test('MUST FIRE: tag, short-SHA and branch refs are unpinned', () => {
	const yaml = [
		'      - uses: actions/checkout@v4',
		'      - uses: actions/setup-node@49933ea # short sha',
		'        uses: "owner/action@main"',
	].join('\n');
	assert.deepEqual(pinProblems(yaml), ['actions/checkout@v4', 'actions/setup-node@49933ea', 'owner/action@main']);
});

test('MUST FIRE: refs that only end in a SHA', () => {
	const yaml = [
		`      - uses: actions/checkout@${SHA1}@${SHA1} # v4.4.0`,
		`      - uses: actions/checkout@v1+${SHA1} # v4.4.0`,
		`      - uses: actions/checkout@${SHA1}abcdef12 # v4.4.0`,
		`      - uses: @${SHA1} # v4.4.0`,
	].join('\n');
	assert.deepEqual(pinProblems(yaml), [
		`actions/checkout@${SHA1}@${SHA1}`,
		`actions/checkout@v1+${SHA1}`,
		`actions/checkout@${SHA1}abcdef12`,
		`@${SHA1}`,
	]);
});

test('MUST FIRE: flow-mapping steps are scanned', () => {
	const yaml = [
		'      - {uses: actions/checkout@v4}',
		"      - { name: x, uses: 'owner/action@main', with: {a: 1} }",
		`      - {uses: actions/checkout@${SHA1}}`,
	].join('\n');
	assert.deepEqual(pinProblems(yaml), ['actions/checkout@v4', 'owner/action@main']);
});

test('MUST FIRE: a full-SHA pin without its version comment', () => {
	assert.deepEqual(pinProblems(`      - uses: actions/checkout@${SHA1}`), [
		`actions/checkout@${SHA1} (no '# vX.Y.Z' comment)`,
	]);
});

test('MUST NOT FIRE: a commented full-SHA pin, a local action and a docker image pass', () => {
	const yaml = [
		`      - uses: actions/checkout@${SHA1} # v4.4.0`,
		'      - uses: ./.github/actions/local',
		'      - uses: docker://alpine:3.20',
	].join('\n');
	assert.deepEqual(pinProblems(yaml), []);
});

test('MUST FIRE: a folded or literal uses: value is flagged, not skipped', () => {
	const yaml = ['      - uses: >-', '          actions/checkout@v4', "      - uses: |", '          owner/action@main'].join('\n');
	assert.deepEqual(pinProblems(yaml), ['>-', '|']);
});

test('MUST NOT FIRE: uses: inside a block scalar is not a step', () => {
	const yaml = [
		'    steps:',
		'      - run: |',
		"          cat <<'YAML'",
		'          uses: actions/checkout@v4',
		'          YAML',
		'      - name: next',
		'        script: >-',
		'          uses: owner/action@main',
		'      - uses: actions/setup-node@v4',
	].join('\n');
	assert.deepEqual(pinProblems(yaml), ['actions/setup-node@v4']);
});

test('permissions parser accepts block and inline values', () => {
	assert.equal(topLevelPermissions('on: push\npermissions:\n  contents: read\njobs:\n  a: {}\n'), true);
	assert.equal(topLevelPermissions('permissions: read-all\njobs: {}\n'), true);
	assert.equal(topLevelPermissions('permissions: {}  # no token scopes\njobs: {}\n'), true);
});

test('permissions parser rejects missing, empty and lookalike declarations', () => {
	assert.equal(topLevelPermissions('on: push\njobs:\n  a:\n    permissions:\n      contents: read\n'), false);
	assert.equal(topLevelPermissions('permissions:\njobs: {}\n'), false);
	assert.equal(topLevelPermissions('# permissions: read-all\njobs: {}\n'), false);
	assert.equal(topLevelPermissions('on: push\nenv:\n  NOTE: |\n    permissions:\n      contents: read\njobs: {}\n'), false);
});

test("Dependabot parser: another entry's schedule does not count", () => {
	const text = [
		'version: 2',
		'updates:',
		'  - package-ecosystem: github-actions',
		'    directory: "/"',
		'  - package-ecosystem: npm',
		'    directory: "/"',
		'    schedule:',
		'      interval: daily',
	].join('\n');
	assert.doesNotMatch(githubActionsUpdate(text), /interval:/);
});

test('the repository has workflows to check', () => {
	assert.ok(workflows.length > 0, `no workflows under ${workflowDir}`);
});

test('every uses: in workflows and composite actions is pinned to a full SHA with a version comment', () => {
	const bad = [];
	for (const file of [...workflows, ...actionFiles]) {
		for (const ref of pinProblems(readFileSync(file, 'utf8'))) bad.push(`${path.relative(root, file)}: ${ref}`);
	}
	assert.deepEqual(bad, []);
});

test('every workflow declares top-level permissions', () => {
	const missing = workflows.filter((file) => !topLevelPermissions(readFileSync(file, 'utf8')));
	assert.deepEqual(missing.map((file) => path.relative(root, file)), []);
});

test('Dependabot watches the github-actions ecosystem at the root, on a schedule', () => {
	const file = path.join(root, '.github/dependabot.yml');
	assert.ok(existsSync(file), '.github/dependabot.yml is missing');
	const entry = githubActionsUpdate(readFileSync(file, 'utf8'));
	assert.ok(entry, 'no github-actions entry in .github/dependabot.yml');
	assert.match(entry, /^\s*directory:\s*["']?\/["']?\s*$/m);
	// Dependabot rejects an entry without a schedule, and then keeps no pin current.
	assert.match(entry, /^\s*schedule:\s*\n\s+interval:\s*\S+/m);
});
