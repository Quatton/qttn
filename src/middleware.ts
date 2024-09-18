import type { MiddlewareHandler } from "astro";

const subdomains = ["const"];
const ignorePattern = /\/api|\/[^/]+\.[^/]+|\/_actions/;

export const onRequest: MiddlewareHandler = (context, next) => {
  // if the last part of the path is file name like, [name].[ext]
  // then we will next instantly
  if (context.url.pathname.match(ignorePattern)) {
    return next();
  }

  // okay, now check if the it's the subdomain in `subdomains` array
  // if it is, then we will rewrite to /app/[subdomain]
  const parts = context.url.hostname.split(".");
  const pathnames = context.url.pathname.split("/").slice(1);

  if (
    subdomains.includes(parts[0]) &&
    context.url.pathname.split("/")[0] !== "app"
  ) {
    const pathname = pathnames.join("/").replace(`/app/${parts[0]}`, "");
    const url = `http${import.meta.env.DEV ? "" : "s"}://${import.meta.env.PUBLIC_BASE_URL}/app/${parts[0]}/${pathname}`;
    return context.rewrite(url);
  }

  return next();
};
