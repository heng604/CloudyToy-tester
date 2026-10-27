// Cloudflare Workers entry. The same Express app (server/app.ts) runs here through the Node-compatibility layer.
// The built React site (dist/) is served by Workers Static Assets; only /api/* reaches this code (see wrangler.jsonc).
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import app from "./app";
(globalThis as Record<string, unknown>).__CT_IMAGES = env.IMAGES; // image resizing binding, used by server/lib/image.ts
app.listen(8080);
export default httpServerHandler({ port: 8080 });
