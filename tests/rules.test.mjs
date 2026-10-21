import test from 'node:test';
import assert from 'node:assert/strict';
import {FREE,LINES,completedLines,nearLine} from '../src/rules.js';
import {newRoom,playerFor,startGame,makeCard,advance,markItem,quitGame,publicRoom} from '../server/game.mjs';
const session=id=>({id,name:'玩家'+id,avatar:0});
const flat=[...Array(12).keys(),FREE,...Array.from({length:12},(_,i)=>12+i)];
function fixture(players=2,mode='icons'){
 const room=newRoom('123456',session('a'),mode,false,0);
 if(players>1)room.players.push(playerFor(session('b'),0));
 for(const p of room.players)p.ready=true;
 if(players===1)room.practice=true;
 startGame(room,0);return room;
}
function setRound(room,round,deadline=10000){room.status='round';room.round=round;room.deadline=deadline;room.deck=Array.from({length:room.mode==='numbers'?75:24},(_,i)=>i);for(const p of room.players){p.card=[...flat];p.marks=[FREE];}return room;}
test('图案卡包含全部24种图案一次、中心免费格、房间布局去重',()=>{
 for(let j=0;j<100;j++){const r=fixture();for(const p of r.players){assert.equal(p.card[12],FREE);assert.equal(new Set(p.card).size,25);assert.deepEqual([...p.card].filter(x=>x!==FREE).sort((a,b)=>a-b),Array.from({length:24},(_,i)=>i));}assert.notDeepEqual(r.players[0].card,r.players[1].card);}
});
test('经典数字卡按BINGO列范围分布，每张24个不同号码',()=>{
 for(let n=0;n<100;n++){const card=makeCard('numbers');assert.equal(card[12],FREE);assert.equal(new Set(card).size,25);for(let p=0;p<25;p++)if(p!==12)assert.equal(Math.floor(card[p]/15),p%5);}
});
test('倒数3秒后立即首开奖，每轮7秒，事件只在6/12/18轮后',()=>{
 const r=fixture();advance(r,2999);assert.equal(r.status,'countdown');advance(r,3000);assert.equal(r.round,1);assert.equal(r.deadline,10000);advance(r,45000);assert.equal(r.round,6);assert.equal(r.status,'event');assert.equal(r.deadline,48000);advance(r,48000);assert.equal(r.round,7);assert.equal(r.deadline,55000);
});
test('图案模式最长180秒，无人标记则24轮无人获胜',()=>{
 const r=fixture();advance(r,180000);assert.equal(r.status,'ended');assert.equal(r.round,24);assert.equal(r.finishedAt,180000);assert.deepEqual(r.winners,[]);
});
test('经典数字最长537秒，只保留三次轮间事件',()=>{
 const r=fixture(2,'numbers');advance(r,537000);assert.equal(r.status,'ended');assert.equal(r.round,75);assert.equal(r.finishedAt,537000);assert.deepEqual(r.winners,[]);
});

test('双模式开奖、轮询和跨轮均不自动标记，只有玩家点击才盖章',()=>{
 for(const mode of ['icons','numbers']){
  const r=fixture(1,mode),p=r.players[0];
  // Put an item on this card first, so an unmarked match is guaranteed.
  const id=p.card.find(id=>id!==FREE),first=r.deck.indexOf(id);[r.deck[0],r.deck[first]]=[r.deck[first],r.deck[0]];
  advance(r,3000);assert.deepEqual(p.marks,[FREE]);
  for(let now=3100;now<10000;now+=700){advance(r,now);assert.deepEqual(publicRoom(r,p.id,now).you.marks,[FREE]);}
  advance(r,10000);assert.deepEqual(p.marks,[FREE]);
  markItem(r,p,id,r.gameId,2,11000);assert.deepEqual(p.marks,[FREE,id]);
  advance(r,17000);assert.deepEqual(p.marks,[FREE,id]);
 }
});
test('同轮第2秒和第6秒达标，均等到轮末并列获胜',()=>{
 const r=setRound(fixture(),10);const required=[0,1,2,3,4,5,6,7,8,9];
 for(const [i,p] of r.players.entries()){for(const id of required)markItem(r,p,id,r.gameId,10,i===0?5000:9000);assert.equal(r.status,'round');}
 advance(r,10000);assert.equal(r.status,'ended');assert.deepEqual(r.winners,['a','b']);
});
test('旧开奖补点归补点轮次，后续轮才补到第二条不追溯',()=>{
 const r=setRound(fixture(),10);const p=r.players[0];p.marks=[FREE,0,1,2,3,4,5,6,7,8];
 assert.equal(completedLines(p.card,p.marks).length,1);advance(r,10000);assert.equal(r.round,11);markItem(r,p,9,r.gameId,11,11000);advance(r,17000);assert.equal(r.round,11);assert.deepEqual(r.winners,['a']);assert.ok(p.markRounds.includes(11));
});
test('一次标记可同时完成两条线，每条只计一次',()=>{
 const r=setRound(fixture(),24);const p=r.players[0];p.marks=[FREE,1,2,3,4,5,10,14,19];
 // Column zero is [0,5,10,14,19], row zero is [0,1,2,3,4].
 markItem(r,p,0,r.gameId,24,9000);assert.deepEqual(completedLines(p.card,p.marks),[0,5]);markItem(r,p,0,r.gameId,24,9001);assert.equal(p.marks.length,10);
});
test('第6轮达标则先结算，不播放事件；事件不能标记',()=>{
 const r=setRound(fixture(),6);const p=r.players[0];p.marks=Array.from({length:24},(_,i)=>i).concat(FREE);advance(r,10000);assert.equal(r.status,'ended');
 const other=fixture();advance(other,45000);assert.equal(other.status,'event');assert.throws(()=>markItem(other,other.players[0],other.deck[0],other.gameId,6,46000),/幕间/);
});
test('截止前接收有效，截止时刻拒绝旧轮，拒绝未开奖图案',()=>{
 const r=setRound(fixture(),10);const p=r.players[0];markItem(r,p,0,r.gameId,10,9999);assert.ok(p.marks.includes(0));assert.throws(()=>markItem(r,p,1,r.gameId,10,10000),/本轮已结束/);assert.ok(!p.marks.includes(1));assert.throws(()=>markItem(r,p,20,r.gameId,11,11000),/还没开到/);
});
test('已确认标记不可撤销，免费格无需点击，重复不增加数量',()=>{
 const r=setRound(fixture(),10);const p=r.players[0];markItem(r,p,0,r.gameId,10,5000);assert.equal(markItem(r,p,0,r.gameId,10,5001),false);assert.equal(p.marks.length,2);assert.throws(()=>markItem(r,p,FREE,r.gameId,10,5002));
});
test('断线不取消已达标资格，主动退出则放弃胜者资格',()=>{
 const r=setRound(fixture(),24);r.players[0].marks=[FREE,...Array(24).keys()];r.players[0].lastSeen=-99999;advance(r,10000);assert.deepEqual(r.winners,['a']);
 const q=setRound(fixture(),24);q.players[0].marks=[FREE,...Array(24).keys()];quitGame(q,q.players[0],9000);advance(q,10000);assert.deepEqual(q.winners,[]);
});
test('所有人主动退出立即中止，仍有断线参赛者则继续',()=>{
 const r=setRound(fixture(),10);r.players[1].lastSeen=-99999;quitGame(r,r.players[0],5000);assert.equal(r.status,'round');quitGame(r,r.players[1],6000);assert.equal(r.status,'aborted');
});
test('公开状态不泄漏其他玩家卡片、未开奖顺序',()=>{
 const r=fixture();advance(r,10000);const view=publicRoom(r,'a',10001);assert.equal(view.history.length,2);assert.ok(!('deck' in view));assert.ok(!('card' in view.players[1]));assert.deepEqual(view.you.card,r.players[0].card);
});
test('临近提示区分未开奖与可补点，并优先可补点',()=>{
 const card=[...flat],marks=[FREE,0,1,2,3];assert.deepEqual(nearLine(card,marks,[]),{id:4,available:false});assert.deepEqual(nearLine(card,marks,[4]),{id:4,available:true});assert.equal(LINES.length,12);
});
