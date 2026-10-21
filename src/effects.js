import {engineInit,vec2,rgb,drawCircle,drawTile,tile,getCameraSize,setCanvasMaxSize,setShowSplashScreen,setTouchGamepadEnable,setTouchInputEnable,setInputPreventDefault,Sound,time,timeDelta} from '../vendor/littlejs/littlejs.esm.min.js';
let reduced=false,muted=false,burst=0,particles=[];
const chimes={call:new Sound([.15,0,640,.01,.08,.16,1,1.2]),mark:new Sound([.10,0,900,.002,.025,.07,0,1.4]),line:new Sound([.14,0,440,.01,.12,.24,1,1.6,6]),win:new Sound([.18,0,530,.02,.26,.5,1,1.6,8]),event:new Sound([.10,0,220,.01,.12,.2,0,1.1])};
export function configureEffects(settings){reduced=settings.reduced;muted=!settings.sound;}
export function effect(type){if(!muted)try{chimes[type.startsWith('event')?'event':type]?.play();}catch{}if(type==='win')burst=1;if(type==='event1'&&!reduced){const width=getCameraSize().x;for(let i=0;i<20;i++)particles.push({x:(i%2?1:-1)*(width/2-.4-Math.random()*.6),y:7+Math.random()*3,vx:0,vy:-3-Math.random()*2,life:3,candy:true});}}
function update(){
  if(reduced){particles=[];burst=0;return;}
  if(burst){for(let i=0;i<48;i++)particles.push({x:(Math.random()-.5)*22,y:7,vx:(Math.random()-.5)*2,vy:-1-Math.random()*2,life:5,color:Math.random()<.5?rgb(1,.59,.18,.65):rgb(.75,.55,1,.5)});burst=0;}
  particles=particles.filter(p=>(p.life-=timeDelta)>0);for(const p of particles){p.x+=p.vx*timeDelta;p.y+=p.vy*timeDelta;}
}
function render(){
  if(!reduced)for(let i=0;i<18;i++){const x=Math.sin(i*13.1)*12,y=((time*.08+i*.71)%15)-7.5;drawCircle(vec2(x,y),.025+.02*Math.sin(time+i)**2,rgb(1,.72,.3,.28));}
  for(const p of particles)if(p.candy)drawTile(vec2(p.x,p.y),vec2(.65),tile(10,256));else drawCircle(vec2(p.x,p.y),.07,p.color);
}
setShowSplashScreen(false);setCanvasMaxSize(vec2(4096,4096));setTouchGamepadEnable(false);setTouchInputEnable(false);setInputPreventDefault(false);
engineInit(()=>{},update,()=>{},render,()=>{},['/assets/symbols.webp'],document.getElementById('ambient')).catch(console.error);
