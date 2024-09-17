import type { MiddlewareHandler } from "astro";

export const onRequest: MiddlewareHandler = async (context, next) => {
  // if there is a subdomain, rewrite to /app/:subdomain

  const subdomains = context.request.headers.get("host")?.split(".");
  const subdomain = subdomains && subdomains.length > 2 ? subdomains[0] : null;
  const url = new URL(context.request.url);
  const path = url.pathname;
  if (subdomain) {
    return next(new Request(`/app/${subdomain}${path}`));
  }

  return next();
};
