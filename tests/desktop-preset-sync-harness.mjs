import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = JSON.parse(fs.readFileSync(0, 'utf8'));
let now = 10000;
let timers = new Map(), nextTimer = 0;
const clock = {
  Date: {now: () => now},
  setTimeout(fn, ms) {const id = ++nextTimer; timers.set(id, {fn, ms}); return id;},
  clearTimeout(id) {timers.delete(id);},
};
const fire = async () => {const [[id, {fn}]] = [...timers]; timers.delete(id); await fn();};
class TRPCError extends Error {constructor(o) {super(o.message);this.code=o.code;}}
const protectedProcedure = {
  input() {return this;},
  mutation(handler) {return async call => {if (!call.ctx.isAuthenticated) throw new TRPCError({code:'UNAUTHORIZED'});return handler(call);};},
  query(handler) {return this.mutation(handler);},
};
const router = o => ({...o, _def: {lazy: {}, record: o}});
const ctx = {organizationId:'org',isAuthenticated:true,isLocalCaller:true};
const context = vm.createContext({...clock,Map,Set,Error,Number,Math,Array,Object,Buffer,
  router, protectedProcedure, queryProcedure:protectedProcedure,
  gitHookTolerance:{TRPCError},hostServiceUtils:{getHostId:()=> 'mac1'},
});
vm.runInContext(source.host+';globalThis.api=dtsRouter();globalThis.mount=dtsMount;',context);
const api = context.api;

// Mount: the presets router joins the app router's record; lazy routers keep the stock router.
const stockApp = router({health: {ping: 1}, desktopPins: {list: 2}});
const mounted = context.mount(stockApp);
assert.deepEqual(Object.keys(mounted._def.record), ['health', 'desktopPins', 'desktopPresets']);
assert.equal(mounted._def.record.health, stockApp._def.record.health);
const lazyApp = {_def: {lazy: {later: {}}, record: {}}};
assert.equal(context.mount(lazyApp), lazyApp);

const id = n => `${String(n).repeat(8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
const preset = (n, extra = {}) => ({id:id(n),name:`P${n}`,cwd:'',commands:['echo'],projectIds:null,executionMode:'new-tab',tabOrder:n,...extra});
const input = (extra = {}) => ({version:1,organizationId:'org',observedAt:now,presets:[preset(1)],hiddenBuiltinPresetIds:[],...extra});
const bad = async (value, why) => assert.rejects(api.publish({ctx,input:value}), {code:'BAD_REQUEST'}, why);
const big = 'x'.repeat(16385);

// Publish authentication: the relay may read, never publish.
await assert.rejects(api.publish({ctx:{...ctx,isAuthenticated:false},input:input()}), {code:'UNAUTHORIZED'});
await assert.rejects(api.list({ctx:{...ctx,isAuthenticated:false}}), {code:'UNAUTHORIZED'});
await assert.rejects(api.publish({ctx:{...ctx,isLocalCaller:false},input:input()}), {code:'FORBIDDEN'});
await assert.rejects(api.publish({ctx:{...ctx,isLocalCaller:undefined},input:input()}), {code:'FORBIDDEN'});
assert.equal(await api.publish({ctx,input:input()}), null);

// Validation of the whole publication: any invalid field rejects it.
await bad(null, 'missing input');
await bad(input({version:2}), 'unknown version');
await bad(input({organizationId:'other'}), 'other organization');
await bad(input({observedAt:now-5001}), 'stale');
await bad(input({observedAt:now+5001}), 'future');
await bad(input({observedAt:1.5}), 'fractional time');
await bad(input({presets:{}}), 'presets not a list');
await bad(input({presets:Array.from({length:501}, (_, n) => preset(1, {id:`${String(n).padStart(8,'0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`}))}), 'over 500 presets');
await bad(input({hiddenBuiltinPresetIds:null}), 'hidden ids not a list');
await bad(input({hiddenBuiltinPresetIds:[1]}), 'hidden id not a string');
await bad(input({hiddenBuiltinPresetIds:Array(501).fill('superset-cli')}), 'over 500 hidden ids');
await bad(input({hiddenBuiltinPresetIds:[big]}), 'hidden id over 16 KB');
for (const [field, value] of [
  ['id','not-a-uuid'],['id',42],['name',undefined],['name',big],['description',3],['description',big],
  ['cwd',undefined],['cwd',big],['commands','echo'],['commands',[1]],['commands',[big]],['commands',Array(65).fill('a')],
  ['projectIds',undefined],['projectIds','p'],['projectIds',[3]],['projectIds',[big]],['pinnedToBar','yes'],
  ['executionMode','tab'],['executionMode',undefined],['tabOrder',1.5],['tabOrder','1'],['agentId',7],['agentId',big],
  ['useAsWorkspaceRun',1],
]) await bad(input({presets:[preset(1, {[field]:value})]}), `${field}=${String(value).slice(0,20)}`);
await bad(input({presets:[preset(1),preset(1)]}), 'duplicate ids');
await bad(input({presets:[preset(1, {id:id('a')}),preset(2, {id:id('A')})]}), 'duplicate ids differing in case');
await bad(input({presets:[preset(1, {id:id('A')}),preset(2, {id:id('a')})]}), 'duplicate ids differing in case, upper first');
await bad(input({presets:[null]}), 'null preset');
assert.equal(await api.publish({ctx,input:input({presets:Array.from({length:500}, (_, n) => preset(1, {id:`${String(n).padStart(8,'0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,commands:Array(64).fill('x'.repeat(16384))}))})}), null);
assert.equal(await api.publish({ctx,input:input({presets:[preset(1, {name:'é'.repeat(8192)})]})}), null);
await bad(input({presets:[preset(1, {name:'é'.repeat(8193)})]}), '16 KB counts UTF-8 bytes');

// Reads wait for a publication observed after the read started.
let answered = false;
const read = api.list({ctx}).then(value => {answered = true; return value;});
await api.publish({ctx,input:input({observedAt:now-1})});
await Promise.resolve(); assert.equal(answered, false);
await api.publish({ctx:{...ctx,organizationId:'other'},input:input({organizationId:'other'})});
await Promise.resolve(); assert.equal(answered, false);
await api.publish({ctx,input:input({presets:[]})});
assert.deepEqual(JSON.parse(JSON.stringify(await read)), {version:1,organizationId:'org',sourceHostId:'mac1',observedAt:now,presets:[],hiddenBuiltinPresetIds:[]});
assert.equal(timers.size, 0);

// No publication within 3.5 s: unavailable, never an empty list.
const unavailable = api.list({ctx});
assert.equal([...timers.values()][0].ms, 3500);
await fire();
await assert.rejects(unavailable, {code:'PRECONDITION_FAILED'});
assert.equal(timers.size, 0);
const crowd = Array.from({length:64}, () => api.list({ctx}));
await assert.rejects(api.list({ctx}), {code:'TOO_MANY_REQUESTS'});
await api.publish({ctx,input:input()});
assert.equal((await Promise.all(crowd)).length, 64);
assert.equal(timers.size, 0);

// Renderer: the collection rows of the active organization, read-only, every second.
const row = (n, extra) => ({...preset(n), createdAt:new Date(0), applyOnNewTab:true, applyOnWorkspaceCreated:false, ...extra});
const presets = {status:'ready', state:new Map([
  [id(3), row(3, {name:'Agent', tabOrder:2, agentId:'claude', commands:['claude --resume'], pinnedToBar:true})],
  [id(1), row(1, {name:'Scoped', description:'Only here', cwd:'apps/web', projectIds:['p1','p2'], tabOrder:0, useAsWorkspaceRun:true})],
  [id(4), row(4, {name:'Sequential', commands:['bun i','bun dev'], executionMode:'sequential', tabOrder:2})],
  [id(2), row(2, {name:'Hidden', pinnedToBar:false, tabOrder:1, executionMode:'split-pane'})],
])};
const prefs = {status:'ready', state:new Map([['preferences', {id:'preferences', hiddenBuiltinPresetIds:['superset-cli'], showPresetsBar:true}]])};
let effect, cleanup, calls = [], connection = {port:123, secret:'fixture'}, secrets = [], connectionQueries = [], connectionGate = null;
const hostClient = {desktopPresets:{publish:{mutate: async (value, options) => {
  assert.ok(options.signal);
  calls.push(value);
  return api.publish({ctx, input:value});
}}}};
const renderer = vm.createContext({...clock,Number,Error,AbortSignal,Promise,
  reactExports:{useEffect:(fn, deps) => {effect = fn; assert.equal(deps.length, 2); assert.equal(deps[1], collections);}},
  electronTrpcClient:{hostServiceCoordinator:{getConnection:{query: async value => {connectionQueries.push(value); await connectionGate; return connection;}}}},
  setHostServiceSecret:(url, secret) => secrets.push([url, secret]),
  getHostServiceClientByUrl:url => {assert.equal(url, 'http://127.0.0.1:123'); return hostClient;},
});
const collections = {v2TerminalPresets:presets, v2UserPreferences:prefs};
vm.runInContext(source.renderer, renderer);
vm.runInContext('dtsUse', renderer)(null, collections);
assert.equal(effect(), undefined, 'no organization, no exporter');
vm.runInContext('dtsUse', renderer)('org', collections);
const contract = api.list({ctx});
cleanup = effect(); await new Promise(setImmediate);
assert.equal(JSON.stringify(connectionQueries), '[{"organizationId":"org"}]');
assert.deepEqual(secrets, [['http://127.0.0.1:123', 'fixture']]);
assert.equal(calls.length, 1);
const expected = {version:1,organizationId:'org',sourceHostId:'mac1',observedAt:now,presets:[
  {id:id(1),name:'Scoped',description:'Only here',cwd:'apps/web',commands:['echo'],projectIds:['p1','p2'],executionMode:'new-tab',tabOrder:0,useAsWorkspaceRun:true},
  {id:id(2),name:'Hidden',cwd:'',commands:['echo'],projectIds:null,pinnedToBar:false,executionMode:'split-pane',tabOrder:1},
  {id:id(3),name:'Agent',cwd:'',commands:['claude --resume'],projectIds:null,pinnedToBar:true,executionMode:'new-tab',tabOrder:2,agentId:'claude'},
  {id:id(4),name:'Sequential',cwd:'',commands:['bun i','bun dev'],projectIds:null,executionMode:'sequential',tabOrder:2},
],hiddenBuiltinPresetIds:['superset-cli']};
const listed = await contract;
assert.equal(JSON.stringify(listed), JSON.stringify(expected), 'contract fields, order and values');
for (const item of listed.presets) assert.ok(Object.values(item).every(value => value !== undefined), 'absent optional fields have no key');
presets.state.get(id(1)).commands.push('mutated');
assert.equal(JSON.stringify(listed.presets[0].commands), '["echo"]', 'the snapshot owns its arrays');
assert.equal(timers.size, 1); assert.equal([...timers.values()][0].ms, 1000);

// Missing preferences row: no hidden builtins. A changed row is exported on the next tick.
prefs.state.clear();
presets.state.get(id(2)).pinnedToBar = true;
const next = api.list({ctx});
now += 1000; await fire();
const second = await next;
assert.equal(JSON.stringify(second.hiddenBuiltinPresetIds), '[]');
assert.equal(second.presets[1].pinnedToBar, true);
assert.equal(calls.length, 2);

// Hydration, connection and row failures publish nothing; the heartbeat continues.
for (const [setup, undo] of [
  [() => {presets.status = 'loading';}, () => {presets.status = 'ready';}],
  [() => {prefs.status = 'loading';}, () => {prefs.status = 'ready';}],
  [() => {connection = null;}, () => {connection = {port:123, secret:'fixture'};}],
  [() => {connection = {port:123};}, () => {connection = {port:123, secret:'fixture'};}],
  [() => {presets.state.set('bad', null);}, () => {presets.state.delete('bad');}],
]) {
  setup(); await fire(); undo();
  assert.equal(calls.length, 2); assert.equal(timers.size, 1);
}
// A row the host rejects: the read stays unavailable instead of listing a partial set.
presets.state.get(id(1)).executionMode = 'tab';
const rejected = api.list({ctx});
await fire();
assert.equal(calls.length, 3);
const [waitId, wait] = [...timers].find(([, timer]) => timer.ms === 3500);
timers.delete(waitId); await wait.fn();
await assert.rejects(rejected, {code:'PRECONDITION_FAILED'});
cleanup(); assert.equal(timers.size, 0);

// Unmounted while the connection lookup is in flight: no publish, no next heartbeat.
let release;
connectionGate = new Promise(resolve => {release = resolve;});
vm.runInContext('dtsUse', renderer)('org', collections);
const unmount = effect(); await Promise.resolve();
unmount(); release(); await new Promise(setImmediate);
assert.equal(calls.length, 3, 'no publish after cleanup'); assert.equal(timers.size, 0, 'no heartbeat after cleanup');
console.log('preset bridge mount, auth, validation, caps, fresh reads, timeout, contract fixture, renderer hydration and cleanup passed');
