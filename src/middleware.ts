import type { MiddlewareHandler } from "astro";

export const onRequest: MiddlewareHandler = async (context, next) => {
  // if there is a subdomain, rewrite to /app/:subdomain

  const subdomain = context.request.headers.get("host")?.split(".")[0];
  const url = new URL(context.request.url);
  const path = url.pathname;
  if (subdomain) {
    return next(new Request(`/app/${subdomain}${path}`));
  }

  return next();
};
