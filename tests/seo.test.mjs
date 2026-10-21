import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.mjs';
import {normalizeSiteUrl} from '../server/seo.mjs';

async function serve(t,siteUrl='https://bingo.example.test') {
  const app=await createApp({storeFile:null,siteUrl});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(()=>app.close());
  return {app,base:`http://127.0.0.1:${app.server.address().port}`};
}

test('首页原始HTML包含玩法正文与正确分享元数据，不需要执行脚本或创建身份',async t=>{
  const {app,base}=await serve(t);
  const response=await fetch(base),html=await response.text();
  assert.equal(response.status,200);assert.equal(response.headers.get('x-robots-tag'),'index,follow');
  assert.match(html,/<h1>Halloween Bingo 万圣节宾果在线游戏<\/h1>/);
  assert.match(html,/经典 1–75 数字 Bingo/);assert.match(html,/24 种万圣图案 Bingo/);assert.match(html,/开奖后会自动帮我标记吗/);
  assert.match(html,/<link rel="canonical" href="https:\/\/bingo\.example\.test\/">/);
  assert.match(html,/<meta property="og:image" content="https:\/\/bingo\.example\.test\/assets\/social-preview\.png">/);
  assert.deepEqual(app.db.sessions,{});
  const head=await fetch(base,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  const redirect=await fetch(base+'/index.html?room=123456',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/?room=123456');
});

test('游戏、邀请和旧房间链接在初始HTTP响应中禁止收录，不暴露房间为规范网址',async t=>{
  const {base}=await serve(t);
  for(const path of ['/play','/play?room=123456','/?room=123456','/?room=']){
    const response=await fetch(base+path),html=await response.text();
    assert.equal(response.status,200);assert.equal(response.headers.get('x-robots-tag'),'noindex,follow');
    assert.match(html,/<meta name="robots" content="noindex,follow">/);assert.match(html,/<body data-private="true">/);
    assert.doesNotMatch(html,/rel="canonical"/);assert.match(html,/<meta property="og:url" content="https:\/\/bingo\.example\.test\/">/);
  }
  const api=await fetch(base+'/api/state');assert.equal(api.status,401);assert.equal(api.headers.get('x-robots-tag'),'noindex');
});

test('robots允许抓取房间的noindex，站点地图只列公开首页，分享封面可访问',async t=>{
  const {base}=await serve(t);
  const robots=await(await fetch(base+'/robots.txt')).text();
  assert.match(robots,/Disallow: \/api\//);assert.doesNotMatch(robots,/Disallow: (\/play|.*room)/);
  assert.match(robots,/Sitemap: https:\/\/bingo\.example\.test\/sitemap\.xml/);
  const map=await fetch(base+'/sitemap.xml'),xml=await map.text();
  assert.match(map.headers.get('content-type'),/application\/xml/);assert.match(xml,/<loc>https:\/\/bingo\.example\.test\/<\/loc>/);
  assert.equal((xml.match(/<loc>/g)||[]).length,1);assert.doesNotMatch(xml,/play|room|api/);
  const image=await fetch(base+'/assets/social-preview.png');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
});

test('未设置域名不伪造canonical或站点地图，不信任请求Host生成公开网址',async t=>{
  const {base}=await serve(t,'');
  const response=await fetch(base,{headers:{Host:'untrusted.example'}}),html=await response.text();
  assert.doesNotMatch(html,/rel="canonical"|property="og:url"|property="og:image"|untrusted\.example/);
  assert.equal((await fetch(base+'/sitemap.xml')).status,404);
  assert.doesNotMatch(await(await fetch(base+'/robots.txt')).text(),/Sitemap:/);
});

test('SITE_URL仅接受HTTP(S)根地址，拒绝凭据、路径和查询参数',()=>{
  assert.equal(normalizeSiteUrl(''),'');assert.equal(normalizeSiteUrl('https://bingo.example.test'),'https://bingo.example.test/');
  for(const value of ['file:///tmp/','https://a.example/path','https://user:secret@a.example/','https://a.example/?room=123456','https://a.example/#x'])assert.throws(()=>normalizeSiteUrl(value));
});
