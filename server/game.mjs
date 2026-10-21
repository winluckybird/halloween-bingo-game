import {randomInt,randomUUID} from 'node:crypto';
import {FREE,LINES,completedLines,poolSize} from '../src/rules.js';
export const ROUND_MS=7000, EVENT_MS=3000, COUNTDOWN_MS=3000;
export function shuffle(values, pick=randomInt) { const a=[...values]; for(let i=a.length-1;i>0;i--){const j=pick(i+1);[a[i],a[j]]=[a[j],a[i]];}return a; }
export function makeCard(mode) {
  if(mode==='numbers') {
    const columns=Array.from({length:5},(_,c)=>shuffle(Array.from({length:15},(_,i)=>c*15+i)).slice(0,5));
    return Array.from({length:25},(_,p)=>p===12?FREE:columns[p%5][Math.floor(p/5)]);
  }
  const card=shuffle(Array.from({length:24},(_,i)=>i));card.splice(12,0,FREE);return card;
}
export function playerFor(session,now) {return {id:session.id,name:session.name,avatar:session.avatar,border:session.border||'',animation:session.animation||'',joinedAt:now,lastSeen:now,ready:false,active:true,participant:false,card:[],marks:[FREE],markRounds:[],reward:0};}
export function newRoom(code,session,mode,practice,now) {return {code,mode,practice,status:'waiting',host:session.id,players:[playerFor(session,now)],round:0,deck:[],deadline:0,lastActivity:now,gameId:'',winners:[],emotes:[],finishedAt:0};}
export function startGame(room,now) {
  const players=room.players.filter(p=>p.active);
  if(!room.practice && (players.length<2||players.some(p=>!p.ready||now-p.lastSeen>8000))) throw new Error('至少两位玩家在线，且所有人准备后才能开始');
  const used=new Set();
  for(const p of players){let card,key;do{card=makeCard(room.mode);key=card.join(',');}while(used.has(key));used.add(key);Object.assign(p,{participant:true,ready:false,card,marks:[FREE],markRounds:[],reward:0});}
  room.deck=shuffle(Array.from({length:poolSize(room.mode)},(_,i)=>i));
  Object.assign(room,{status:'countdown',round:0,deadline:now+COUNTDOWN_MS,startedAt:now,gameId:randomUUID(),winners:[],finishedAt:0,lastActivity:now,result:null});
}
export function finishGame(room,winners,at,aborted=false) {
  room.status=aborted?'aborted':'ended';room.winners=winners;room.finishedAt=at;room.deadline=0;room.lastActivity=at;
  room.result={gameId:room.gameId,round:room.round,winners:[...winners],aborted,mode:room.mode,practice:room.practice};
}
export function advance(room,now) {
  let changed=false;
  while(['countdown','round','event'].includes(room.status)&&now>=room.deadline){
    changed=true;const at=room.deadline;
    if(room.status==='countdown'){room.status='round';room.round=1;room.deadline=at+ROUND_MS;continue;}
    if(room.status==='event'){room.status='round';room.round++;room.deadline=at+ROUND_MS;continue;}
    const winners=room.players.filter(p=>p.participant&&p.active&&completedLines(p.card,p.marks).length>=2).map(p=>p.id);
    if(winners.length){finishGame(room,winners,at);break;}
    if(room.round>=room.deck.length){finishGame(room,[],at);break;}
    if([6,12,18].includes(room.round)){room.status='event';room.deadline=at+EVENT_MS;}
    else {room.round++;room.deadline=at+ROUND_MS;}
  }
  return changed;
}
export function markItem(room,player,id,gameId,round,now) {
  advance(room,now);
  if(!player.active||!player.participant) throw new Error('你没有本局参赛资格');
  if(room.gameId!==gameId||room.round!==round) throw new Error('本轮已结束，请在当前轮重新补点');
  if(room.status!=='round') throw new Error(room.status==='event'?'幕间休息，下一轮可继续补点':'当前不能标记');
  if(!Number.isInteger(id)||!player.card.includes(id)||id===FREE) throw new Error('请选择个人卡片内的图案或号码');
  if(!room.deck.slice(0,room.round).includes(id)) throw new Error('还没开到这个'+(room.mode==='numbers'?'号码':'图案'));
  if(player.marks.includes(id)) return false;
  player.marks.push(id);if(!player.markRounds.includes(room.round)) player.markRounds.push(room.round);
  room.lastActivity=now;return true;
}
export function quitGame(room,player,now) {
  advance(room,now);player.active=false;player.ready=false;room.lastActivity=now;
  if(['countdown','round','event'].includes(room.status)&&!room.players.some(p=>p.active&&p.participant)) finishGame(room,[],now,true);
  if(room.host===player.id) room.host=room.players.filter(p=>p.active).sort((a,b)=>Number(now-b.lastSeen<8000)-Number(now-a.lastSeen<8000)||a.joinedAt-b.joinedAt)[0]?.id||null;
}
export function publicRoom(room,viewer,now) {
  const you=room.players.find(p=>p.id===viewer);
  return {code:room.code,mode:room.mode,practice:room.practice,status:room.status,host:room.host,round:room.round,total:poolSize(room.mode),deadline:room.deadline,startedAt:room.startedAt,gameId:room.gameId,history:room.deck.slice(0,room.round),winners:room.winners,finishedAt:room.finishedAt,result:room.result,
    players:room.players.filter(p=>p.active||p.participant).map(p=>({id:p.id,name:p.name,avatar:p.avatar,online:now-p.lastSeen<8000,ready:p.ready,active:p.active,participant:p.participant,marks:p.marks.length-1,lines:p.card.length?completedLines(p.card,p.marks).length:0,reward:p.reward})),
    you:you?{...you,lines:you.card.length?completedLines(you.card,you.marks):[]}:null,
    emotes:room.emotes.filter(e=>now-e.at<5000)};
}
