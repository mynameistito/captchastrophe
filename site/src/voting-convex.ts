import { ConvexClient, ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { AuthClient } from '@convex-dev/auth/browser';
import type { Voting, Ranking, VoteResult } from './voting.ts';

export function createConvexVoting(url: string): Voting {
  const client = new ConvexClient(url);
  const publicClient = new ConvexHttpClient(url);
  const listeners = new Set<() => void>();
  let available = true;
  let user: { login: string; avatarUrl?: string } | null = null;
  const stateKey = 'captchastrophe-oauth:' + url;
  const auth = new AuthClient({ mode: 'spa', storage: sessionStorage, storageNamespace: url, authApi: {
    refreshSession: token => publicClient.mutation(anyApi.auth.refreshSession, { refreshToken: token }),
    signOut: async token => { await publicClient.mutation(anyApi.auth.signOut, { refreshToken: token }); },
  } });
  const notify = () => { listeners.forEach(fn => fn()); };
  auth.subscribe(() => { client.setAuth(auth.fetchAccessToken); if(!auth.getSnapshot().isAuthenticated)user=null; notify(); });
  client.setAuth(auth.fetchAccessToken);
  const ready = (async () => {
    await auth.init();
    const current = new URL(location.href);
    const code = current.searchParams.get('code');
    if(code) {
      const state = sessionStorage.getItem(stateKey);
      current.searchParams.delete('code'); history.replaceState(null,'',current);
      if(state) {
        sessionStorage.removeItem(stateKey);
        const result = await publicClient.mutation(anyApi.auth.completeSignInWithGithub,{code,state});
        if(result.status !== 'complete')throw new Error('OAuth completion failed');
        await auth.setSession(result.tokens);
      }
    }
    client.setAuth(auth.fetchAccessToken);
    client.onUpdate(anyApi.users.current, {}, value => { user=value; notify(); }, () => { user=null; notify(); });
  })().catch(() => { available=false; notify(); });
  return {
    status: () => !available ? 'unavailable' : auth.getSnapshot().isAuthenticated ? 'signed-in' : 'signed-out',
    subscribeStatus(fn) { listeners.add(fn); return () => {listeners.delete(fn);}; },
    user: () => user,
    async signIn(returnHash) {
      await ready;
      const back = new URL(location.href); back.hash = returnHash.startsWith('#/') ? returnHash : '#/'; back.searchParams.delete('code');
      const result = await publicClient.mutation(anyApi.auth.startSignInWithGithub,{redirectTo:back.href});
      sessionStorage.setItem(stateKey,result.state);
      location.assign(result.redirect);
    },
    async signOut() { await auth.signOut(); user=null; notify(); },
    async rankings() {
      try {
        await ready; const list: Ranking[] = []; let cursor: string | null = null;
        for(let page=0;page<100;page++) {
          const result: { page: Ranking[]; isDone: boolean; continueCursor: string } = await publicClient.query(anyApi.votes.rankings,{cursor}); list.push(...result.page);
          if(result.isDone)return list;
          cursor=result.continueCursor;
        }
        return null;
      } catch { return null; }
    },
    async myVote(id) { await ready; try { return await client.query(anyApi.votes.mine,{submissionId:id}); } catch { return null; } },
    async vote(id,direction): Promise<VoteResult> {
      await ready;
      try { return await client.mutation(anyApi.votes.cast,{submissionId:id,direction}); }
      catch { return {ok:false,reason:'unavailable'}; }
    },
  };
}
export default createConvexVoting;
