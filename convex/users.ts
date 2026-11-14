import { getAuthUserId } from '@convex-dev/auth/server';
import { vGithubProfile } from '@convex-dev/auth/methods/github/server';
import { anyApi } from 'convex/server';
import { v } from 'convex/values';
import { internalMutation, internalAction, query } from './bindings';
export const createUser = internalMutation({args:{method:v.object({name:v.literal('github'),profile:vGithubProfile})},returns:v.id('users'),handler:async(ctx,{method})=>{
  const p=method.profile;
  const existing=await ctx.db.query('users').withIndex('by_github',q=>q.eq('githubId',p.id)).unique();
  if(existing)return existing._id;
  const id=await ctx.db.insert('users',{githubId:p.id,login:p.login,avatarUrl:p.avatarUrl,suspended:false,changes:[]});
  await ctx.scheduler.runAfter(0,anyApi.users.fetchAccountAge,{userId:id,githubId:p.id});
  return id;
}});
export const onSignIn = internalMutation({args:{method:v.object({name:v.literal('github'),profile:vGithubProfile}),userId:v.id('users')},returns:v.null(),handler:async(ctx,args)=>{
  const u=await ctx.db.get(args.userId); if(!u || u.githubId!==args.method.profile.id)throw new Error('Identity mismatch');
  await ctx.db.patch(u._id,{login:args.method.profile.login,avatarUrl:args.method.profile.avatarUrl});
  if(u.githubCreatedAt===undefined)await ctx.scheduler.runAfter(0,anyApi.users.fetchAccountAge,{userId:u._id,githubId:u.githubId});
  return null;
}});
export const fetchAccountAge=internalAction({args:{userId:v.id('users'),githubId:v.string()},handler:async(ctx,args)=>{
  if(!/^\d+$/.test(args.githubId))throw new Error('Invalid GitHub ID');
  const headers:Record<string,string>={Accept:'application/vnd.github+json','User-Agent':'captchastrophe'};
  if(process.env.GITHUB_API_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_API_TOKEN;
  const response=await fetch('https://api.github.com/user/'+args.githubId,{headers,signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('GitHub account lookup failed: '+response.status);
  const data=await response.json(); const createdAt=Date.parse(data.created_at);
  if(String(data.id)!==args.githubId || !Number.isFinite(createdAt) || createdAt>Date.now())throw new Error('Invalid GitHub account response');
  await ctx.runMutation(anyApi.users.setAccountAge,{...args,createdAt});
}});
export const setAccountAge=internalMutation({args:{userId:v.id('users'),githubId:v.string(),createdAt:v.number()},handler:async(ctx,args)=>{
  const u=await ctx.db.get(args.userId); if(!u || u.githubId!==args.githubId)throw new Error('Identity mismatch');
  await ctx.db.patch(u._id,{githubCreatedAt:args.createdAt});
}});
export const current=query({args:{},handler:async ctx=>{
  const id=await getAuthUserId(ctx); const u=id?await ctx.db.get(id):null;
  return u?{login:u.login,avatarUrl:u.avatarUrl}:null;
}});
