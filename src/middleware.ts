import type { MiddlewareHandler } from "astro";
import { site } from "./config/site";
import { rewrite } from "@vercel/edge";

const subdomains = ["const"];
const ignorePattern = /\/api|\/[^/]+\.[^/]+|\/_actions/;

export const onRequest: MiddlewareHandler = (context, next) => {
  // if the last part of the path is file name like, [name].[ext]
  // then we will next instantly
  if (context.url.pathname.match(ignorePattern) && import.meta.env.DEV) {
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
    const url = `${site.url.protocol}://${rest.join(".")}/app/${subdomain}/${pathname}`;
    console.log(url);
    return rewrite(new URL(url), context.request);
  }

  return next();
};
