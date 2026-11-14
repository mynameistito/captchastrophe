// Metadata only. Never check out, import or execute a PR branch.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {manifestSchema} from '../../scripts/manifest.ts';
const repo='pc-style/captchastrophe';
function api(route:string){return JSON.parse(execFileSync('gh',['api',route],{encoding:'utf8',maxBuffer:8*1024*1024}));}
const entries=[];
for(let page=1;;page++){
  const prs=api(`repos/${repo}/pulls?state=open&per_page=100&page=${page}`);
  for(const pr of prs){
    const ids=new Set<string>();
    for(let n=1;;n++){
      const files=api(`repos/${repo}/pulls/${pr.number}/files?per_page=100&page=${n}`);
      for(const f of files){const m=/^submissions\/([a-z0-9]+(?:-[a-z0-9]+)*)\//.exec(f.filename);if(m)ids.add(m[1]);}
      if(files.length<100)break;
      if(n>=30)throw new Error('PR file pagination limit reached');
    }
    for(const id of ids){
      try {
        const file=api(`repos/${pr.head.repo.full_name}/contents/submissions/${id}/manifest.json?ref=${pr.head.sha}`);
        if(file.type!=='file'||file.size>10000)throw new Error('Manifest too large');
        const manifest=manifestSchema.parse(JSON.parse(Buffer.from(file.content,'base64').toString('utf8')));
        if(manifest.id!==id)throw new Error('ID mismatch');
        entries.push({...manifest,status:'pre-review',prNumber:pr.number,addedAt:pr.created_at,sourceUrl:`https://github.com/${pr.head.repo.full_name}/tree/${pr.head.sha}/submissions/${id}`});
      }catch{console.warn(`Skipped invalid/inaccessible metadata: PR ${pr.number}, ${id}`);}
    }
  }
  if(prs.length<100)break;
  if(page>=100)throw new Error('PR pagination limit reached');
}
await fs.mkdir('.preview',{recursive:true});await fs.writeFile('.preview/open.json',JSON.stringify({entries}));
console.log(`Read ${entries.length} valid pre-review manifests. No code executed.`);
