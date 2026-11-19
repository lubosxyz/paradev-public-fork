"""patches/quick_automations_209.py on the stock desktop 2.0.9 bundle through patches/quick-ui-patch.py.

Needs the stock 2.0.9 app.asar: $SUPERSET_209_STOCK_ASAR, else the scratch copy below; skipped without one.
Every run works on clonefile copies in a temporary directory, never on the installed app.
"""

import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout

ROOT = Path(__file__).resolve().parent.parent
SCRATCH_STOCK = Path(
    "/private/tmp/claude-501/-Users-lubosxyz--paradev-worktrees-paradev-private-fork-aplikuj-patchn-posledni-verzi-22a5ac89"
    "/9ebb1243-92ab-4248-9286-fc9e7d420de2/scratchpad/asar/stock-2.0.9.asar"
)
STOCK = Path(os.environ.get("SUPERSET_209_STOCK_ASAR") or SCRATCH_STOCK)
RELEASE = "2.0.9"
MINE = ("automations-header", "automations-view")
# Stock + the two automations families only (every other family skipped).
AUTOMATIONS_ONLY_SHA256 = "598af98b5c2bc7624c991ff6982b3f60f597d87bc330ad51cddb85293bbc73d4"
HEADER_ONLY_SHA256_PREFIX = "cfe0501ef630"
# The same runs before quick-ui-patch.py's per-file trailer (1888a2fd84): stripping the trailer and re-padding must
# give these bytes back, so the trailer is the only change of the pinned outputs.
AUTOMATIONS_ONLY_PRE_TRAILER_SHA256 = "76899792349188f2f4eefbb9139df0616c26f445de9c15a2ce07da12a3e39088"
HEADER_ONLY_PRE_TRAILER_SHA256_PREFIX = "71bd02485faa"


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


A = load("quick_automations_209", ROOT / "patches" / "quick_automations_209.py")
Q = load("quick_ui_patch_automations", ROOT / "patches" / "quick-ui-patch.py")
if not set(MINE) <= set(Q.families(RELEASE)):  # an engine without override files: wire the families in
    Q.EDITS[RELEASE] = Q.EDITS[RELEASE] + A.FAMILIES
    getattr(Q, "REQUIRES", {}).update(A.REQUIRES)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def without_trailer(data: bytes) -> bytes:
    """`data` with quick-ui-patch.py's per-file trailer removed and each file re-padded with spaces."""
    out = bytearray(data)
    for _path, off, size in Q.asar_files(data):
        body = bytes(out[off:off + size]).rstrip(b" ")
        if body.endswith(Q.TRAILER):
            body = body[:-len(Q.TRAILER)]
            out[off:off + size] = body + b" " * (size - len(body))
    return bytes(out)


def others():
    return [name for name in Q.families(RELEASE) if name not in MINE]


def run_cli(*argv):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        try:
            code = Q.main(list(argv))
        except SystemExit as exc:
            code = exc.code if isinstance(exc.code, int) else 1
            err.write(str(exc.code))
    return code, out.getvalue(), err.getvalue()


def chunks(data: bytes) -> dict:
    """The automations page, FeatureHeader and detail chunks, found by the family markers."""
    out = {}
    for path, off, size in Q.asar_files(data):
        body = data[off:off + size]
        for key, marker in (("page", A.PAGE), ("featureHeader", A.FEATURE_HEADER), ("detail", A.DETAIL)):
            if marker in body:
                assert key not in out, f"{key}: marker in two files"
                out[key] = (path, body)
    return out


@unittest.skipUnless(STOCK.is_file(), f"stock 2.0.9 asar missing: {STOCK}")
class QuickAutomations209Test(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.asar = self.dir / "app.asar"
        subprocess.run(["cp", "-c", str(STOCK), str(self.asar)], check=True)

    def tearDown(self):
        self.tmp.cleanup()

    def patch(self, skip=()):
        args = ["--asar", str(self.asar), "--release", RELEASE, "--backup-dir", str(self.dir)]
        for name in skip:
            args += ["--skip", name]
        return run_cli(*args)

    def assert_applied(self, skip=()):
        code, out, err = self.patch(skip)
        self.assertEqual(code, 0, out + err)
        return out

    def assert_noop(self, skip=()):
        before = sha(self.asar.read_bytes())
        code, out, err = self.patch(skip)
        self.assertEqual(code, 0, out + err)
        self.assertIn("nothing to do", out)
        self.assertEqual(sha(self.asar.read_bytes()), before)

    def test_from_stock_rerun_is_a_noop(self):
        out = self.assert_applied(others())
        self.assertIn("automations-header: apply", out)
        self.assertIn("automations-view: apply", out)
        data = self.asar.read_bytes()
        self.assertEqual(len(data), STOCK.stat().st_size)
        self.assertEqual(sha(data), AUTOMATIONS_ONLY_SHA256)
        self.assertEqual(sha(without_trailer(data)), AUTOMATIONS_ONLY_PRE_TRAILER_SHA256)  # only the trailer changed
        self.assert_noop(others())
        self.assert_noop(others() + ["automations-view"])  # the header alone accepts the view's shape

    def test_all_families_no_anchor_collision(self):
        out = self.assert_applied()
        for name in Q.families(RELEASE):
            self.assertIn(f"{name}: apply", out)
        self.assert_noop()

    def test_header_then_view_matches_direct(self):
        self.assert_applied(others() + ["automations-view"])
        self.assertTrue(sha(self.asar.read_bytes()).startswith(HEADER_ONLY_SHA256_PREFIX))
        self.assertTrue(sha(without_trailer(self.asar.read_bytes())).startswith(HEADER_ONLY_PRE_TRAILER_SHA256_PREFIX))
        self.assert_noop(others() + ["automations-view"])
        self.assert_applied(others())
        self.assertEqual(sha(self.asar.read_bytes()), AUTOMATIONS_ONLY_SHA256)

    def test_view_needs_the_header(self):
        code, out, err = self.patch(others() + ["automations-header"])
        self.assertEqual(code, 0, out + err)
        self.assertIn("automations-view: skipped (needs automations-header)", out)
        self.assertEqual(sha(self.asar.read_bytes()), sha(STOCK.read_bytes()))
        # Without REQUIRES the view still fails closed: its anchors are the header's output.
        data = STOCK.read_bytes()
        parts = dict(A.FAMILIES)["automations-view"]
        _staged, _already, errors = Q._apply_family("automations-view", parts, Q.asar_files(data), data, {})
        self.assertTrue(any("ordered groups, first group" in e for e in errors), errors)

    def test_markers_survive_and_files_parse(self):
        self.assert_applied()
        stock, patched = chunks(STOCK.read_bytes()), chunks(self.asar.read_bytes())
        self.assertEqual(set(patched), {"page", "featureHeader", "detail"})
        for key, (path, body) in patched.items():
            self.assertEqual(path, stock[key][0])
            self.assertNotEqual(body, stock[key][1])
            with tempfile.NamedTemporaryFile(suffix=".mjs", dir=self.dir, delete=False) as fh:
                fh.write(body)
            result = subprocess.run(["node", "--check", fh.name], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, f"{path}: {result.stderr}")
        page = patched["page"][1]
        # Memo note of the module docstring: the header row lives in the block that
        # an unmemoized handleScopeChange (and `visible`) invalidates every render.
        self.assertIn(b"const handleScopeChange = (value) => {", page)
        self.assertIn(b"$[150] !== handleScopeChange", page)
        self.assertIn(b"$[188] !== visible", page)

    def test_patched_bytes_behave(self):
        self.assert_applied(others() + ["automations-view"])
        header = chunks(self.asar.read_bytes())
        self.assert_applied()
        view = chunks(self.asar.read_bytes())
        payload = {
            "header": {k: v[1].decode() for k, v in header.items()},
            "view": {k: v[1].decode() for k, v in view.items()},
            "stock": {k: v[1].decode() for k, v in chunks(STOCK.read_bytes()).items()},
        }
        script = self.dir / "harness.mjs"
        script.write_text(HARNESS)
        result = subprocess.run(["node", str(script)], input=json.dumps(payload), text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(result.stdout.strip(), "ok")


HARNESS = r'''// Behaviour of the 2.0.9 automations families on the real patched chunks, with stubbed React.
// stdin: {"header": {page, featureHeader}, "view": {page, featureHeader, detail}, "stock": {featureHeader}}.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const anything = new Proxy(function anything() {}, {
	get: (_t, key) => (key === Symbol.toPrimitive ? () => "" : key === Symbol.iterator ? [][Symbol.iterator] : key === "then" ? undefined : anything),
	apply: () => anything,
	construct: () => anything,
});
const strip = (src) => src.split("\n").filter((l) => !/^(import |export |var import_\w+ = |\/\/# sourceMappingURL)/.test(l)).join("\n");
function load(src, mocks, names) {
	const scope = new Proxy(mocks, {
		has: (t, k) => typeof k === "string" && (k in t || !(k in globalThis)),
		get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : anything),
		set: (t, k, v) => ((t[k] = v), true),
	});
	return new Function("scope", `with (scope) {\n${strip(src)}\nreturn { ${names.join(", ")} };\n}`)(scope);
}
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "Fragment" };
const SENTINEL = Symbol.for("react.memo_cache_sentinel");
function instance() {
	const slots = [];
	let index = 0;
	const slot = (init) => {
		const i = index++;
		if (!(i in slots)) slots[i] = init();
		return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }];
	};
	const hooks = {
		useState: (initial) => slot(() => (typeof initial === "function" ? initial() : initial)),
		useMemo: (fn) => fn(),
		useCallback: (fn) => fn,
		useEffect: () => {},
		useRef: (v) => slot(() => ({ current: v }))[0],
		cache: (n) => slot(() => new Array(n).fill(SENTINEL))[0],
	};
	const it = { hooks, render: (component, props) => { index = 0; current = it; return component(props); } };
	return it;
}
let current;
const fresh = instance;
const react = new Proxy({ Fragment: "Fragment" }, { get: (t, k) => current.hooks[k] ?? t[k] ?? anything });
const compiler = { c: (n) => current.hooks.cache(n) };
const cn = (...parts) => parts.filter(Boolean).join(" ");
const named = (name) => ({ [name]: function () {} })[name];

function find(node, match, found = []) {
	if (Array.isArray(node)) node.forEach((c) => find(c, match, found));
	else if (node && typeof node === "object" && "props" in node) {
		if (match(node)) found.push(node);
		find(node.props.children, match, found);
		if (node.props.extra) find(node.props.extra, match, found);
	}
	return found;
}
const is = (name) => (n) => n.type === name || n.type?.name === name;
const text = (n) => (Array.isArray(n) ? n.map(text).join("") : n && typeof n === "object" ? text(n.props?.children) : n == null || n === false ? "" : String(n));

const PROJECTS = [{ id: "p-fork", name: "fork", iconUrl: "i" }, { id: "p-dsd", name: "dsd", iconUrl: null }];
const auto = (id, v2ProjectId, extra = {}) => ({ id, name: id, v2ProjectId, enabled: true, ownerUserId: "me", group: null, rrule: null, triggerCount: 0, ...extra });
const ACTIVE = [
	auto("fork-failed", "p-fork", { group: "g" }), auto("fork-ok", "p-fork"), auto("fork-paused", "p-fork", { enabled: false }),
	auto("dsd-ok", "p-dsd"), auto("dsd-team", "p-dsd", { ownerUserId: "mate", group: "g" }), auto("session", null),
];
const ARCHIVED = [auto("old-dsd", "p-dsd", { archivedAt: 1 }), auto("old-mate", "p-dsd", { archivedAt: 1, ownerUserId: "mate" })];
const LAST_RUNS = new Map([["fork-failed", { status: "dispatch_failed", at: 3 }], ["fork-ok", { status: "dispatched", at: 2 }], ["dsd-ok", { status: "dispatched", at: 1 }]]);
const store = new Map();
const navigations = [];
const groupMoves = [];
const fixedNavigate = (to) => navigations.push(to);
const mocks = () => ({
	import_jsx_runtime: runtime, import_react: react, import_compiler_runtime: compiler, cn,
	localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
	useLingui: () => ({ _: (d) => d.id }),
	authClient: { useSession: () => ({ data: { user: { id: "me" } } }) },
	useIsOrganizationOwner: () => false,
	useSetAutomationGroup: () => ({ setGroup: (g) => groupMoves.push(g) }),
	useArchiveAutomations: () => ({ archive() {}, restore() {}, confirmDelete() {}, isPending: false }),
	useMutation: () => ({ mutate() {}, isPending: false }),
	cloudTrpc: {
		useUtils: () => anything,
		automation: {
			list: { useQuery: (q) => ({ data: q?.archived ? ARCHIVED : ACTIVE, isPending: false, isError: false }) },
			orgRunStats: { useQuery: () => ({ data: { succeeded: 1, failed: 2, missed: 3, buckets: [] } }) },
		},
		organization: { listMembers: { useQuery: () => ({ data: [] }) } },
	},
	useFailedAutomations: () => ({ lastRunById: LAST_RUNS }),
	useNow: () => 0,
	useRecentProjects: () => PROJECTS,
	useNavigate: () => fixedNavigate,
	usePaywall: () => ({ gateFeature: (_f, cb) => cb(), hasAccess: () => true, isReady: true }),
	useCreateAutomation: () => ({ create() {}, isPending: false }),
	groupAutomations: (items) => {
		const keys = [...new Set(items.map((a) => a.group ?? null))].sort((a, b) => (a === null) - (b === null));
		return keys.map((group) => ({ group, items: items.filter((a) => (a.group ?? null) === group) }));
	},
	listAutomationGroups: (items) => [...new Set(items.map((a) => a.group).filter(Boolean))],
	TriggersCard: named("TriggersCard"),
	FeatureHeader: named("FeatureHeader"), Tabs: named("Tabs"), TabsTrigger: named("TabsTrigger"), Button: named("Button"),
	Input: named("Input"), DropdownMenu: named("DropdownMenu"), DropdownMenuItem: named("DropdownMenuItem"), ProjectThumbnail: named("ProjectThumbnail"),
	AutomationStatCards: undefined, Trans: named("Trans"), PreviousRunsList: named("PreviousRunsList"),
});
const pageNames = ["AutomationsPage", "SahHeader"];

function mount(src, names) {
	const m = mocks();
	delete m.AutomationStatCards;
	const mod = load(src, m, names);
	const it = fresh();
	return { mod, render: () => it.render(mod.AutomationsPage, {}) };
}
const rows = (tree) => find(tree, is("AutomationRow")).map((r) => r.props.automation.id);
const header = (tree) => find(tree, is("FeatureHeader"))[0].props.extra;
const renderPart = (el) => fresh().render(el.type, el.props);

// --- automations-header -------------------------------------------------------
{
	const { render } = mount(input.header.page, pageNames);
	let tree = render();
	assert.equal(find(tree, is("Tabs")).length, 0, "no Mine / Team tab row");
	assert.deepEqual(rows(tree).sort(), ACTIVE.map((a) => a.id).sort(), "one list: mine and team");
	const byId = Object.fromEntries(find(tree, is("AutomationRow")).map((r) => [r.props.automation.id, r.props]));
	assert.equal(byId["dsd-team"].showOwner, true, "owner column while a teammate row is listed");
	assert.equal(byId["dsd-team"].selection, undefined, "teammate row not selectable");
	assert.ok(byId["fork-ok"].selection, "own row selectable");
	assert.ok(byId["fork-failed"].drag, "own row drags into groups");
	assert.equal(byId["dsd-team"].drag, undefined, "teammate row does not drag");
	let extra = header(tree);
	assert.equal(extra.type.name, "SahHeader");
	assert.deepEqual(extra.props.options.map(([k, , n]) => [k, n]), [["p-dsd", 2], ["p-fork", 3], ["", 1]], "projects by name, Session last");
	assert.equal(extra.props.value, null);
	assert.equal(find(tree, is("AutomationStatCards"))[0].props.totalAutomations, 6);
	// the header row renders project filter, All runs, Archived and the search
	const bar = renderPart(extra);
	assert.ok(find(bar, is("DropdownMenu")).length === 1, "project dropdown");
	const archiveBtn = find(bar, (n) => n.props["aria-pressed"] !== undefined)[0];
	assert.equal(archiveBtn.props["aria-pressed"], false);
	find(bar, (n) => is("Button")(n) && find(n, (m) => m.props.id === "R0NXcY").length > 0)[0].props.onClick();
	assert.deepEqual(navigations.pop(), { to: "/automations/runs", search: { scope: "all" } });
	// project filter
	extra.props.onValue("p-fork");
	tree = render();
	assert.deepEqual(rows(tree).sort(), ["fork-failed", "fork-ok", "fork-paused"]);
	assert.equal(find(tree, is("AutomationStatCards"))[0].props.totalAutomations, 3, "total follows the filter");
	assert.equal(header(tree).props.value, "p-fork");
	// archived toggle: the archive list, filtered by project when it has one there
	header(tree).props.onArchived(true);
	tree = render();
	extra = header(tree);
	assert.equal(extra.props.archived, true);
	assert.deepEqual(rows(tree).sort(), ["old-dsd", "old-mate"], "fork has no archived rows: all archived");
	const arch = Object.fromEntries(find(tree, is("AutomationRow")).map((r) => [r.props.automation.id, r.props]));
	assert.ok(arch["old-dsd"].selection && !arch["old-mate"].selection, "archive: own rows selectable (not org owner)");
	assert.equal(arch["old-dsd"].drag, undefined, "no drag in the archive");
	extra.props.onArchived(false);
	tree = render();
	assert.deepEqual(rows(tree).sort(), ["fork-failed", "fork-ok", "fork-paused"], "back to the project");
}

// --- FeatureHeader extra slot ----------------------------------------------------
{
	const props = { title: "T", docsUrl: "d", onCreate() {}, isCreating: false, createDescription: "c", primaryAction: { label: "L", onSelect() {}, disabled: false } };
	const patched = load(input.header.featureHeader, mocks(), ["FeatureHeader"]).FeatureHeader;
	const stock = load(input.stock.featureHeader, mocks(), ["FeatureHeader"]).FeatureHeader;
	const plain = (f, p) => JSON.stringify(fresh().render(f, p), (_k, v) => (typeof v === "function" ? v.name : v));
	assert.equal(plain(patched, props), plain(stock, props), "without extra: as upstream");
	const out = fresh().render(patched, { ...props, extra: "X" });
	assert.equal(out.props.children[1].props.children[0], "X", "extra left of the create button");
}

// --- automations-view ------------------------------------------------------------
{
	store.set("sah-project-order", JSON.stringify(["p-fork", "p-dsd"]));
	const { render } = mount(input.view.page, pageNames);
	let tree = render();
	const list = () => find(tree, is("SahProjects"))[0];
	assert.deepEqual(list().props.options.map(([k]) => k), ["p-fork", "p-dsd", ""], "stored order");
	assert.equal(list().props.value, "p-fork", "opens on the first group");
	assert.deepEqual(rows(tree).sort(), ["fork-failed", "fork-ok", "fork-paused"]);
	assert.equal(header(tree).props.options, null, "no dropdown beside the list");
	assert.equal(find(renderPart(header(tree)), is("DropdownMenu")).length, 0);
	assert.ok(find(tree, (n) => n.props.className === "flex min-h-full w-full flex-col px-8 pt-4 pb-12").length === 1, "full width");
	// chips
	const chips = () => renderPart(find(tree, is("SahChips"))[0]);
	assert.deepEqual(find(chips(), (n) => n.type === "button").map((b) => text(b)), ["Failed1", "Success1", "Paused1"]);
	find(chips(), (n) => n.type === "button" && text(n) === "Failed1")[0].props.onClick({ altKey: false });
	tree = render();
	assert.deepEqual(rows(tree), ["fork-failed"], "chip filters the table");
	find(chips(), (n) => n.type === "button" && text(n) === "Failed1")[0].props.onClick({ altKey: true });
	tree = render();
	assert.equal(rows(tree).length, 3, "Option-click on the only active chip shows all");
	// drag dsd above fork
	const nav = fresh();
	let el = list();
	let out = nav.render(el.type, el.props);
	find(out, (n) => n.key === "p-dsd")[0].props.onDragStart();
	out = nav.render(el.type, el.props);
	find(out, (n) => n.key === "p-fork")[0].props.onDrop();
	assert.deepEqual(JSON.parse(store.get("sah-project-order")), ["p-dsd", "p-fork", ""]);
	tree = render();
	assert.deepEqual(list().props.options.map(([k]) => k), ["p-dsd", "p-fork", ""]);
	assert.equal(list().props.value, "p-fork", "selection kept");
	// All projects
	out = nav.render(list().type, list().props);
	find(out, (n) => n.key === "*")[0].props.onClick();
	tree = render();
	assert.equal(rows(tree).length, 6);
	assert.equal(list().props.value, null);
	// a fresh mount opens on the first group of the stored order
	tree = mount(input.view.page, pageNames).render();
	assert.equal(list().props.value, "p-dsd");
}

// --- detail: settings and run history side by side ---------------------------------
{
	const src = input.view.detail;
	const at = src.indexOf("function AutomationBody({");
	assert.ok(at > 0);
	const body = src.slice(at, src.indexOf("\n}\n", at) + 3);
	const m = mocks();
	m.useAutomationDraft = () => ({ draft: { triggers: [], agent: "a" }, dirty: false, saving: false, shownProblems: [], banner: null, edit() {}, editTriggers() {}, save() {}, discard() {} });
	const mod = load(body, m, ["AutomationBody"]);
	const automation = { id: "a", name: "n", archivedAt: null, enabled: true, triggers: [], organizationId: "o" };
	const out = fresh().render(mod.AutomationBody, { automation, recentRuns: ["r"], hasMoreRuns: false, isLoadingMoreRuns: false, onLoadMoreRuns() {}, readOnly: false });
	assert.equal(find(out, (n) => n.props.className === "mt-6 mb-6 flex items-center gap-1").length, 0, "no tabs");
	const row = find(out, (n) => n.props.className === "mt-6 flex items-start gap-8")[0];
	assert.ok(row, "two columns");
	const [settings, aside] = row.props.children;
	assert.equal(settings.type, "fieldset");
	assert.equal(aside.type, "aside");
	assert.deepEqual(find(aside, is("PreviousRunsList"))[0].props.runs, ["r"]);
	assert.ok(find(settings, is("TriggersCard")).length === 1, "settings in the left column");
}
console.log("ok");
'''
