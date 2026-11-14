import { execFileSync } from 'node:child_process';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw new Error('Cloudflare access is missing');
const base=`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts`;
const headers={Authorization:'Bearer '+token};
const response=await fetch(base,{headers});if(!response.ok)throw new Error('Cannot list preview Workers: '+response.status);
const body=await response.json();if(!body.success)throw new Error('Cloudflare rejected worker listing');
const states=new Map<string,string>();
for(const worker of body.result){
  const match=/^cx-(?:preview-([1-9][0-9]*)|pr([1-9][0-9]*)-e-[a-f0-9]{16})$/.exec(worker.id);if(!match)continue;
  const number=match[1]??match[2];
  if(!states.has(number))states.set(number,JSON.parse(execFileSync('gh',['api',`repos/pc-style/captchastrophe/pulls/${number}`],{encoding:'utf8'})).state);
  if(states.get(number)!=='closed')continue;
  const deleted=await fetch(base+'/'+worker.id,{method:'DELETE',headers});
  if(!deleted.ok)throw new Error('Failed deleting preview '+worker.id);
  console.log('Deleted '+worker.id);
}
