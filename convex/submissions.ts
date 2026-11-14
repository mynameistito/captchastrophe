import { v } from 'convex/values';
import { internalMutation } from './bindings';
export const sync=internalMutation({args:{entries:v.array(v.object({id:v.string(),title:v.string(),status:v.union(v.literal('accepted'),v.literal('pre-review'),v.literal('removed')),addedAt:v.string()}))},handler:async(ctx,args)=>{
  if(args.entries.length>100)throw new Error('Sync at most 100 entries per request');
  for(const entry of args.entries){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)||entry.id.length<3||entry.id.length>40||entry.title.length>60||!Number.isFinite(Date.parse(entry.addedAt)))throw new Error('Invalid entry metadata');
    const existing=await ctx.db.query('submissions').withIndex('by_stable_id',q=>q.eq('id',entry.id)).unique();
    if(existing)await ctx.db.patch(existing._id,{title:entry.title,status:entry.status});
    else await ctx.db.insert('submissions',{...entry,up:0,down:0,top:0,trending:0});
  }
  return {synced:args.entries.length};
}});
export const reconcile=internalMutation({args:{liveIds:v.array(v.string())},handler:async(ctx,args)=>{
  if(args.liveIds.length>1000)throw new Error('Registry capacity exceeded');
  const live=new Set(args.liveIds);
  const rows=await ctx.db.query('submissions').take(1001);
  if(rows.length>1000)throw new Error('Registry reconciliation needs pagination before expanding past 1000 IDs');
  for(const row of rows)if(!live.has(row.id)&&row.status!=='removed')await ctx.db.patch(row._id,{status:'removed'});
  return null;
}});
