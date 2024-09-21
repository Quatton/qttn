import type { MiddlewareHandler } from "astro";
import { site } from "./config/site";

const subdomains = ["const"];
const ignorePattern = /\/api|\/[^/]+\.[^/]+|\/_actions/;

export const onRequest: MiddlewareHandler = async (context, next) => {
  // if the last part of the path is file name like, [name].[ext]
  // then we will next instantly
  // if (context.url.pathname.match(ignorePattern)) {
  //   return next();
  // }
  // // okay, now check if the it's the subdomain in `subdomains` array
  // // if it is, then we will rewrite to /app/[subdomain]
  // const [subdomain, ...rest] = context.url.host.split(".");
  // const pathnames = context.url.pathname
  //   .replace(`/app/${subdomain}`, "")
  //   .split("/");

  // if (subdomains.includes(subdomain)) {
  //   const pathname = pathnames.join("/").replace(/^\/+|\/$/, "");
  //   const url = `${site.url.protocol}://${rest.join(".")}/app/${subdomain}/${pathname}`;
  //   console.log(url);
  //   return context.rewrite(url);
  // }

  // const req = await next();
  // if (req.status === 404) {
  //   return context.rewrite("/");
  // }

  if (
    context.request.url.replace(/\/$/, "") === "https://const.qttn.dev/game"
  ) {
    return context.rewrite("https://qttn.dev/app/const/game");
  }

  if (context.request.url.replace(/\/$/, "") === "https://const.qttn.dev") {
    return context.rewrite("https://qttn.dev/app/const");
  }

  return next();
};
