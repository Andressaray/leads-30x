// /robots.txt — herramienta interna: no se indexa. Se pre-renderiza en build.
export function loader() {
  return new Response("User-agent: *\nDisallow: /\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
