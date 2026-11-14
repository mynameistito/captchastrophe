import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateArtifact} from '../.github/scripts/validate-artifact.ts';
it('accepts static files; rejects hosting config and symlinks',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'artifact-'));
  try{
    await fs.writeFile(path.join(dir,'index.html'),'<!doctype html>');
    expect(await validateArtifact(dir)).toMatchObject({files:1});
    await fs.writeFile(path.join(dir,'_worker.js'),'export default {}');
    await expect(validateArtifact(dir)).rejects.toThrow('Forbidden');
    await fs.unlink(path.join(dir,'_worker.js'));
    await fs.symlink('/etc/hosts',path.join(dir,'escape.js'));
    await expect(validateArtifact(dir)).rejects.toThrow('symlink');
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
