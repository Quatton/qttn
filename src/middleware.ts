import type { MiddlewareHandler } from "astro";

const subdomains = ["const"];

export const onRequest: MiddlewareHandler = (context, next) => {
  // if the last part of the path is file name like, [name].[ext]
  // then we will next instantly
  if (context.url.pathname.match(/\/[^/]+\.[^/]+$/)) {
    return next();
  }

  // if the path is /api, then we will next instantly
  if (context.url.pathname.startsWith("/api")) {
    return next();
  }

  // okay, now check if the it's the subdomain in `subdomains` array
  // if it is, then we will rewrite to /app/[subdomain]
  const parts = context.url.hostname.split(".");
  if (
    subdomains.includes(parts[0]) &&
    context.url.pathname.split("/")[0] !== "app"
  ) {
    const url = `http${import.meta.env.DEV ? "" : "s"}://${import.meta.env.PUBLIC_BASE_URL}/app/${parts[0]}`;
    console.log("Rewriting to", url);
    return context.rewrite(url);
  }

  return next();
};
