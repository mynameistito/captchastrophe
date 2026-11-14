import { httpRouter, anyApi } from 'convex/server';
import { httpAction } from './bindings';
const http=httpRouter();
http.route({path:'/sync/submissions',method:'POST',handler:httpAction(async(ctx,request)=>{
  const secret=process.env.SYNC_TOKEN;
  if(!secret || secret.length<32)return new Response('Sync not configured',{status:503});
  const offered=request.headers.get('Authorization')?.replace(/^Bearer /,'') ?? '';
  const hash=async(text:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
  const a=await hash(secret),b=await hash(offered);let mismatch=0;
  for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];
  if(mismatch)return new Response('Unauthorized',{status:401});
  const reader=request.body?.getReader();if(!reader)return new Response('No body',{status:400});
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();return new Response('Too large',{status:413});}chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
  try {
    const body=JSON.parse(new TextDecoder().decode(data));
    if(Array.isArray(body.liveIds)) {
      await ctx.runMutation(anyApi.submissions.reconcile,{liveIds:body.liveIds});
      return Response.json({reconciled:true});
    }
    const entries=body.entries.map((e:Record<string,unknown>)=>({id:e.id,title:e.title,status:e.status,addedAt:e.addedAt}));
    const result=await ctx.runMutation(anyApi.submissions.sync,{entries});
    return Response.json(result);
  } catch {return new Response('Invalid sync request',{status:400});}
})});
export default http;
