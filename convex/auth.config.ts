import type { AuthConfig } from "convex/server";
import { convexAuthProvider } from "@convex-dev/auth/server";

// Tells the deployment to accept the access tokens Convex Auth signs with its
// own key. There is no secret to configure here.
export default {
  providers: [convexAuthProvider()],
} satisfies AuthConfig;
