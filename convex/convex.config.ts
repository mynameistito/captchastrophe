import { defineApp } from "convex/server";
import { v } from "convex/values";
import auth from "@convex-dev/auth/convex.config.js";
import authGithub from "@convex-dev/auth/components/github/convex.config.js";

// GitHub is the only sign-in method. No email/password, no other provider.
// The two AUTH_GITHUB_* values belong to the maintainer's GitHub OAuth App
// and are validated at deploy time. Everything else (SYNC_TOKEN,
// MAINTAINER_GITHUB_IDS, ALLOWED_REDIRECT_ORIGINS, ...) is read from
// process.env at call time, see convex/config.ts.
const app = defineApp({
  env: {
    AUTH_GITHUB_CLIENT_ID: v.string(),
    AUTH_GITHUB_CLIENT_SECRET: v.string(),
  },
});

app.use(auth);

// `httpPrefix` fixes the OAuth callback:
//   https://<deployment>.convex.site/oauth/github/callback
app.use(authGithub, {
  httpPrefix: "/oauth/github",
  env: {
    CLIENT_ID: app.env.AUTH_GITHUB_CLIENT_ID,
    CLIENT_SECRET: app.env.AUTH_GITHUB_CLIENT_SECRET,
  },
});

export default app;
