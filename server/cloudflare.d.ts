// Type stubs so `npm run typecheck` passes without installing @cloudflare/workers-types. Only used by server/worker.ts.
declare module "cloudflare:workers" { export const env: { IMAGES?: unknown } & Record<string, unknown>; }
declare module "cloudflare:node" { export function httpServerHandler(o: { port: number }): ExportedHandler; }
interface ExportedHandler { fetch?: (...a: unknown[]) => unknown }
