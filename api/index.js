// Placeholder so Vercel finds the function declared in vercel.json before the build runs.
// `npm run build` (build:api) overwrites this file with the bundled Express server.
export default function handler(_req, res) {
  res.statusCode = 500;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "API not built. Run `npm run build`." }));
}
