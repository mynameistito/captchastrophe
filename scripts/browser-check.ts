import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const profile = await fs.mkdtemp(path.join(os.tmpdir(),'captchastrophe-chrome-'));
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url!, 'http://localhost');
    let target = path.resolve('dist', '.' + decodeURIComponent(url.pathname));
    if (!target.startsWith(path.resolve('dist') + '/')) throw new Error('Invalid path');
    if ((await fs.stat(target)).isDirectory()) target = path.join(target,'index.html');
    const ext = path.extname(target);
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.ttf':'font/ttf'} as Record<string,string>)[ext] ?? 'application/octet-stream');
    res.end(await fs.readFile(target));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise<void>(r => server.listen(0,'127.0.0.1',r));
const port = (server.address() as {port:number}).port;
const playServer=createServer(async(req,res)=>{try{const url=new URL(req.url!,'http://localhost');let file=path.resolve('dist/play/wiring','.'+url.pathname);if(!file.startsWith(path.resolve('dist/play/wiring')))throw new Error();if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'} as Record<string,string>)[path.extname(file)]??'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise<void>(r=>playServer.listen(0,'127.0.0.1',r));
const playPort=(playServer.address() as {port:number}).port;
const savedIndex=await fs.readFile('dist/site/data/index.json');
const savedConfig=await fs.readFile('dist/site/data/config.json');
const child = spawn(process.env.CHROME_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome'), [...(process.env.CI ? ['--no-sandbox'] : []), '--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let socket: WebSocket | undefined;
try {
  let debugPort = '';
  for(let i=0;i<100;i++){ try { debugPort = (await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]; break; } catch { await new Promise(r=>setTimeout(r,100)); } }
  if(!debugPort) throw new Error('Chrome did not start');
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json() as {webSocketDebuggerUrl:string}[];
  socket = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise<void>(r=>socket!.addEventListener('open',()=>r(),{once:true}));
  let id=0; const pending = new Map<number,{resolve:(x:any)=>void,reject:(e:any)=>void}>();
  socket.onmessage = e => { const m=JSON.parse(String(e.data)); const p=pending.get(m.id); if(p){ pending.delete(m.id); m.error?p.reject(m.error):p.resolve(m.result); } };
  const send = (method:string,params:Record<string,unknown>={}) => new Promise<any>((resolve,reject)=>{ const n=++id; pending.set(n,{resolve,reject}); socket!.send(JSON.stringify({id:n,method,params})); });
  const evaluate = async(expression:string) => { const r = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const wait = async(expression:string) => { for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Timed out: '+expression); };
  await send('Page.enable');
  for(const fixture of ['wiring','wiring-js']) {
    await send('Page.navigate',{url:`http://127.0.0.1:${port}/play/${fixture}/?theme=dark`});
    await wait('!!document.querySelector(".cx-mount button")');
    assert.equal(await evaluate('document.documentElement.dataset.theme'),'dark');
    assert.equal(await evaluate('document.querySelector(".cx-primary").disabled'),true);
    await evaluate('document.querySelector(".cx-mount button").click()');
    assert.equal(await evaluate('document.querySelector(".cx-primary").disabled'),false);
    await evaluate('window.oldLog=window.__wiringLog; document.querySelector(".cx-primary").click()');
    assert.equal(await evaluate('document.querySelector(".cx-shell").dataset.view'),'success');
    assert.deepEqual(await evaluate('window.oldLog'),['mounted','aborted','cleanup']);
    await evaluate('document.querySelector(".cx-success button").click()');
    await wait('!!document.querySelector(".cx-mount button")');
    assert.equal(await evaluate('document.querySelector(".cx-primary").disabled'),true);
    console.log('PASS '+fixture+': mount, success, Continue, cleanup, abort, reset, dark theme');
  }
  await send('Browser.setPermission',{permission:{name:'camera'},setting:'denied',origin:`http://127.0.0.1:${port}`});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/play/wiring-capability/?theme=light`});
  await wait('document.querySelector(".cx-mount button")?.textContent === "Request camera"');
  await evaluate('document.querySelector(".cx-mount button").click()');
  await wait('document.querySelector(".cx-notice")?.hidden === false');
  assert.match(await evaluate('document.querySelector(".cx-notice").textContent'), /denied|blocked|permission/i);
  assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
  console.log('PASS capability: explicit camera denial produces a visible state; light theme');
  const manifest=JSON.parse(await fs.readFile('fixtures/wiring/manifest.json','utf8'));
  await fs.writeFile('dist/site/data/index.json',JSON.stringify({entries:[{...manifest,status:'accepted',addedAt:new Date().toISOString()}]}));
  await fs.writeFile('dist/site/data/config.json',JSON.stringify({voting:false,entryOrigins:{wiring:`http://127.0.0.1:${playPort}`}}));
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/site/#/e/wiring`});
  await wait('document.querySelector(".stage button")?.textContent === "Launch"');
  assert.equal(await evaluate('document.querySelector("iframe")'),null);
  assert.equal(await evaluate('document.querySelector(".vote-sec").hidden'),true);
  await evaluate('sessionStorage.setItem("boundary-probe","private"); document.querySelector(".stage button").click()');
  await wait('document.querySelector(".frame-status")?.textContent.startsWith("Running.")');
  const tree=await send('Page.getFrameTree');
  const world=await send('Page.createIsolatedWorld',{frameId:tree.frameTree.childFrames[0].frame.id,worldName:'boundary-test'});
  const probe=await send('Runtime.evaluate',{contextId:world.executionContextId,expression:'JSON.stringify({own:sessionStorage.getItem("boundary-probe"),parent:(()=>{try{return parent.sessionStorage.getItem("boundary-probe")}catch{return "blocked"}})(),dom:(()=>{try{return parent.document.title}catch{return "blocked"}})(),nav:(()=>{try{parent.location.href="https://example.invalid/";return "allowed"}catch{return "blocked"}})()})',returnByValue:true});
  assert.deepEqual(JSON.parse(probe.result.value),{own:null,parent:'blocked',dom:'blocked',nav:'blocked'});
  assert.equal(await evaluate('document.querySelector(".vote-sec").hidden'),false);
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent === "Exit captcha").click()');
  assert.equal(await evaluate('document.querySelector("iframe")'),null);
  console.log('PASS real iframe: deliberate launch, vote UI after launch, cross-origin session/DOM and top navigation blocked, Exit removes frame');
  await fs.writeFile('dist/site/data/index.json',JSON.stringify({entries:[]}));await fs.writeFile('dist/site/data/config.json',JSON.stringify({voting:false,entryOrigins:{}}));
  await fs.mkdir('design/evidence',{recursive:true});
  for(const width of [1280,390]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:`http://127.0.0.1:${port}/site/`});
    await wait('document.body?.textContent.includes("Nothing accepted yet.")');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
    for(const theme of ['light','dark']) {
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
      const image = await send('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(`design/evidence/gallery-${width}-${theme}.png`,Buffer.from(image.data,'base64'));
    }
    console.log('PASS gallery '+width+': empty state, no horizontal overflow, light/dark screenshots');
  }
} finally { await fs.writeFile('dist/site/data/index.json',savedIndex);await fs.writeFile('dist/site/data/config.json',savedConfig); socket?.close(); child.kill(); server.close(); playServer.close(); await new Promise(r=>setTimeout(r,500)); await fs.rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200}); }
