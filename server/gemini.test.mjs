import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { createGateway, answersMatch } from './gemini.mjs';
const ORIGIN = 'http://127.0.0.1:5173';
const BODY = { original:'Return BLOCK.', compressed:'Return BLOCK.', expected:'BLOCK' };
const HEADERS = { Origin:ORIGIN, 'Content-Type':'application/json', 'X-TokenLab-Client':'1' };
function mockResponse(text='BLOCK') { return Response.json({ candidates:[{ content:{ parts:[{ text:'not an exposed thought', thought:true },{ text }] }, finishReason:'STOP' }], usageMetadata:{ promptTokenCount:5,candidatesTokenCount:1,totalTokenCount:6 }, modelVersion:'mock-model-for-test' }); }
async function setup(t, overrides={}) {
 const calls=[];
 const server=createGateway({ key:'FAKE_TEST_VALUE_NOT_A_REAL_SECRET',model:'mock-model',fetchImpl:async (...args)=>{calls.push(args);return mockResponse();},...overrides });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 return {url:`http://127.0.0.1:${server.address().port}`,calls};
}
const post=(url,body=BODY,headers=HEADERS)=>fetch(url+'/api/evaluate',{method:'POST',headers,body:typeof body==='string'?body:JSON.stringify(body)});
test('exact comparison trims but does not treat partial matches as correct',()=>{assert.equal(answersMatch(' BLOCK\n','BLOCK'),true);assert.equal(answersMatch('BLOCK because...','BLOCK'),false);});
test('canonical JSON equality ignores object key order, not array order',()=>{assert.equal(answersMatch('{"b":2,"a":1}','{"a":1,"b":2}'),true);assert.equal(answersMatch('[1,2]','[2,1]'),false);});
test('health reveals no key and triggers no generation',async t=>{const {url,calls}=await setup(t);const r=await fetch(url+'/api/health');const s=await r.text();assert.equal(r.status,200);assert.equal(calls.length,0);assert.equal(s.includes('FAKE_TEST'),false);});
test('pair sends identical generation settings, separate prompts, no expected-answer leakage',async t=>{const {url,calls}=await setup(t);const r=await post(url,{original:'one',compressed:'two',expected:'BLOCK'});const data=await r.json();assert.equal(r.status,200);assert.equal(calls.length,2);const a=JSON.parse(calls[0][1].body),b=JSON.parse(calls[1][1].body);assert.deepEqual(a.generationConfig,b.generationConfig);assert.equal(a.contents[0].parts[0].text,'one');assert.equal(b.contents[0].parts[0].text,'two');assert.equal(calls[0][1].body.includes('BLOCK'),false);assert.equal(data.original.exactMatch,true);assert.equal(data.original.text,'BLOCK');assert.equal(data.original.usage.promptTokenCount,5);assert.equal(data.original.modelVersion,'mock-model-for-test');assert.equal(data.outputsMatch,true);});
test('no reference produces null accuracy',async t=>{const {url}=await setup(t);const r=await post(url,{...BODY,expected:''});assert.equal((await r.json()).original.exactMatch,null);});
test('cross-origin requests are blocked before spending',async t=>{const {url,calls}=await setup(t);const r=await post(url,BODY,{...HEADERS,Origin:'https://example.com'});assert.equal(r.status,403);assert.equal(calls.length,0);assert.equal(r.headers.get('access-control-allow-origin'),null);});
test('Origin and custom client header are required for evaluation',async t=>{const {url,calls}=await setup(t);assert.equal((await post(url,BODY,{'Content-Type':'application/json'})).status,403);assert.equal(calls.length,0);});
test('DNS-rebinding Host is rejected',async t=>{const {url,calls}=await setup(t);const status=await new Promise((resolve,reject)=>{const req=request(url+'/api/evaluate',{method:'POST',headers:{...HEADERS,Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end(JSON.stringify(BODY));});assert.equal(status,403);assert.equal(calls.length,0);});
test('non-JSON content type is rejected',async t=>{const {url}=await setup(t);assert.equal((await post(url,BODY,{...HEADERS,'Content-Type':'text/plain'})).status,415);});
test('invalid JSON and blank prompts are rejected before API calls',async t=>{const {url,calls}=await setup(t);assert.equal((await post(url,'{')).status,400);assert.equal((await post(url,{...BODY,compressed:' '})).status,400);assert.equal(calls.length,0);});
test('oversized prompt or request is rejected',async t=>{const {url,calls}=await setup(t);assert.equal((await post(url,{...BODY,original:'x'.repeat(20001)})).status,400);assert.equal((await post(url,'x'.repeat(180001))).status,413);assert.equal(calls.length,0);});
test('missing configuration never makes a paid request',async t=>{const {url,calls}=await setup(t,{key:''});assert.equal((await post(url)).status,503);assert.equal(calls.length,0);});
test('provider failure does not leak its body or key; second request is not made',async t=>{let count=0;const {url}=await setup(t,{fetchImpl:async()=>{count++;return new Response('sensitive provider error',{status:403});}});const r=await post(url);const text=await r.text();assert.equal(r.status,502);assert.equal(text.includes('sensitive provider'),false);assert.equal(text.includes('FAKE_TEST'),false);assert.equal(count,1);});
test('local rolling budget stops additional calls',async t=>{const {url,calls}=await setup(t,{maxPairsPerMinute:1});assert.equal((await post(url)).status,200);assert.equal((await post(url)).status,429);assert.equal(calls.length,2);});

test('unexpected/prototype fields and missing prompts fail before generation', async t => {
 const {url,calls}=await setup(t);
 for (const body of [{}, [], {original:'x'}, {...BODY, model:'other'}, JSON.parse('{"__proto__":{},"original":"x","compressed":"y"}')]) assert.equal((await post(url,body)).status,400);
 assert.equal(calls.length,0);
});
test('prompt and reference boundaries MAX-1/MAX/MAX+1', async t => {
 const {url,calls}=await setup(t,{maxPairsPerMinute:20});
 for (const n of [19999,20000,20001]) assert.equal((await post(url,{...BODY,original:'x'.repeat(n)})).status,n>20000?400:200);
 for (const n of [3999,4000,4001]) assert.equal((await post(url,{...BODY,expected:'x'.repeat(n)})).status,n>4000?400:200);
 assert.equal(calls.length,8);
});
test('concurrent pairs cannot bypass the in-flight lock', async t => {
 let release, started; const ready=new Promise(r=>started=r); const held=new Promise(r=>release=r); let calls=0;
 const {url}=await setup(t,{fetchImpl:async()=>{calls++; if(calls===1){started();await held;} return mockResponse();}});
 const first=post(url); await ready; assert.equal((await post(url)).status,429); release(); assert.equal((await first).status,200); assert.equal(calls,2);
});
test('provider timeout, 4xx/5xx, invalid JSON and malformed structures are sanitized', async t => {
 for (const response of [()=>{throw Error('FAKE_TEST sensitive stack');},()=>new Response('FAKE_TEST',{status:429}),()=>new Response('FAKE_TEST',{status:500}),()=>new Response('{'),()=>Response.json(null),()=>Response.json({}),()=>Response.json({candidates:[{content:{parts:{}}}]}),()=>Response.json({candidates:[{content:{parts:[null]}}]})]) {
  const {url}=await setup(t,{fetchImpl:async()=>response()}); const r=await post(url); assert.equal(r.status,502); const body=await r.text(); assert.ok(!body.includes('FAKE_TEST')); assert.ok(!body.includes('stack'));
 }
});
test('failure after first successful call is visible and never retried', async t => {
 let count=0; const {url}=await setup(t,{fetchImpl:async()=>++count===1?mockResponse():new Response('private',{status:500})});
 const r=await post(url);assert.equal(r.status,502);assert.equal(count,2);assert.ok(!(await r.text()).includes('private'));
});
test('safety blocked outputs and absent usage remain explicit', async t => {
 const {url}=await setup(t,{fetchImpl:async()=>Response.json({promptFeedback:{blockReason:'SAFETY'}})});
 const r=await post(url);const data=await r.json();assert.equal(r.status,200);assert.equal(data.original.text,'');assert.equal(data.original.finishReason,'SAFETY');assert.deepEqual(data.original.usage,{});assert.equal(data.original.exactMatch,false);
});
