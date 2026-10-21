import {FREE,SYMBOLS,AVATARS,LINES,EVENTS,SHOP,itemName,nearLine} from './rules.js';
import {configureEffects,effect} from './effects.js';
const $=s=>document.querySelector(s), app=$('#app'),modal=$('#modal');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get:(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set:(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}}};
let token=store.get('hb-token',''),profile=null,room=null,selectedMode=store.get('hb-mode','numbers');
let settings=store.get('hb-settings',{sound:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
let offset=0,lastSequence=0,serverId='',viewKey='',lastCall='',lastLine=0,lastEmote='',online=true,polling=false,toastTimer,busy=false;
let stampFeedback=null;
const pending=new Set();let invitation=new URLSearchParams(location.search).get('room');
const homeTitle=document.title;
const emoteText=['好耶！🎉','差一点！🥹','一起加油 💪','南瓜笑脸 🎃'];
function icon(id,cls=''){return `<i class="symbol ${cls}" style="--sx:${(id%6)*20}%;--sy:${[4.6875,36.458333,68.75,100][Math.floor(id/6)]}%" aria-hidden="true"></i>`;}
function visual(id,mode,cls=''){if(id===FREE)return `<span class="pumpkin ${cls}" aria-hidden="true">🎃</span>`;if(mode==='numbers')return `<span class="number-ball col-${Math.floor(id/15)} ${cls}"><small>${'BINGO'[Math.floor(id/15)]}</small><b>${id+1}</b></span>`;return icon(id,cls);}
function modeTitle(mode){return mode==='numbers'?'经典数字 Bingo':'万圣图案 Bingo';}
function modeCaption(mode){return mode==='numbers'?'1–75 经典分列 · 最长 8 分 57 秒':'24 种图案 · 最长 3 分钟';}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2400);}
function applySettings(){document.documentElement.classList.toggle('reduce-motion',settings.reduced);configureEffects(settings);store.set('hb-settings',settings);}
applySettings();
async function request(path,data){
  const sent=Date.now();const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
  try{
    const response=await fetch(path,{method:data?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:controller.signal});
    const result=await response.json();if(!response.ok){if(result.expired){token='';store.set('hb-token','');}throw new Error(result.error||'请求未完成');}
    const latency=Date.now()-sent;offset=result.serverNow-(sent+latency/2);online=true;
    return result;
  }catch(e){if(e.name==='AbortError'||e instanceof TypeError){online=false;throw new Error('连接中断，正在重试。对局计时仍在继续。');}throw e;}finally{clearTimeout(timeout);}
}
function accept(result){
  if(result.serverId!==serverId){serverId=result.serverId;lastSequence=0;}
  if(result.sequence<lastSequence)return;lastSequence=result.sequence;
  if(result.token){token=result.token;store.set('hb-token',token);}
  if(result.session){profile=result.session;$('#wallet').textContent=profile.candy;}
  if(Object.hasOwn(result,'room')){
    room=result.room;
    if(room&&!room.you?.active){room=null;if(profile)profile.room=null;toast('你已离开房间，或被房主移出');}
    if(room)sessionStorage.setItem('hb-room',room.code);else sessionStorage.removeItem('hb-room');
  }
  render();
}
async function action(name,extra={}){
  if(busy)return;busy=true;document.documentElement.classList.add('working');
  try{const result=await request('/api/action',{action:name,room:room?.code,...extra});accept(result);return result;}catch(e){toast(e.message);}finally{busy=false;document.documentElement.classList.remove('working');}
}
async function saveIdentity(){
  const name=$('#nickname')?.value??profile?.name??'南瓜朋友',avatar=Number(document.querySelector('[name="avatar"]:checked')?.value??profile?.avatar??0);
  accept(await request('/api/session',{name,avatar}));
}
function modeButtons(disabled=false){return `<div class="mode-picker" role="group" aria-label="选择玩法">${['numbers','icons'].map(mode=>`<button class="mode-card ${selectedMode===mode?'selected':''}" data-action="select-mode" data-mode="${mode}" ${disabled?'disabled':''} aria-pressed="${selectedMode===mode}"><span class="mode-check">${selectedMode===mode?'✓':'○'}</span><span class="mode-art">${mode==='numbers'?visual(37,'numbers'):icon(0)}</span><strong>${mode==='numbers'?'经典数字':'万圣图案'}</strong><small>${mode==='numbers'?'保留熟悉的数字球':'24 种可爱万圣图案'}</small><em>${mode==='numbers'?'75 号码 · 最长 8 分 57 秒':'24 图案 · 最长 3 分钟'}</em></button>`).join('')}</div>`;}
function identity(){return `<div class="identity"><label for="nickname">你的派对昵称</label><input id="nickname" maxlength="10" minlength="2" value="${escape(profile?.name||'南瓜朋友')}" autocomplete="nickname" placeholder="给自己起个名字"><div class="avatars" role="group" aria-label="选择头像">${AVATARS.map((avatar,i)=>i===4&&!profile?.owned.includes('cat')?'':`<label class="avatar-option"><input type="radio" name="avatar" value="${i}" ${i===(profile?.avatar||0)?'checked':''}><span>${avatar}</span></label>`).join('')}</div></div>`;}
function renderHome(){
  app.innerHTML=`<section class="home"><div class="home-intro"><span class="eyebrow">THE MIDNIGHT CANDY PARTY</span><h1><span>HALLOWEEN</span><b>BINGO</b></h1><h2>午夜糖果派对</h2><p>月亮升起，南瓜点亮。<br>叫上你的捣蛋鬼朋友，一起连出今晚的好运。</p><div class="home-ghost">${icon(0)}</div><div class="how-steps"><span><b>01</b> 看开奖</span><i>→</i><span><b>02</b> 找格盖章</span><i>→</i><span><b>03</b> 连成两条线</span></div><div class="home-tags"><span>✦ 2–8 人好友派对</span><span>✦ 同轮达标，一起赢</span></div></div><div class="home-panel ornate"><div class="panel-heading"><span class="eyebrow">PICK YOUR LITTLE MAGIC</span><h3>今晚，玩哪一种？</h3></div>${modeButtons()}${identity()}<button class="primary full" data-action="create">创建朋友房 <span>→</span></button><div class="home-secondary"><button class="secondary" data-action="join-dialog">输入房间码</button><button class="secondary" data-action="practice">单人练习 ↗</button></div><p class="fine-print">无需下载 · 无付费胜率优势 · 糖果只兑换装饰</p>${profile?.bests?.[selectedMode]?`<p class="personal-best">✧ 当前模式练习最佳：${profile.bests?.[room?.mode||selectedMode]} 轮</p>`:''}</div></section>`;
}
function renderLobby(){
  selectedMode=room.mode;
  const people=room.players.filter(p=>p.active),host=room.host===profile.id,me=room.you;
  const allReady=people.length>=2&&people.every(p=>p.ready&&p.online);
  app.innerHTML=`<section class="lobby"><div class="section-heading"><div><span class="eyebrow">YOUR FRIENDS, YOUR PARTY</span><h1>南瓜灯亮了，等你入座</h1><p>分享邀请，叫上朋友。${modeCaption(room.mode)}</p></div><button class="text-button" data-action="leave">离开房间 ↗</button></div><div class="lobby-columns"><div class="ornate lobby-main"><div class="room-code"><div><span class="eyebrow">派对房间码</span><strong>${room.code}</strong></div><button class="secondary" data-action="invite">复制邀请 ↗</button></div><div class="player-slots">${Array.from({length:8},(_,i)=>{const p=people[i];return p?`<div class="player-seat ${p.ready?'is-ready':''}"><span class="avatar">${AVATARS[p.avatar]}</span><div><b>${escape(p.name)}${p.id===profile.id?' <small>你</small>':''}</b><small>${p.id===room.host?'♛ 房主 · ':''}${p.online?(p.ready?'✓ 准备好了':'等待准备'):'暂时断线'}</small></div>${host&&p.id!==profile.id?`<button class="kick" data-action="kick" data-player="${p.id}" aria-label="移出${escape(p.name)}">×</button>`:''}</div>`:`<div class="player-seat empty"><span>＋</span><small>等一位捣蛋鬼</small></div>`;}).join('')}</div><div class="lobby-controls"><button class="${me.ready?'secondary':'primary'}" data-action="ready">${me.ready?'✓ 已准备 · 取消':'准备好了'}</button>${host?`<button class="primary" data-action="start" ${allReady?'':'disabled'}>${allReady?'开始派对 →':`等待伙伴准备 · ${people.filter(p=>p.ready&&p.online).length}/${people.length}`}</button>`:'<span>准备后，等待房主开始派对</span>'}</div></div><aside class="lobby-side"><div class="ornate mode-panel"><h3>本局玩法</h3>${modeButtons(!host)}<p class="fine-print">${host?'切换玩法后，所有人需要重新准备。':'由房主选择本局玩法。'}</p></div><div class="small-rules"><b>一局小魔法</b><p>中心免费格自动点亮。每轮有 7 秒标记，也可以补点历史开奖。</p><p>先连成两条线，在轮末一起揭晓胜者。</p></div></aside></div></section>`;
}
function gameMarkup(){
  const spectator=!room.you.participant;
  app.innerHTML=`<section class="game-view ${room.mode}" data-game="${room.gameId}"><div class="game-heading"><div><span class="mode-tag">${room.practice?'单人练习':'朋友派对'} · ${modeTitle(room.mode)}</span><span class="room-small">${room.practice?'挑战你的好运':`房间 ${room.code}`}</span></div><div class="game-actions"><span id="connection">● 已同步</span>${!room.practice?'<button class="text-button" data-action="invite">邀请 ↗</button>':''}<button class="text-button" data-action="exit-dialog">退出</button></div></div><div class="game-columns"><aside class="call-panel ornate"><div class="panel-top"><span class="eyebrow">THE MAGIC CALL</span><span id="round-label"></span></div><h2>今晚的好运是…</h2><div class="call-stage" id="call-stage"><div class="magic-ring"></div><div id="call-visual"></div><div class="stage-ghost">${icon(0)}</div><div class="stage-cauldron">${icon(5)}</div></div><div id="call-name" class="call-name" aria-live="polite"></div><p id="call-caption" class="call-caption"></p><div class="timer-row"><span id="phase-label">标记时间</span><strong id="time-left">3<small>秒</small></strong></div><div class="timer-track"><i id="timer-fill"></i></div><p class="call-rule">本轮结束时统一判定<br>同轮达标，共同获胜</p></aside><div class="board-section"><div class="board-top"><div><span class="eyebrow">YOUR LUCKY CARD</span><h2>${spectator?'等待下一局':'你的魔法卡片'}</h2></div><div class="line-counter"><span id="line-count">0</span><b>/ 2</b><small>完成连线</small></div></div><div class="board-frame ornate ${profile.border==='moon'?'moon-border':''}"><div class="bingo-heading" aria-hidden="true">${'BINGO'.split('').map(c=>`<span>${c}</span>`).join('')}</div><div class="card-wrap"><div class="bingo-grid" id="card" role="group" aria-label="个人 Bingo 卡片">${spectator?'<div class="spectator-note">👻<h3>本局已开始</h3><p>你已加入房间，等这局结束后一起玩。</p></div>':room.you.card.map((id,index)=>`<button class="cell ${id===FREE?'free':''}" data-action="mark" data-item="${id}" data-index="${index}" aria-label="${escape(itemName(id,room.mode))}">${id===FREE?'<span class="free-pumpkin">🎃</span><b>FREE</b><small>免费格</small>':room.mode==='numbers'?`<b class="cell-number">${id+1}</b>`:`${icon(id)}<span class="cell-name">${SYMBOLS[id]}</span>`}<span class="stamp" aria-hidden="true">✓</span></button>`).join('')}</div><svg class="line-overlay" id="line-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg></div></div><div class="board-hint" id="board-hint" role="status">✦ 看开奖，找格盖章，连成两条线</div><div id="stamp-feedback" class="stamp-feedback" role="status"></div><div class="legend"><span><i class="legend-unmarked"></i>未盖章</span><span><i class="legend-marked">✓</i>你已盖章</span><span>🎃 免费格</span></div><div class="mobile-history" id="mobile-history"></div></div><aside class="right-panel"><section class="history-panel ornate"><div class="aside-heading"><h3>开奖足迹</h3><button class="text-button" data-action="history">全部 <span id="history-count">0</span> ↗</button></div><p class="aside-sub">漏掉的好运，还可以补上</p><div class="history-list" id="history-list"></div></section><section class="friends-panel ornate"><div class="aside-heading"><h3>${room.practice?'练习笔记':'派对伙伴'}</h3><span class="eyebrow">${room.practice?'SOLO':`${room.players.filter(p=>p.active).length} PLAYERS`}</span></div><div id="players-list"></div>${room.practice?'<p class="practice-note">与朋友房规则相同<br>成功后记录所用轮数<br>每日首次成功 +2 🍬</p>':`<div class="emote-buttons">${['🎉','🥹','💪','🎃'].map((e,i)=>`<button data-action="emote" data-emote="${i}" aria-label="${emoteText[i]}">${e}</button>`).join('')}</div>`}<div id="emote-area" aria-live="polite"></div></section></aside></div><div class="game-bottom"><span>✧ ${modeCaption(room.mode)}</span><button class="text-button" data-action="${room.practice?'help':'players'}">${room.practice?'玩法说明 ↗':'查看派对伙伴 ↗'}</button></div><div id="result-slot"></div></section>`;
}
function updateGame(){
  const r=room,me=r.you,active=r.status==='round',history=r.history,lines=me.lines||[],marked=new Set(me.marks),called=new Set(history);
  const done=r.status==='ended'||r.status==='aborted',event=r.status==='event';
  $('#round-label').textContent=`第 ${r.round||'—'} / ${r.total} 轮`;
  $('#line-count').textContent=lines.length;$('#history-count').textContent=history.length;
  const phaseKey=`${r.gameId}:${r.status}:${r.round}`;
  if(lastCall!==phaseKey){
    lastCall=phaseKey;
    const current=history.at(-1),eventInfo=EVENTS[[6,12,18].indexOf(r.round)];
    if(r.status==='countdown'){
      $('#call-visual').innerHTML='<span class="countdown-number">3</span>';$('#call-name').textContent='南瓜灯已就位';$('#call-caption').textContent='看开奖 → 找格盖章 → 连成两条线';
    }else if(event){
      $('#call-visual').innerHTML=icon(eventInfo.icon,'event-symbol')+(r.round===18?'<span class=cauldron-bubbles><i></i><i></i><i></i></span>':'');$('#call-name').textContent=eventInfo.name;$('#call-caption').textContent=eventInfo.sub;effect('event'+EVENTS.indexOf(eventInfo));
    }else{
      $('#call-visual').innerHTML=current===undefined?'<span class="free-pumpkin">🎃</span>':visual(current,r.mode,'current-visual');$('#call-name').textContent=current===undefined?'本局已结束':itemName(current,r.mode);$('#call-caption').textContent=done?'这一份好运，留在今晚':r.mode==='numbers'?'按 B/I/N/G/O 列找号码，找到后点击盖章':'记住图案，在卡片里找到它并盖章';if(active)effect('call');
    }
    $('#call-stage').classList.toggle('is-event',event);$('#call-stage').dataset.event=event?String([6,12,18].indexOf(r.round)):'';
  }
  $('#phase-label').textContent=event?'幕间休息 · 暂不能标记':r.status==='countdown'?'派对即将开始':done?'本局已结束':'本轮标记时间';
  for(const cell of document.querySelectorAll('.cell')){
    const id=Number(cell.dataset.item),index=Number(cell.dataset.index),isMarked=marked.has(id),available=called.has(id)&&!isMarked;
    cell.classList.toggle('marked',isMarked);cell.classList.toggle('pending',pending.has(id));cell.classList.toggle('in-line',lines.some(n=>LINES[n].includes(index)));
    cell.disabled=done||id===FREE||!me.active||pending.has(id);cell.setAttribute('aria-disabled',String(!active));cell.setAttribute('aria-pressed',String(isMarked));
    cell.setAttribute('aria-label',`${itemName(id,r.mode)}，${id===FREE?'免费格，已点亮':pending.has(id)?'标记确认中':isMarked?'已标记':available?'已开奖，可标记':'尚未开奖'}`);
  }
  $('#line-overlay').innerHTML=lines.map(n=>{const line=LINES[n],a=line[0],b=line.at(-1);return `<line x1="${(a%5)*20+10}" y1="${Math.floor(a/5)*20+10}" x2="${(b%5)*20+10}" y2="${Math.floor(b/5)*20+10}"/>`;}).join('');
  if(lines.length>lastLine&&!done)effect('line');lastLine=lines.length;
  const near=me.card.length?nearLine(me.card,me.marks,history):null;
  $('#board-hint').textContent=!me.participant?'本局已开始，下一局再加入卡片竞技':done?'✦ 本局标记已锁定':event?'幕间小派对 · 暂不能盖章，下一轮可继续补点':r.status==='countdown'?'✦ 只有 FREE 自动点亮，其余格子由你找到并盖章':lines.length>=2?'✦ 你已达标，等待本轮结束 · 伙伴仍可共同获胜':near?(near.available?'✦ 有一条线还差一个已开奖项目，查历史找找漏点':'✧ 有一条线还差一个尚未开奖项目，留意下一次开奖'):'✦ 看开奖 → 自己找格子 → 点击盖章';
  const feedback=$('#stamp-feedback');
  if(feedback){
    const recentStamp=stampFeedback?.gameId===r.gameId&&Date.now()-stampFeedback.at<2200;
    feedback.textContent=recentStamp?`✓ 你盖中了「${itemName(stampFeedback.id,r.mode)}」`:`手动盖章 ${Math.max(0,me.marks.length-1)} / 24 · 不点击就不会点亮`;
    feedback.classList.toggle('confirmed',Boolean(recentStamp));
  }
  const recent=history.slice(-6).reverse();
  $('#history-list').innerHTML=recent.length?recent.map((id,i)=>`<div class="history-item ${i===0?'latest':''}">${visual(id,r.mode)}<div><b>${itemName(id,r.mode)}</b><small>第 ${history.length-i} 轮${i===0?' · 最新':''}</small></div><span class="history-state ${marked.has(id)?'checked':''}">${marked.has(id)?'✓':'已开'}</span></div>`).join(''):'<p class="empty-history">第一份好运，马上揭晓</p>';
  $('#mobile-history').innerHTML=`<span class="mobile-history-label">最近开奖</span><div>${history.slice(-4).reverse().map(id=>`<span title="${itemName(id,r.mode)}">${visual(id,r.mode)}<small>${r.mode==='numbers'?itemName(id,r.mode):SYMBOLS[id]}</small></span>`).join('')||'<small>等待第一轮</small>'}</div><button data-action="history" class="text-button">全部 ↗</button>`;
  $('#players-list').innerHTML=r.practice?`<div class="solo-profile"><span>${AVATARS[profile.avatar]}</span><b>${escape(profile.name)}</b><small>${profile.bests?.[room?.mode||selectedMode]?`最佳 ${profile.bests?.[room?.mode||selectedMode]} 轮`:'今晚的好运，从这里开始'}</small></div>`:r.players.filter(p=>p.active||p.participant).map(p=>`<div class="friend"><span class="avatar">${AVATARS[p.avatar]}</span><div><b>${escape(p.name)}${p.id===profile.id?' <small>你</small>':''}</b><small>${!p.active?'已退出':!p.participant?'等待下局':!p.online?'暂时断线':p.lines>=2?'本轮达标，等待轮末':`${p.marks} 格 · ${p.lines} 条线`}</small></div><i class="presence ${p.online&&p.active?'on':''}"></i></div>`).join('');
  const latest=r.emotes.filter(e=>Date.now()+offset-e.at<2000).slice(-2);
  const emoteKey=latest.map(e=>e.id).join();if(emoteKey!==lastEmote){lastEmote=emoteKey;$('#emote-area').innerHTML=latest.map(e=>`<p>${escape(r.players.find(p=>p.id===e.player)?.name||'伙伴')}：${emoteText[e.emote]}</p>`).join('');}
  if(done&&!$('#result-slot').children.length)showResult();if(modal.open&&modal.querySelector('.all-history'))refreshHistory();if(modal.open&&modal.querySelector('.modal-players'))modal.querySelector('.modal-players').innerHTML=$('#players-list').innerHTML;
  updateClock();
}
function showResult(){
  const won=room.winners.includes(profile.id),winners=room.players.filter(p=>room.winners.includes(p.id));
  const title=room.status==='aborted'?'本局已中止':won?(room.practice?'挑战成功！':winners.length>1?'一起喊 Bingo！':'今晚的好运属于你！'):winners.length?'派对有了幸运儿':'本局无人获胜';
  if(won)effect('win');
  $('#result-slot').innerHTML=`<div class="result-backdrop"><section class="result-card ornate" aria-labelledby="result-title" role="region"><span class="eyebrow">${won?'A LITTLE MAGIC, A LOT OF LUCK':'UNTIL THE NEXT MIDNIGHT'}</span><div class="result-pumpkin">${won?'🎃':'🌙'}</div><h2 id="result-title">${title}</h2><p>${winners.length?winners.map(p=>`${AVATARS[p.avatar]} ${escape(p.name)}`).join('　'):'下一份好运，说不定就在下一局'}</p><div class="result-stats"><span><b>${room.round}</b><small>结束轮次</small></span><span><b>${room.you.lines.length}</b><small>你的连线</small></span><span><b>+${room.you.reward||0}</b><small>装饰糖果 🍬</small></span></div><p class="reward-note">${escape(room.you.rewardReason||'奖励以已确认的标记记录为准')}</p><button class="primary full" data-action="${room.practice?'practice-again':'return'}">${room.practice?'再练一次 →':'返回房间 →'}</button><button class="text-button" data-action="leave">回到首页</button><small class="result-note">结果保留 10 分钟 · 糖果已自动结算</small></section></div>`;
}
function render(){
  if(!profile)return;
  const kind=!room?'home':room.status==='waiting'?'lobby':'game';
  if(room){
    invitation=null;
    const target=`/play?room=${room.code}`;
    if(location.pathname+location.search!==target)history.replaceState(null,'',target);
  }else if(!invitation&&(location.pathname==='/play'||new URLSearchParams(location.search).has('room'))){history.replaceState(null,'','/');}
  const privatePage=Boolean(room||invitation);
  document.title=privatePage?(kind==='lobby'?'好友房间':kind==='game'?'正在游戏':'加入朋友房')+'｜Halloween Bingo':homeTitle;
  document.querySelector('meta[name="robots"]').content=privatePage?'noindex,follow':'index,follow';
  if(privatePage)document.body.dataset.private='true';else delete document.body.dataset.private;
  const siteUrl=document.querySelector('meta[name="site-url"]')?.content;
  let canonical=document.querySelector('link[rel="canonical"]');
  if(privatePage)canonical?.remove();
  else if(siteUrl&&!canonical){canonical=document.createElement('link');canonical.rel='canonical';canonical.href=siteUrl;document.head.append(canonical);}
  const key=`${kind}:${room?.code||''}:${room?.gameId||''}:${kind==='home'?selectedMode:''}:${kind==='lobby'?JSON.stringify([room.mode,room.host,room.players]):''}`;
  document.body.dataset.screen=kind;
  if(key!==viewKey){viewKey=key;if(kind==='home')renderHome();else if(kind==='lobby')renderLobby();else{lastCall='';lastLine=0;gameMarkup();}}
  if(kind==='game')updateGame();
}
function updateClock(){
  if(!room||!$('#time-left'))return;
  const left=Math.max(0,room.deadline-(Date.now()+offset)),seconds=Math.ceil(left/1000),total=room.status==='round'?7000:3000;
  $('#time-left').innerHTML=room.deadline?`${seconds}<small>秒</small>`:'—';$('#timer-fill').style.width=`${Math.min(100,left/total*100)}%`;
  $('#timer-fill').classList.toggle('urgent',room.status==='round'&&left<2000);
  $('#connection').textContent=online?'● 已同步':'◌ 正在重连';$('#connection').classList.toggle('offline',!online);
  if(room.status==='countdown'&&$('.countdown-number'))$('.countdown-number').textContent=seconds||'GO';
  if(left===0&&room.status==='round'){$('#phase-label').textContent='正在确认本轮标记';for(const cell of document.querySelectorAll('.cell'))cell.disabled=true;}
}
setInterval(updateClock,100);
function openModal(title,content,cls=''){
  modal.className=cls;modal.innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="关闭">×</button></div>${content}`;
  if(!modal.open)modal.showModal();
}
function refreshHistory(){const grid=modal.querySelector('.all-history');if(!grid||!room)return;grid.innerHTML=room.history.map((id,i)=>`<div class=history-tile>${visual(id,room.mode)}<b>${itemName(id,room.mode)}</b><small>第 ${i+1} 轮${room.you.marks.includes(id)?' · 已标记':''}</small></div>`).join('')||'<p>第一轮还没开始</p>'; }
function showHistory(){
  if(!room)return;
  openModal('全部开奖足迹',`<p class="modal-sub">只在个人卡片里标记 · 查看期间计时继续</p><div class="all-history">${room.history.map((id,i)=>`<div class="history-tile">${visual(id,room.mode)}<b>${itemName(id,room.mode)}</b><small>第 ${i+1} 轮${room.you.marks.includes(id)?' · 已标记':''}</small></div>`).join('')||'<p>第一轮还没开始</p>'}</div>`,'wide-modal');
}
function showHelp(){openModal('三步，连出今晚的好运',`<div class="help-steps"><div><b>01</b><h3>看开奖</h3><p>每轮公布一个号码或图案，有 7 秒标记时间。</p></div><div><b>02</b><h3>找格盖章</h3><p>记住开奖，自己找到对应格子并点击盖章。不点击就不会点亮；历史开奖可补点，只有 FREE 自动点亮。</p></div><div><b>03</b><h3>连成两条线</h3><p>行、列或两条主对角线都算。轮末判胜，同轮达标共同获胜。</p></div></div><div class="help-note"><b>两种玩法，一样的派对规则</b><p>经典数字：1–75，按 B/I/N/G/O 分列，最多 75 轮。万圣图案：24 种图案，相同集合不同布局，最多 24 轮。</p><p>第 6、12、18 轮无胜者时，休息 3 秒。幕间不能标记。对局中打开设置、切后台或断线都不会暂停。</p><p>多人奖励：至少标记 4 格且分布在 2 轮，参与 +10、获胜再 +20；并列每人同奖。主动退出无奖励。单人每天首次成功 +2。</p></div><button class="primary full" data-action="close-modal">明白了，开始派对</button>`);}
function showSettings(){openModal('你的派对偏好',`<p class="modal-sub">对局期间打开设置，计时继续。</p><label class="setting-row"><span><b>声音</b><small>轻铃、标记与胜利提示</small></span><input type="checkbox" id="setting-sound" ${settings.sound?'checked':''}></label><label class="setting-row"><span><b>减少动画</b><small>保留静态提示，不改变每轮时长</small></span><input type="checkbox" id="setting-reduced" ${settings.reduced?'checked':''}></label><p class="fine-print">个人选择会在此浏览器中记住。</p>`);}
function showShop(){openModal('南瓜糖果小铺',`<p class="modal-sub">你有 <b>${profile.candy}</b> 颗糖果 · 所有装饰都不影响胜率</p><div class="shop-grid">${SHOP.map(item=>{const owned=profile.owned.includes(item.id),equipped=item.kind==='avatar'?profile.avatar===4:profile[item.kind]===item.id;return `<article><span>${item.icon}</span><h3>${item.name}</h3><p>${owned?'已拥有':`${item.cost} 颗糖果`}</p><button class="secondary" data-action="buy" data-item="${item.id}" ${equipped?'disabled':''}>${equipped?'使用中':owned?'使用装饰':'解锁装饰'}</button></article>`;}).join('')}</div><p class="fine-print">多人正常参与 +10，获胜再 +20；不按在线时长发奖。</p>`);}
async function mark(id){
  if(pending.has(id)||!room||room.you.marks.includes(id))return;
  if(room.status!=='round'||Date.now()+offset>=room.deadline){toast(room.status==='event'?'幕间休息，下一轮可继续补点':'当前不能标记');return;}
  if(!room.history.includes(id)){
    const cell=document.querySelector(`.cell[data-item="${id}"]`);cell?.classList.remove('misclick');void cell?.offsetWidth;cell?.classList.add('misclick');
    toast(`还没开到这个${room.mode==='numbers'?'号码':'图案'}，对照当前开奖或历史再找找`);return;
  }
  pending.add(id);updateGame();
  const gameId=room.gameId;
  try{
    const result=await request('/api/action',{action:'mark',room:room.code,gameId,round:room.round,item:id});pending.delete(id);accept(result);
    if(room?.gameId===gameId&&room.you.marks.includes(id)){
      stampFeedback={gameId,id,at:Date.now()};updateGame();effect('mark');
      const cell=document.querySelector(`.cell[data-item="${id}"]`);cell?.classList.remove('just-stamped');void cell?.offsetWidth;cell?.classList.add('just-stamped');
    }
  }catch(e){pending.delete(id);toast(e.message);if(room)updateGame();}
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const name=button.dataset.action;
  if(name==='close-modal'){modal.close();return;}
  if(name==='help'){showHelp();return;}if(name==='settings'){showSettings();return;}if(name==='shop'){if(profile)showShop();return;}
  if(name==='select-mode'){
    selectedMode=button.dataset.mode;store.set('hb-mode',selectedMode);
    if(room)await action('mode',{mode:selectedMode});else{const nick=$('#nickname')?.value,avatar=document.querySelector('[name=avatar]:checked')?.value;viewKey='';render();if(nick)$('#nickname').value=nick;if(avatar)document.querySelector('[name=avatar][value="'+avatar+'"]').checked=true;}return;
  }
  if(name==='create'||name==='practice'){
    try{await saveIdentity();await action(name,{mode:selectedMode});}catch(e){toast(e.message);}return;
  }
  if(name==='join-dialog'){
    try{await saveIdentity();openModal('加入朋友的派对',`<p class="modal-sub">输入朋友分享的 6 位房间码</p><form id="join-form"><label for="join-code">房间码</label><input id="join-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="例如 384621" value="${escape(invitation||'')}"><button class="primary full" type="submit">加入派对 →</button></form>`);$('#join-code').focus();}catch(e){toast(e.message);}return;
  }
  if(name==='mark'){await mark(Number(button.dataset.item));return;}
  if(name==='ready'||name==='start'||name==='return'){await action(name);return;}
  if(name==='practice-again'){await action('leave');await action('practice',{mode:selectedMode});return;}
  if(name==='leave'){await action('leave');history.replaceState(null,'','/');return;}
  if(name==='exit-dialog'){openModal('要离开这场派对吗？','<p class="modal-sub">主动退出将放弃本局获胜资格和糖果奖励。临时断线可恢复，对局计时仍会继续。</p><div class="modal-actions"><button class="secondary" data-action="close-modal">继续派对</button><button class="primary" data-action="confirm-exit">确认退出</button></div>');return;}
  if(name==='confirm-exit'){modal.close();await action('leave');history.replaceState(null,'','/');return;}
  if(name==='kick'){await action('kick',{player:button.dataset.player});return;}
  if(name==='history'){showHistory();return;}
  if(name==='players'){openModal('派对伙伴',`<p class="modal-sub">同轮达标可共同获胜 · 查看期间计时继续</p><div class="modal-players">${$('#players-list').innerHTML}</div><div class="emote-buttons">${['🎉','🥹','💪','🎃'].map((e,i)=>`<button data-action="emote" data-emote="${i}" aria-label="${emoteText[i]}">${e}</button>`).join('')}</div>`);return;}
  if(name==='emote'){if(await action('emote',{emote:Number(button.dataset.emote)}))toast('表情已送到伙伴身边');return;}
  if(name==='buy'){if(await action('buy',{item:button.dataset.item})){showShop();toast('装饰已更新');}return;}
  if(name==='invite'){
    const url=`${location.origin}/play?room=${room.code}`;
    try{await navigator.clipboard.writeText(`来参加 Halloween Bingo！房间码：${room.code}\n${url}`);toast('邀请已复制，发给你的捣蛋鬼朋友吧');}catch{openModal('邀请朋友',`<p>房间码：<b>${room.code}</b></p><input readonly value="${escape(url)}" aria-label="邀请链接"><p class="fine-print">复制链接或分享房间码。朋友需要能访问此服务器地址。</p>`);}return;
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='setting-sound'){settings.sound=event.target.checked;applySettings();}
  if(event.target.id==='setting-reduced'){settings.reduced=event.target.checked;applySettings();}
});
document.addEventListener('submit',async event=>{
  if(event.target.id!=='join-form')return;event.preventDefault();const code=$('#join-code').value.trim();if(!/^\d{6}$/.test(code)){toast('请输入 6 位房间码');return;}
  const result=await action('join',{room:code});if(result){modal.close();}
});
modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)modal.close();}});
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();if(room){document.querySelector('[data-action="exit-dialog"]')?.click();if(room.status==='waiting')action('leave');}else{viewKey='';render();}});
async function poll(){
  if(polling||!token)return;polling=true;
  try{const code=room?.code||profile?.room;if(code){const result=await request(`/api/state?room=${encodeURIComponent(code)}`);accept(result);}}
  catch(e){online=false;updateClock();}finally{polling=false;}
}
setInterval(poll,700);window.addEventListener('online',poll);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
async function boot(){
  try{
    accept(await request('/api/session',{}));
    if(profile.room)await poll();
    if(invitation&&room?.code!==invitation){viewKey='';render();document.querySelector('[data-action="join-dialog"]')?.click();}
  }catch(e){app.innerHTML=`<section class="boot-error ornate"><h1>南瓜灯暂时没连上</h1><p>${escape(e.message)}</p><button class="primary" id="retry-boot">重新连接</button></section>`;$('#retry-boot').onclick=boot;}
}
boot();
