import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './bindings';
import { direction } from './schema';
import { wilsonLowerBound, trendingFromCounts } from './ranking';
const DAY = 86400000;
export function threshold(name: string, fallback: number) { const raw = process.env[name]; const n = raw === undefined ? fallback : Number(raw); return Number.isSafeInteger(n) && n > 0 ? n : fallback; }
export async function adjustCounts(ctx: MutationCtx, submissionId: string, firstVotedAt: number, before: 'up'|'down'|null, after: 'up'|'down'|null) {
  const entry = await ctx.db.query('submissions').withIndex('by_stable_id', q=>q.eq('id',submissionId)).unique();
  if (!entry) throw new Error('Missing submission');
  const up = entry.up + Number(after === 'up') - Number(before === 'up');
  const down = entry.down + Number(after === 'down') - Number(before === 'down');
  if(up < 0 || down < 0) throw new Error('Invalid vote totals');
  await ctx.db.patch(entry._id,{up,down,top:wilsonLowerBound(up,down)});
  const day = Math.floor(firstVotedAt / DAY);
  const bucket = await ctx.db.query('voteDays').withIndex('by_submission_day',q=>q.eq('submissionId',submissionId).eq('day',day)).unique();
  const values = {up:(bucket?.up ?? 0)+Number(after==='up')-Number(before==='up'),down:(bucket?.down ?? 0)+Number(after==='down')-Number(before==='down')};
  if(bucket)await ctx.db.patch(bucket._id,values); else await ctx.db.insert('voteDays',{submissionId,day,...values});
}
export const cast = mutation({ args:{submissionId:v.string(),direction}, handler:async(ctx,args)=>{
  const id = await getAuthUserId(ctx);
  if(!id)return {ok:false as const,reason:'signed-out' as const};
  const user = await ctx.db.get(id);
  if(!user)return {ok:false as const,reason:'signed-out' as const};
  const entry = await ctx.db.query('submissions').withIndex('by_stable_id',q=>q.eq('id',args.submissionId)).unique();
  if(!entry || entry.status==='removed')return {ok:false as const,reason:'unknown-submission' as const};
  if(user.suspended)return {ok:false as const,reason:'suspended' as const};
  if(user.githubCreatedAt===undefined)return {ok:false as const,reason:'eligibility-pending' as const};
  const now = Date.now(), eligibleAt=user.githubCreatedAt+threshold('VOTE_MIN_ACCOUNT_AGE_DAYS',7)*DAY;
  if(eligibleAt>now)return {ok:false as const,reason:'account-too-new' as const,eligibleAt:new Date(eligibleAt).toISOString()};
  const vote = await ctx.db.query('votes').withIndex('by_user_submission',q=>q.eq('userId',id).eq('submissionId',args.submissionId)).unique();
  if(vote?.voided)return {ok:false as const,reason:'suspended' as const};
  if((vote?.direction ?? null)===args.direction)return {ok:true as const,vote:args.direction};
  const changes=user.changes.filter(t=>t>now-60000);
  if(changes.length>=threshold('VOTE_MAX_CHANGES_PER_MINUTE',10))return {ok:false as const,reason:'rate-limited' as const,retryAfterMs:changes[0]+60000-now};
  await ctx.db.patch(id,{changes:[...changes,now]});
  await adjustCounts(ctx,args.submissionId,vote?.firstVotedAt ?? now,vote?.direction ?? null,args.direction);
  if(vote)await ctx.db.patch(vote._id,{direction:args.direction,updatedAt:now});
  else await ctx.db.insert('votes',{userId:id,submissionId:args.submissionId,direction:args.direction,firstVotedAt:now,updatedAt:now,voided:false});
  return {ok:true as const,vote:args.direction};
}});
export const mine = query({ args:{submissionId:v.string()},handler:async(ctx,args)=>{
  const id=await getAuthUserId(ctx); if(!id)return null;
  return (await ctx.db.query('votes').withIndex('by_user_submission',q=>q.eq('userId',id).eq('submissionId',args.submissionId)).unique())?.direction ?? null;
}});
export const rankings = query({args:{cursor:v.union(v.string(),v.null())},handler:async(ctx,args)=>{
  const result=await ctx.db.query('submissions').paginate({cursor:args.cursor,numItems:50});
  const day=Math.floor(Date.now()/DAY);
  const page=await Promise.all(result.page.filter(e=>e.status!=='removed').map(async e=>{
    const buckets=await ctx.db.query('voteDays').withIndex('by_submission_day',q=>q.eq('submissionId',e.id).gte('day',day-6).lte('day',day)).collect();
    const up=buckets.reduce((n,b)=>n+b.up,0),down=buckets.reduce((n,b)=>n+b.down,0);
    return {id:e.id,up:e.up,down:e.down,top:e.top,trending:trendingFromCounts(up,down),addedAt:e.addedAt,status:e.status};
  }));
  return {...result,page};
}});
