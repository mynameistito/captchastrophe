import { expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { manifestSchema } from './manifest.ts';
import { validateDirectory } from './validate.ts';
const valid = JSON.parse(fs.readFileSync('fixtures/wiring/manifest.json', 'utf8'));
it('accepts the neutral fixture; rejects status, traversal and unknown capabilities', () => {
  expect(manifestSchema.safeParse(valid).success).toBe(true);
  for (const change of [{ status:'accepted' }, {entry:'../entry.ts'}, {entry:'https://evil.test/x.js'}, {capabilities:['geolocation']}]) expect(manifestSchema.safeParse({...valid,...change}).success).toBe(false);
});
it('enforces filesystem boundaries and package policy', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'captcha-test-'));
  try {
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(valid));
    fs.writeFileSync(path.join(dir,'entry.ts'),'export default () => {}');
    expect(validateDirectory(dir,{requireDirName:false}).errors).toEqual([]);
    expect(validateDirectory(dir).errors.join(' ')).toContain('directory name');
    fs.writeFileSync(path.join(dir,'package.json'),'{}');
    expect(validateDirectory(dir,{requireDirName:false}).errors.join(' ')).toContain('package.json');
    fs.unlinkSync(path.join(dir,'package.json'));
    fs.writeFileSync(path.join(dir,'entry.ts'),'import "https://evil.test/x.js"');
    expect(validateDirectory(dir,{requireDirName:false}).errors.join(' ')).toContain('remote import');
    fs.symlinkSync('/etc/hosts',path.join(dir,'escape'));
    expect(validateDirectory(dir,{requireDirName:false}).errors.join(' ')).toContain('symlinks');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
