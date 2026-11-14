// Run only from reviewed main, never from a fork checkout. Uploads static assets only.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const accountSubdomain=process.env.CLOUDFLARE_WORKERS_SUBDOMAIN;
if(!accountSubdomain || !/^[a-z0-9-]+$/.test(accountSubdomain))throw new Error('Set CLOUDFLARE_WORKERS_SUBDOMAIN to the account workers.dev subdomain');
const preview=process.env.PREVIEW_PR;
if(preview && !/^[1-9][0-9]*$/.test(preview))throw new Error('Invalid PR number');
const productionHostname='captchastrophe.pcstyle.dev';
const siteName=preview?`cx-preview-${preview}`:'captchastrophe';
const siteOrigin=preview?`https://${siteName}.${accountSubdomain}.workers.dev`:`https://${productionHostname}`;
const index=JSON.parse(await fs.readFile('dist/site/data/index.json','utf8'));
const entryOrigins:Record<string,string>={};
const deployRoot=path.resolve('.deploy');await fs.mkdir(deployRoot,{recursive:true});
async function upload(name:string,directory:string){
  const cwd=path.join(deployRoot,name);
  await fs.mkdir(cwd,{recursive:true});
  const gallery=!preview && name===siteName;
  const config={worker:{name,compatibilityDate:'2026-11-14',workersDev:!gallery,...(gallery?{domains:[productionHostname]}:{})}};
  await fs.writeFile(path.join(cwd,'cloudflare.config.ts'),`import { defineConfig } from 'cf/config';\nexport default defineConfig(${JSON.stringify(config)});\n`);
  const args=[path.resolve('node_modules/cf/bin/cf'),'deploy',path.resolve(directory)];
  if(process.argv.includes('--dry-run'))args.push('--dry-run');
  execFileSync(process.execPath,args,{cwd,stdio:'inherit',timeout:120000});
}
for(const entry of index.entries){
  if (!preview && entry.status !== 'accepted') continue;
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id))throw new Error('Invalid ID');
  const name=`cx-${preview?'pr'+preview+'-':''}e-${createHash('sha256').update(entry.id).digest('hex').slice(0,16)}`;
  entryOrigins[entry.id]=`https://${name}.${accountSubdomain}.workers.dev`;
  if(process.argv.includes('--site-only'))continue;
  const dir=path.join('dist/play',entry.id);
  await fs.writeFile(path.join(dir,'_headers'),`/*\n  Content-Security-Policy: sandbox allow-scripts allow-same-origin; default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${siteOrigin}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Cross-Origin-Resource-Policy: cross-origin\n  Permissions-Policy: camera=(self), microphone=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self), fullscreen=(self), autoplay=(self), geolocation=()\n`);
  await upload(name,dir);entryOrigins[entry.id]=`https://${name}.${accountSubdomain}.workers.dev`;
}
await fs.writeFile('dist/site/data/config.json',JSON.stringify({entryOrigins,voting:!preview && !!process.env.VITE_CONVEX_URL}));
const origins=Object.keys(entryOrigins).length ? `https://*.${accountSubdomain}.workers.dev` : '';
await fs.writeFile('dist/site/_headers',`/*\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://avatars.githubusercontent.com; connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud; frame-src ${origins || "'none'"}; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n`);
await upload(siteName,'dist/site');
if(!preview){
  const redirectDir=path.join(deployRoot,'legacy-redirect-assets');
  await fs.mkdir(redirectDir,{recursive:true});
  await fs.writeFile(path.join(redirectDir,'_redirects'),`/* ${siteOrigin}/:splat 308\n`);
  await fs.writeFile(path.join(redirectDir,'index.html'),`<!doctype html><title>Moved</title><a href="${siteOrigin}">captchastrophe has moved</a>\n`);
  await upload('captchastrophe-site',redirectDir);
}
console.log((process.argv.includes('--dry-run')?'Dry-run gallery target: ':'Gallery: ')+siteOrigin);
if(!process.argv.includes('--dry-run') && process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`url=${siteOrigin}\n`);
if(!process.argv.includes('--dry-run') && !preview && process.env.CONVEX_SITE_URL && process.env.SYNC_TOKEN){
  for(let i=0;i<index.entries.length;i+=100){
    const response=await fetch(process.env.CONVEX_SITE_URL+'/sync/submissions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.SYNC_TOKEN},body:JSON.stringify({entries:index.entries.slice(i,i+100)}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Submission sync failed: '+response.status);
  }
  const reconciled=await fetch(process.env.CONVEX_SITE_URL+'/sync/submissions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.SYNC_TOKEN},body:JSON.stringify({liveIds:index.entries.map((e:{id:string})=>e.id)}),signal:AbortSignal.timeout(15000)});
  if(!reconciled.ok)throw new Error('Submission registry reconciliation failed: '+reconciled.status);
}
