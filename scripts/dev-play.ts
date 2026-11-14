import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildEntry } from './build-play.ts';
const args=process.argv.slice(2);
const dir=args[0]==='--dir'?args[1]:args[0]?path.join('submissions',args[0]):undefined;
if(!dir)throw new Error('Usage: node scripts/dev-play.ts <id> OR --dir template/ts');
const output=path.resolve('.dev-play');await fs.rm(output,{recursive:true,force:true});
await buildEntry(path.resolve(dir),output,args[0]==='--dir');
const files=createServer(async(req,res)=>{
  try {const u=new URL(req.url!,'http://127.0.0.1');let file=path.resolve(output,'.'+decodeURIComponent(u.pathname));if(file!==output&&!file.startsWith(output+'/'))throw new Error('Path');if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'} as Record<string,string>)[path.extname(file)]??'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end('Not found');}
});
const parent=createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local captcha wiring</title><style>body{font:16px system-ui;margin:24px}button{padding:12px;margin:4px}iframe{width:100%;height:600px;border:1px solid #888}nav{position:sticky;top:0;background:white}</style><nav><button id="launch">Launch</button><button id="reset">Reset</button><button id="exit">Exit</button><button id="theme">Theme</button><button id="mute">Mute</button></nav><p id="status" role="status">Local development. No voting or account data.</p><div id="stage"></div><script>
let frame, dark=false, muted=false;const origin='http://127.0.0.1:5174';
function send(m){frame?.contentWindow.postMessage({v:1,...m},origin)}
document.querySelector('#launch').onclick=()=>{frame?.remove();frame=document.createElement('iframe');frame.title='Local captcha';frame.sandbox='allow-scripts allow-same-origin';frame.allow='camera '+origin+'; microphone '+origin+'; fullscreen '+origin;frame.src=origin+'/?theme='+(dark?'dark':'light');document.querySelector('#stage').append(frame)};
document.querySelector('#reset').onclick=()=>send({type:'reset'});
document.querySelector('#exit').onclick=()=>{frame?.remove();frame=null;document.querySelector('#status').textContent='Exited'};
document.querySelector('#theme').onclick=()=>{dark=!dark;send({type:'theme',theme:dark?'dark':'light'})};
document.querySelector('#mute').onclick=()=>{muted=!muted;send({type:'mute',muted})};
onmessage=e=>{if(e.source===frame?.contentWindow&&e.origin===origin)document.querySelector('#status').textContent=JSON.stringify(e.data)};
</script></html>`);});
files.listen(5174,'127.0.0.1');parent.listen(5175,'127.0.0.1');
console.log('Play at http://127.0.0.1:5175. Restart this command after edits. Ctrl-C exits.');
for(const server of [files,parent])server.on('error',e=>{console.error(e);process.exitCode=1;files.close();parent.close();});
process.on('SIGINT',()=>{files.close();parent.close();});
