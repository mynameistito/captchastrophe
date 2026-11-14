import fs from 'node:fs/promises';
import path from 'node:path';
const allowed=new Set(['.html','.js','.css','.json','.png','.jpg','.jpeg','.webp','.gif','.svg','.woff','.woff2','.ttf','.ogg','.mp3','.wav','.mp4','.webm','.wasm']);
export async function validateArtifact(root:string){
  let files=0,bytes=0;
  async function walk(dir:string){
    for(const e of await fs.readdir(dir,{withFileTypes:true})){
      if(e.name.startsWith('.')||e.name.startsWith('_')||/^(wrangler|package|pnpm|yarn|bun)(\.|-)/.test(e.name))throw new Error('Forbidden artifact path: '+e.name);
      const full=path.join(dir,e.name),stat=await fs.lstat(full);
      if(stat.isSymbolicLink())throw new Error('Artifact symlink');
      if(stat.isDirectory())await walk(full);
      else if(stat.isFile()){
        if(!allowed.has(path.extname(e.name))||stat.size>2*1024*1024)throw new Error('Invalid artifact file: '+e.name);
        files++;bytes+=stat.size;
        if(files>2000||bytes>50*1024*1024)throw new Error('Artifact budget exceeded');
      }else throw new Error('Non-regular artifact file');
    }
  }
  await walk(root);return {files,bytes};
}
if(import.meta.main){
  const root=path.resolve('downloaded');console.log(await validateArtifact(root));
  const provenance=JSON.parse(await fs.readFile('.preview/provenance.json','utf8'));
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provenance.id))throw new Error('Invalid entry ID');
  await fs.rm('dist/play',{recursive:true,force:true});await fs.mkdir('dist/play',{recursive:true});
  const entry=path.join(root,provenance.id);
  for(const file of ['index.html','runtime.js','entry.js','runtime.css'])await fs.access(path.join(entry,file));
  await fs.cp(entry,path.join('dist/play',provenance.id),{recursive:true});
  await fs.mkdir('dist/site/data',{recursive:true});await fs.copyFile('.preview/index.json','dist/site/data/index.json');
}
