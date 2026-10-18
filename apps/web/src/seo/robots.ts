// /robots.txt — internal tool: it is not indexed. Pre-rendered at build time.
export function loader() {
  return new Response("User-agent: *\nDisallow: /\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
