import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = JSON.parse(fs.readFileSync(0, 'utf8'));
let now = 10000;
let timers = new Map(), nextTimer = 0;
const clock = {
  Date: {now: () => now},
  setTimeout(fn) {const id = ++nextTimer; timers.set(id, fn); return id;},
  clearTimeout(id) {timers.delete(id);},
};
class TRPCError extends Error {constructor(o) {super(o.message);this.code=o.code;}}
const protectedProcedure = {
  input() {return this;},
  mutation(handler) {return async call => {if (!call.ctx.isAuthenticated) throw new TRPCError({code:'UNAUTHORIZED'});return handler(call);};},
  query(handler) {return this.mutation(handler);},
};
const ctx = {organizationId:'org',isAuthenticated:true,isLocalCaller:true};
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const context = vm.createContext({...clock,Map,Set,Error,Number,Math,Array,
  router: o=>o, protectedProcedure, queryProcedure:protectedProcedure,
  gitHookTolerance:{TRPCError},hostServiceUtils:{getHostId:()=> 'mac1'},
});
vm.runInContext(source.host+';globalThis.api=dpsRouter();',context);
const api = context.api;
const input = {version:1,organizationId:'org',observedAt:now,pins:[{workspaceId:id,pinnedAt:1}]};
await assert.rejects(api.publish({ctx:{...ctx,isAuthenticated:false},input}), {code:'UNAUTHORIZED'});
await assert.rejects(api.publish({ctx:{...ctx,isLocalCaller:false},input}), {code:'FORBIDDEN'});
await assert.rejects(api.publish({ctx,input:{...input,version:2}}), {code:'BAD_REQUEST'});
await assert.rejects(api.publish({ctx,input:{...input,organizationId:'other'}}), {code:'BAD_REQUEST'});
await assert.rejects(api.publish({ctx,input:{...input,pins:[...input.pins,...input.pins]}}), {code:'BAD_REQUEST'});
await assert.rejects(api.publish({ctx,input:{...input,pins:[{workspaceId:'bad',pinnedAt:1}]}}), {code:'BAD_REQUEST'});
await assert.rejects(api.publish({ctx,input:{...input,pins:[{workspaceId:id,pinnedAt:NaN}]}}), {code:'BAD_REQUEST'});
let answered=false;
const read=api.list({ctx}).then(value=>{answered=true;return value;});
await api.publish({ctx,input:{...input,observedAt:now-1}});
await Promise.resolve();assert.equal(answered,false);
await api.publish({ctx:{...ctx,organizationId:'other'},input:{...input,organizationId:'other'}});
await Promise.resolve();assert.equal(answered,false);
await api.publish({ctx,input});
assert.deepEqual(JSON.parse(JSON.stringify(await read)),{...input,sourceHostId:'mac1'});
assert.equal(timers.size,0);
const unpin=api.list({ctx});
await api.publish({ctx,input:{...input,pins:[]}});
assert.equal((await unpin).pins.length,0);
const unavailable=api.list({ctx});
for (const fn of [...timers.values()]) fn();
await assert.rejects(unavailable,{code:'PRECONDITION_FAILED'});
assert.equal(timers.size,0);
let effect, cleanup, calls=[], pending;
const collection={status:'ready',state:new Map([[id,{workspaceId:id,sidebarState:{pinnedAt:1,isHidden:false}}]])};
const useCollections=()=>({v2WorkspaceLocalState:collection});
const renderer=vm.createContext({...clock,Number,Error,AbortSignal,Promise,
  useCollections,reactExports:{useEffect:fn=>{effect=fn;}},
  getHostServiceClientByUrl:url=>{assert.equal(url,'http://127.0.0.1:123');return {desktopPins:{publish:{mutate: async value=>{calls.push(value);if(pending) await pending;}}}};},
});
vm.runInContext(source.renderer,renderer);
useCollections.dps('org',{port:123,secret:'fixture'});
cleanup=effect();await new Promise(setImmediate);
assert.equal(calls.length,1);assert.equal(calls[0].pins.length,1);
collection.state.get(id).sidebarState.pinnedAt=null;
const tick=[...timers.values()][0];timers.clear();await tick();
assert.equal(calls.at(-1).pins.length,0);
collection.state.get(id).sidebarState.pinnedAt=NaN;
const invalid=[...timers.values()][0];timers.clear();await invalid();
assert.equal(calls.length,2);
collection.status='loading';
const loading=[...timers.values()][0];timers.clear();await loading();
assert.equal(calls.length,2);cleanup();assert.equal(timers.size,0);
console.log('bridge auth, validation, fresh reads, unpin, timeout, renderer hydration and cleanup passed');
