import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile,rename} from 'node:fs/promises';
import {randomBytes,randomInt} from 'node:crypto';
import {dirname,resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SHOP,AVATARS,completedLines} from '../src/rules.js';
import {newRoom,playerFor,startGame,advance,markItem,quitGame,publicRoom} from './game.mjs';
import {normalizeSiteUrl,pageHtml,robotsTxt,sitemapXml} from './seo.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const activeStatus=s=>['countdown','round','event'].includes(s);
export async function createApp({storeFile=resolve(root,'.data/state.json'),clock=Date.now,siteUrl=process.env.SITE_URL||''}={}) {
  siteUrl=normalizeSiteUrl(siteUrl);
  let db={sessions:{},rooms:{}};
  if(storeFile){try{db=JSON.parse(await readFile(storeFile,'utf8'));}catch(e){if(e.code!=='ENOENT') throw e;}}
  let dirty=false,saving=false,sequence=0,savePromise=Promise.resolve();
  const serverId=randomBytes(8).toString('hex');
  async function flush(){
    if(saving){await savePromise;return flush();}
    if(!storeFile||!dirty)return;
    saving=true;dirty=false;
    savePromise=(async()=>{try{await mkdir(dirname(storeFile),{recursive:true});await writeFile(storeFile+'.tmp',JSON.stringify(db));await rename(storeFile+'.tmp',storeFile);}catch(e){dirty=true;console.error('保存失败:',e.message);}finally{saving=false;}})();
    await savePromise;
  }
  function sessionView(s){return {id:s.id,name:s.name,avatar:s.avatar,candy:s.candy,owned:s.owned,border:s.border,animation:s.animation,bests:s.bests||{},room:s.room||null};}
  function settle(room){
    if(!['ended','aborted'].includes(room.status)||room.paidGame===room.gameId)return;
    room.paidGame=room.gameId;
    for(const p of room.players){
      if(!p.participant)continue;const s=Object.values(db.sessions).find(s=>s.id===p.id);if(!s)continue;
      const won=room.winners.includes(p.id);let amount=0,reason='未满足参与条件：需标记至少 4 格，且分布在至少 2 轮';
      if(room.status==='aborted')reason='本局已中止';
      else if(!p.active)reason='主动退出，不发放本局奖励';
      else if(room.practice){
        reason=won?'今日练习成功奖励已领取':'练习未成功';
        if(won){s.bests||={};s.bests[room.mode]=Math.min(s.bests[room.mode]||Infinity,room.round);if(s.practiceDay!==day(room.finishedAt)){amount=2;s.practiceDay=day(room.finishedAt);reason='当日首次练习成功';}}
      }else if(p.marks.length-1>=4&&p.markRounds.length>=2){amount=10+(won?20:0);reason=won?'参与 +10 · 获胜 +20':'正常参与 +10';}
      p.reward=amount;p.rewardReason=reason;s.candy+=amount;s.lastResult={...room.result,reward:amount,reason,lines:completedLines(p.card,p.marks).length};
    }
    dirty=true;
  }
  function tick(now){
    for(const [code,room] of Object.entries(db.rooms)){
      if(advance(room,now))dirty=true;settle(room);
      if(room.status==='waiting'){
        const host=room.players.find(p=>p.id===room.host&&p.active);
        if(!host||now-host.lastSeen>30000){const next=room.players.find(p=>p.active&&now-p.lastSeen<8000);if(next&&next.id!==room.host){room.host=next.id;dirty=true;}}
      }
      if((!activeStatus(room.status)&&now-room.lastActivity>600000)||!room.players.some(p=>p.active)){
        // Keep abandoned completed results for their ten minute recovery window.
        if(room.status==='aborted'&&now-room.finishedAt<600000)continue;
        delete db.rooms[code];for(const s of Object.values(db.sessions))if(s.room===code)s.room=null;dirty=true;
      }
    }
  }
  const timer=setInterval(()=>{tick(clock());void flush();},100);timer.unref();
  const rates=new Map();
  function limit(key,now){const r=rates.get(key);if(!r||now-r.at>10000){rates.set(key,{at:now,n:1});return;}if(++r.n>160)throw new Error('操作太频繁，请稍等');}
  async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>4096)throw new Error('请求内容过长');}try{return text?JSON.parse(text):{};}catch{throw new Error('请求格式无效');}}
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
    const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({...value,sequence:++sequence,serverId}));};
    try{
      const url=new URL(req.url,'http://local');
      if(url.pathname.startsWith('/api/')){
        res.setHeader('X-Robots-Tag','noindex');
        if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return json({error:'不允许跨站请求'},403);
        const data=req.method==='POST'?await body(req):{};const now=clock();tick(now);
        let token=(req.headers.authorization||'').replace(/^Bearer /,'');let s=db.sessions[token];
        limit(token||req.socket.remoteAddress,now);
        if(url.pathname==='/api/session'&&req.method==='POST'){
          if(!s){token=randomBytes(32).toString('hex');s={id:randomBytes(8).toString('hex'),name:'南瓜朋友',avatar:0,candy:0,owned:[],border:'',animation:'',best:null,room:null};db.sessions[token]=s;}
          const name=String(data.name||s.name).trim().replace(/[\u0000-\u001f]/g,'').slice(0,10);if(name.length<2)throw new Error('昵称请输入 2–10 个字');
          const avatar=Number.isInteger(data.avatar)?data.avatar:s.avatar;if(avatar<0||avatar>=AVATARS.length||(avatar===4&&!s.owned.includes('cat')))throw new Error('请先解锁这个头像');
          s.name=name;s.avatar=avatar;dirty=true;return json({token,session:sessionView(s),serverNow:now});
        }
        if(!s)return json({error:'身份已过期，请重新进入',expired:true},401);
        const code=String(data.room||url.searchParams.get('room')||s.room||'').toUpperCase();let room=db.rooms[code];let p=room?.players.find(p=>p.id===s.id);
        if(p&&p.active)p.lastSeen=now;
        const respond=()=>{settle(room);json({room:publicRoom(room,s.id,now),session:sessionView(s),serverNow:now});};
        if(url.pathname==='/api/state'&&req.method==='GET'){
          if(!room||!p)return json({room:null,session:sessionView(s),serverNow:now});respond();return;
        }
        if(url.pathname==='/api/action'&&req.method==='POST'){
          const action=data.action;
          if(['create','practice','join'].includes(action)){
            const old=db.rooms[s.room],oldp=old?.players.find(p=>p.id===s.id&&p.active);
            if(oldp&&activeStatus(old.status)&&oldp.participant&&!(action==='join'&&old.code===code))throw new Error('请先退出当前对局');
            if(action==='join'){
              if(!room)throw new Error('房间已结束或不存在，请创建新房间');
              if(p&&p.active){s.room=room.code;respond();return;}
              if(p?.participant&&activeStatus(room.status))throw new Error('你已主动退出本局，结束后可重新加入');
              if(room.practice)throw new Error('这是单人练习，不能加入');
              if(room.players.filter(x=>x.active).length>=8)throw new Error('房间已满（最多 8 人）');
              if(p){Object.assign(p,playerFor(s,now));}else{p=playerFor(s,now);room.players.push(p);}
              room.lastActivity=now;
            }else{
              let nextCode;do{nextCode=String(randomInt(100000,1000000));}while(db.rooms[nextCode]);
              room=newRoom(nextCode,s,data.mode==='numbers'?'numbers':'icons',action==='practice',now);db.rooms[nextCode]=room;p=room.players[0];if(room.practice)startGame(room,now);
            }
            if(oldp&&old&&old!==room)quitGame(old,oldp,now);
            s.room=room.code;dirty=true;respond();return;
          }
          if(action==='buy'){
            const item=SHOP.find(x=>x.id===data.item);if(!item)throw new Error('装饰不存在');
            if(!s.owned.includes(item.id)){if(s.candy<item.cost)throw new Error('糖果还不够，完成对局来收集吧');s.candy-=item.cost;s.owned.push(item.id);}
            if(item.kind==='avatar')s.avatar=4;if(item.kind==='border')s.border=s.border===item.id?'':item.id;if(item.kind==='animation')s.animation=s.animation===item.id?'':item.id;
            dirty=true;json({session:sessionView(s),serverNow:now});return;
          }
          if(!room||!p)throw new Error('房间已解散，请重新加入');
          if(!p.active&&action!=='leave')throw new Error('你已离开本局');
          if(action==='ready'){
            if(room.status!=='waiting')throw new Error('本局已开始');p.ready=!p.ready;room.lastActivity=now;
          }else if(action==='mode'){
            if(room.status!=='waiting'||room.host!==s.id)throw new Error('仅房主可在等待时切换模式');room.mode=data.mode==='numbers'?'numbers':'icons';for(const other of room.players)other.ready=false;room.lastActivity=now;
          }else if(action==='start'){
            if(room.host!==s.id||room.status!=='waiting')throw new Error('仅房主可开始新局');startGame(room,now);
          }else if(action==='mark'){
            markItem(room,p,data.item,data.gameId,data.round,now);
          }else if(action==='emote'){
            if(!activeStatus(room.status)||!p.participant)throw new Error('开局后再和伙伴打招呼吧');
            if(now-(p.lastEmote||0)<5000)throw new Error('表情每 5 秒可发送一次');
            if(!Number.isInteger(data.emote)||data.emote<0||data.emote>3)throw new Error('请选择快捷表情');
            p.lastEmote=now;room.emotes=room.emotes.filter(e=>now-e.at<5000);room.emotes.push({id:randomBytes(4).toString('hex'),player:p.id,emote:data.emote,at:now});
          }else if(action==='kick'){
            if(room.host!==s.id||room.status!=='waiting'||data.player===s.id)throw new Error('只能由房主移出等待中的其他玩家');
            const other=room.players.find(x=>x.id===data.player&&x.active);if(!other)throw new Error('玩家已离开');quitGame(room,other,now);
          }else if(action==='return'){
            if(!['ended','aborted'].includes(room.status))throw new Error('对局尚未结束');
            if(room.practice)throw new Error('请从单人练习重新开始');
            room.players=room.players.filter(x=>x.active);for(const other of room.players)Object.assign(other,{ready:false,participant:false,card:[],marks:[-1],markRounds:[],reward:0});
            Object.assign(room,{status:'waiting',round:0,deck:[],deadline:0,lastActivity:now});
            if(!room.players.some(x=>x.id===room.host&&now-x.lastSeen<8000))room.host=room.players.find(x=>now-x.lastSeen<8000)?.id||s.id;
          }else if(action==='leave'){
            quitGame(room,p,now);settle(room);s.room=null;dirty=true;json({room:null,session:sessionView(s),serverNow:now});return;
          }else throw new Error('未知操作');
          dirty=true;respond();return;
        }
        return json({error:'接口不存在'},404);
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
      if(url.pathname==='/index.html') {res.writeHead(308,{Location:'/'+url.search});res.end();return;}
      if(url.pathname==='/robots.txt') {
        res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public,max-age=300'});res.end(req.method==='HEAD'?undefined:robotsTxt(siteUrl));return;
      }
      if(url.pathname==='/sitemap.xml') {
        if(!siteUrl){res.writeHead(404,{'X-Robots-Tag':'noindex'}).end('Sitemap unavailable until SITE_URL is configured');return;}
        res.writeHead(200,{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public,max-age=300'});res.end(req.method==='HEAD'?undefined:sitemapXml(siteUrl));return;
      }
      if(url.pathname==='/'||url.pathname==='/play') {
        const {html,robots}=pageHtml(await readFile(resolve(root,'index.html'),'utf8'),url,siteUrl);
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':robots});res.end(req.method==='HEAD'?undefined:html);return;
      }
      const pathname=decodeURIComponent(url.pathname);const parts=pathname.split(/[\\/]/);
      if(parts.some(x=>x.startsWith('.')||['upstream','logs','scripts','server','tests','node_modules'].includes(x))){res.writeHead(403).end('Forbidden');return;}
      let path=resolve(root,'.'+pathname);if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
      if((await stat(path)).isDirectory())path=resolve(path,'index.html');
      const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':pathname.startsWith('/assets/')?'public,max-age=3600':'no-store'});res.end(req.method==='HEAD'?undefined:data);
    }catch(error){if(req.url.startsWith('/api/'))json({error:error.message},400);else res.writeHead(error instanceof URIError?400:404).end('Not found');}
  });
  return {server,db,flush:async()=>{dirty=true;await flush();},close:async()=>{clearInterval(timer);await new Promise(r=>server.close(r));dirty=true;await flush();}};
}
