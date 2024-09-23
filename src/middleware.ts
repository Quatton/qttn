import type { MiddlewareHandler } from "astro";
import { site } from "./config/site";

const subdomains = ["const", "blog"];
const ignorePattern = /\/api|\/[^/]+\.[^/]+|\/_actions/;

export const onRequest: MiddlewareHandler = async (context, next) => {
  if (context.url.pathname.match(ignorePattern)) {
    return next();
  }

  if (import.meta.env.DEV && !context.url.host.includes(site.url.host)) {
    return next();
  }
  // okay, now check if the it's the subdomain in `subdomains` array
  // if it is, then we will rewrite to /app/[subdomain]
  const [subdomain, ...rest] = context.url.host.split(".");
  const pathnames = context.url.pathname
    .replace(`/app/${subdomain}`, "")
    .split("/");

  if (subdomains.includes(subdomain)) {
    const pathname = pathnames.join("/").replace(/^\/+|\/$/, "");
    const url = new URL(
      `${site.url.protocol}://${rest.join(".")}/app/${subdomain}/${pathname}?${context.url.search}`,
    );
    return context.rewrite(url);
  }
  return next();
};
