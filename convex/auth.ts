import { setupConvexAuth } from '@convex-dev/auth/server';
import { setupGithub } from '@convex-dev/auth/methods/github/server';
import { components, internal } from './_generated/api';
const auth = setupConvexAuth({ component: components.auth, usersTable: 'users' });
export const {signOut, refreshSession, isAuthenticated} = auth;
const allowedRedirectOrigins = (process.env.ALLOWED_REDIRECT_ORIGINS ?? '').split(',').map(s=>s.trim()).filter(Boolean);
for(const origin of allowedRedirectOrigins) { const url=new URL(origin); if(url.origin!==origin || origin.includes('*'))throw new Error('Auth redirect allow-list must contain exact origins'); }
export const { startSignInWithGithub, completeSignInWithGithub } = setupGithub(auth,{component:components.authGithub,allowedRedirectOrigins}).attachUserCallbacks({createUser:internal.users.createUser,onSignIn:internal.users.onSignIn});
