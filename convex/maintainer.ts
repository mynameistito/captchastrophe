import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query, type QueryCtx, type MutationCtx } from './bindings';
import { adjustCounts } from './votes';
export async function requireMaintainer(ctx: QueryCtx | MutationCtx) {
  const id=await getAuthUserId(ctx); const u=id?await ctx.db.get(id):null;
  const allowed=(process.env.MAINTAINER_GITHUB_IDS ?? '').split(',').map(s=>s.trim());
  if(!u || u.suspended || !allowed.includes(u.githubId))throw new Error('Maintainer access required');
  return u;
}
export const suspend=mutation({args:{githubId:v.string(),suspended:v.boolean(),reason:v.string()},handler:async(ctx,args)=>{
  const actor=await requireMaintainer(ctx); if(!args.reason.trim() || args.reason.length>500)throw new Error('Give a short reason');
  const u=await ctx.db.query('users').withIndex('by_github',q=>q.eq('githubId',args.githubId)).unique();if(!u)throw new Error('Unknown account');
  await ctx.db.patch(u._id,{suspended:args.suspended});
  await ctx.db.insert('audit',{actor:actor.githubId,action:args.suspended?'suspend':'unsuspend',target:args.githubId,reason:args.reason,at:Date.now()});
}});
export const invalidate=mutation({args:{githubId:v.string(),submissionId:v.optional(v.string()),reason:v.string(),cursor:v.union(v.string(),v.null())},handler:async(ctx,args)=>{
  const actor=await requireMaintainer(ctx);if(!args.reason.trim()||args.reason.length>500)throw new Error('Give a short reason');
  const user=await ctx.db.query('users').withIndex('by_github',q=>q.eq('githubId',args.githubId)).unique();if(!user)throw new Error('Unknown account');
  const batch=await ctx.db.query('votes').withIndex('by_user',q=>q.eq('userId',user._id)).paginate({cursor:args.cursor,numItems:100});
  let count=0;
  for(const vote of batch.page){if(vote.voided || args.submissionId && vote.submissionId!==args.submissionId)continue;
    if(vote.direction)await adjustCounts(ctx,vote.submissionId,vote.firstVotedAt,vote.direction,null);
    await ctx.db.patch(vote._id,{direction:null,voided:true,updatedAt:Date.now()});count++;
  }
  await ctx.db.insert('audit',{actor:actor.githubId,action:'invalidate '+count,target:args.githubId+(args.submissionId?'/'+args.submissionId:''),reason:args.reason,at:Date.now()});
  return {count,cursor:batch.continueCursor,isDone:batch.isDone};
}});
export const bursts=query({args:{cursor:v.union(v.string(),v.null())},handler:async(ctx,args)=>{
  await requireMaintainer(ctx);
  const batch=await ctx.db.query('users').paginate({cursor:args.cursor,numItems:100});
  return {...batch,page:batch.page.map(u=>({githubId:u.githubId,login:u.login,suspended:u.suspended,recentChanges:u.changes.filter(t=>t>Date.now()-60000).length})).filter(u=>u.recentChanges>=5 || u.suspended)};
}});
