export const FREE = -1;
export const SYMBOLS = ['幽灵','蝙蝠','黑猫','女巫帽','扫帚','坩埚','骷髅','木乃伊','蜘蛛','蛛网','包装糖','棒棒糖','玉米糖','苹果','蘑菇','魔法书','水晶球','魔药瓶','钥匙','棺材','墓碑','乌鸦','蜡烛','月亮'];
export const EMOJI = ['👻','🦇','🐈‍⬛','🧙','🧹','🫕','💀','🧟','🕷️','🕸️','🍬','🍭','🌽','🍎','🍄','📕','🔮','🧪','🗝️','⚰️','🪦','🐦‍⬛','🕯️','🌙'];
export const AVATARS = ['👻','🎃','🧙','🦇','🐈‍⬛'];
export const LINES = [
  ...Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r*5+c)),
  ...Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>r*5+c)),
  [0,6,12,18,24], [4,8,12,16,20],
];
export const EVENTS = [{name:'幽灵来访',sub:'小幽灵来串门，挥挥手再出发',icon:0},{name:'糖果雨',sub:'接住这份甜蜜，下一轮好运降临',icon:10},{name:'坩埚冒泡',sub:'魔法正在酝酿，马上继续派对',icon:5}];
export const SHOP = [{id:'cat',name:'黑猫头像',cost:20,icon:'🐈‍⬛',kind:'avatar'},{id:'moon',name:'月光卡框',cost:30,icon:'🌙',kind:'border'},{id:'spark',name:'星糖庆典',cost:40,icon:'✨',kind:'animation'}];
export const poolSize = mode => mode === 'numbers' ? 75 : 24;
export const itemName = (id,mode) => id === FREE ? '免费格' : mode === 'numbers' ? `${'BINGO'[Math.floor(id/15)]} ${id+1}` : SYMBOLS[id];
export function completedLines(card,marks) { const set=new Set(marks); return LINES.map((line,i)=>line.every(p=>set.has(card[p]))?i:-1).filter(i=>i>=0); }
export function nearLine(card,marks,called) {
  const marked=new Set(marks), opened=new Set(called);
  const candidates=LINES.map((line,i)=>({line:i,missing:line.map(p=>card[p]).filter(id=>!marked.has(id))})).filter(x=>x.missing.length===1);
  candidates.sort((a,b)=>Number(opened.has(b.missing[0]))-Number(opened.has(a.missing[0]))||a.line-b.line);
  if (!candidates.length) return null;
  const id=candidates[0].missing[0]; return {id,available:opened.has(id)};
}
