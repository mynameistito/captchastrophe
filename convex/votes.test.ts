// @vitest-environment edge-runtime
import { it, expect, vi, afterEach } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import schema from './schema';
import { wilsonLowerBound } from './ranking';
// Only the session lookup is substituted. Auth v2's real OAuth flow needs deployment credentials.
vi.mock('@convex-dev/auth/server',()=>({getAuthUserId:async(ctx:any)=>(await ctx.auth.getUserIdentity())?.subject ?? null}));
const modules={...import.meta.glob('./{votes,maintainer,bindings,ranking,schema}.ts'),'./_generated/marker.js':async()=>({})};
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
async function setup(age=10){
  const t=convexTest(schema,modules);
  const id=await t.run(async ctx=>{
    await ctx.db.insert('submissions',{id:'test-entry',title:'Fixture',status:'accepted',addedAt:new Date().toISOString(),up:0,down:0,top:0,trending:0});
    return ctx.db.insert('users',{githubId:'123',login:'test-user',githubCreatedAt:Date.now()-age*86400000,suspended:false,changes:[]});
  });
  return {t,id,user:t.withIdentity({subject:id})};
}
it('serializes duplicate concurrent votes, switches and removes without refreshing first activity',async()=>{
  const {t,user,id}=await setup();
  const results=await Promise.all(Array.from({length:8},()=>user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'})));
  expect(results.every(r=>r.ok)).toBe(true);
  const first=await t.run(ctx=>ctx.db.query('votes').unique());
  expect(await t.run(ctx=>ctx.db.query('submissions').unique())).toMatchObject({up:1,down:0});
  expect(await t.run(ctx=>ctx.db.get(id))).toMatchObject({changes:[first!.updatedAt]});
  await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'down'});
  expect(await t.run(ctx=>ctx.db.query('submissions').unique())).toMatchObject({up:0,down:1});
  await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:null});
  await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'});
  expect(await t.run(ctx=>ctx.db.query('votes').unique())).toMatchObject({firstVotedAt:first!.firstVotedAt});
  const before=await t.run(ctx=>ctx.db.query('votes').unique());
  await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'});
  expect(await t.run(ctx=>ctx.db.query('votes').unique())).toEqual(before);
});
it('rejects anonymous writes, unknown entries and client-supplied identity',async()=>{
  const {t,user}=await setup();
  expect(await t.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'})).toMatchObject({reason:'signed-out'});
  expect(await user.mutation(anyApi.votes.cast,{submissionId:'missing',direction:'up'})).toMatchObject({reason:'unknown-submission'});
  await expect(user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up',userId:'forged'})).rejects.toThrow();
});
it('enforces account age, pending verification, suspension and configurable rate limits',async()=>{
  const {t,user,id}=await setup(1);
  expect(await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'})).toMatchObject({reason:'account-too-new'});
  await t.run(ctx=>ctx.db.patch(id,{githubCreatedAt:undefined}));
  expect(await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'})).toMatchObject({reason:'eligibility-pending'});
  await t.run(ctx=>ctx.db.patch(id,{githubCreatedAt:Date.now()-10*86400000,suspended:true}));
  expect(await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'})).toMatchObject({reason:'suspended'});
  await t.run(ctx=>ctx.db.patch(id,{suspended:false}));
  vi.stubEnv('VOTE_MAX_CHANGES_PER_MINUTE','2');
  await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'});
  await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'down'});
  expect(await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:null})).toMatchObject({reason:'rate-limited'});
  vi.useFakeTimers();vi.setSystemTime(Date.now()+60001);
  expect(await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:null})).toMatchObject({ok:true});
});
it('requires maintainer authorization and corrects totals and ranking on invalidation',async()=>{
  const {t,user}=await setup();
  await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'});
  const args={githubId:'123',reason:'Test abuse cleanup',cursor:null};
  await expect(user.mutation(anyApi.maintainer.invalidate,args)).rejects.toThrow('Maintainer');
  vi.stubEnv('MAINTAINER_GITHUB_IDS','123');
  expect(await user.mutation(anyApi.maintainer.invalidate,args)).toMatchObject({count:1,isDone:true});
  expect(await t.run(ctx=>ctx.db.query('submissions').unique())).toMatchObject({up:0,down:0,top:0});
  expect(await t.run(ctx=>ctx.db.query('voteDays').unique())).toMatchObject({up:0,down:0});
  expect(await t.run(ctx=>ctx.db.query('audit').collect())).toHaveLength(1);
  expect(await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'})).toMatchObject({reason:'suspended'});
});
it('enforces the default ten changes and keeps old voters out of trending after toggles',async()=>{
  const {t,user}=await setup();
  for(let i=0;i<10;i++)expect(await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:i%2?'down':'up'})).toMatchObject({ok:true});
  expect(await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'})).toMatchObject({reason:'rate-limited'});
  vi.useFakeTimers();vi.setSystemTime(Date.now()+8*86400000);
  expect(await user.mutation(anyApi.votes.cast,{submissionId:'test-entry',direction:'up'})).toMatchObject({ok:true});
  const rankings=await t.query(anyApi.votes.rankings,{cursor:null});
  expect(rankings.page[0]).toMatchObject({up:1,down:0,trending:0});
});
it('does not let one approval beat established positive reception',()=>{
  expect(wilsonLowerBound(1,0)).toBeLessThan(wilsonLowerBound(100,10));
});
