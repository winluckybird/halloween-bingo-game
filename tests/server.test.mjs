import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.mjs';
import {completedLines} from '../src/rules.js';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {unlink} from 'node:fs/promises';
test('两个独立客户端建房、准备、切模式、隐私、同轮并列、奖励只发一次',async t=>{
 let now=100000;const app=await createApp({storeFile:null,clock:()=>now});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 async function api(path,data,token){const res=await fetch(base+path,{method:data?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:res.status,...await res.json()};}
 const a=await api('/api/session',{name:'南瓜甲',avatar:0}),b=await api('/api/session',{name:'幽灵乙',avatar:1});
 const create=await api('/api/action',{action:'create',mode:'icons'},a.token);const code=create.room.code;
 await api('/api/action',{action:'join',room:code},b.token);
 assert.equal((await api('/api/action',{action:'start',room:code},a.token)).status,400);
 await api('/api/action',{action:'ready',room:code},a.token);await api('/api/action',{action:'ready',room:code},b.token);
 const start=await api('/api/action',{action:'start',room:code},a.token);assert.equal(start.room.status,'countdown');
 assert.equal((await api('/api/action',{action:'practice',mode:'icons'},a.token)).status,400);
 const raw=app.db.rooms[code];const players=[a,b];
 // The fixture advances authoritative time, while all marking uses the real authenticated API.
 for(let round=1;round<=24&&raw.status!=='ended';round++){
   now=raw.deadline;if(raw.status==='event')now=raw.deadline;
   let states=await Promise.all(players.map(x=>api('/api/state?room='+code,null,x.token)));
   if(raw.status==='event'){now=raw.deadline;states=await Promise.all(players.map(x=>api('/api/state?room='+code,null,x.token)));}
   if(raw.status==='ended')break;
   for(let i=0;i<2;i++){
     const state=states[i].room;for(const item of state.history)if(state.you.card.includes(item)&&!state.you.marks.includes(item))await api('/api/action',{action:'mark',room:code,gameId:state.gameId,round:state.round,item},players[i].token);
   }
   if(raw.players.some(p=>completedLines(p.card,p.marks).length>=2)){
     // Ensure second player's simultaneous achievement for this tie boundary fixture.
     for(const p of raw.players)p.marks=[-1,...p.card.filter(x=>x!==-1)];
   }
 }
 if(raw.status!=='ended'){now=raw.deadline;await api('/api/state?room='+code,null,a.token);}
 assert.equal(raw.status,'ended');assert.equal(raw.winners.length,2);
 const sa=await api('/api/state?room='+code,null,a.token);assert.equal(sa.session.candy,30);assert.equal(sa.room.you.reward,30);assert.ok(!('card' in sa.room.players[1]));
 const again=await api('/api/state?room='+code,null,a.token);assert.equal(again.session.candy,30);
 const buy=await api('/api/action',{action:'buy',item:'cat'},a.token);assert.equal(buy.session.candy,10);assert.equal(buy.session.avatar,4);
 const returned=await api('/api/action',{action:'return',room:code},a.token);assert.equal(returned.room.status,'waiting');assert.ok(returned.room.players.every(p=>!p.ready));
 const switchMode=await api('/api/action',{action:'mode',room:code,mode:'numbers'},a.token);assert.equal(switchMode.room.total,75);
 const unauthorized=await api('/api/state?room='+code,null,'invalid');assert.equal(unauthorized.status,401);
 const hidden=await fetch(base+'/.data/state.json');assert.equal(hidden.status,403);
});
test('刷新/进程重启恢复原卡和标记，不补时间；练习按模式记录、每日奖励不重复',async t=>{
 let now=200000;const storeFile=join(tmpdir(),'halloween-bingo-test-'+randomUUID()+'.json');let app=await createApp({storeFile,clock:()=>now});
 async function listen(){await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${app.server.address().port}`;}
 let base=await listen(),token;
 t.after(async()=>{await app.close();await unlink(storeFile).catch(()=>{});await unlink(storeFile+'.tmp').catch(()=>{});});
 async function api(path,data){const res=await fetch(base+path,{method:data?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});assert.ok(res.ok);return res.json();}
 token=(await api('/api/session',{name:'恢复测试'})).token;
 let state=await api('/api/action',{action:'practice',mode:'icons'}),code=state.room.code;
 now=state.room.deadline;state=await api('/api/state?room='+code);const item=state.room.history[0],card=state.room.you.card;
 state=await api('/api/action',{action:'mark',room:code,gameId:state.room.gameId,round:1,item});const deadline=state.room.deadline;
 await app.close();now+=1000;app=await createApp({storeFile,clock:()=>now});base=await listen();
 state=await api('/api/state?room='+code);assert.deepEqual(state.room.you.card,card);assert.ok(state.room.you.marks.includes(item));assert.equal(state.room.deadline,deadline);
 let raw=app.db.rooms[code];raw.players[0].marks=[...card];now=deadline;state=await api('/api/state?room='+code);assert.equal(state.session.candy,2);assert.equal(state.session.bests.icons,1);
 assert.equal((await api('/api/state?room='+code)).session.candy,2);
 state=await api('/api/action',{action:'practice',mode:'numbers'});code=state.room.code;raw=app.db.rooms[code];now=raw.deadline;await api('/api/state?room='+code);raw.players[0].marks=[...raw.players[0].card];now=raw.deadline;state=await api('/api/state?room='+code);
 assert.equal(state.session.candy,2);assert.equal(state.session.bests.numbers,1);assert.equal(state.session.bests.icons,1);
});
test('开局后加入仅等下局、满8人拒绝、断线不代点、全退出不奖励',async t=>{
 let now=300000;const app=await createApp({storeFile:null,clock:()=>now});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base=`http://127.0.0.1:${app.server.address().port}`;
 async function api(token,data,path='/api/action'){const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return {status:res.status,...await res.json()};}
 const clients=[];for(let i=0;i<9;i++)clients.push((await api(null,{name:'伙伴'+i},'/api/session')).token);
 const created=await api(clients[0],{action:'create',mode:'icons'}),code=created.room.code;
 await api(clients[1],{action:'join',room:code});await api(clients[0],{action:'ready',room:code});await api(clients[1],{action:'ready',room:code});await api(clients[0],{action:'start',room:code});
 for(let i=2;i<8;i++){const s=await api(clients[i],{action:'join',room:code});assert.equal(s.room.you.participant,false);assert.deepEqual(s.room.you.card,[]);}
 assert.equal((await api(clients[8],{action:'join',room:code})).status,400);
 now+=20000;const raw=app.db.rooms[code];assert.ok(raw.players.every(p=>p.marks.length===1));
 await api(clients[0],{action:'leave',room:code});const last=await api(clients[1],{action:'leave',room:code});assert.equal(last.session.candy,0);assert.equal(raw.status,'aborted');
});
