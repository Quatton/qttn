import type { MiddlewareHandler } from "astro";

export const onRequest: MiddlewareHandler = async (context, next) => {
  // ignore favicon requests
  if (context.request.url.endsWith("/favicon.ico")) {
    return next();
  }

  // if there is a subdomain, rewrite to /app/:subdomain
  let hostname = context.request.headers
    .get("host")
    ?.replace(".localhost:3000", `.${import.meta.env.BASE_URL}`);

  if (!hostname) {
    return next();
  }

  // special case for Vercel preview deployment URLs
  if (
    hostname.includes("---") &&
    hostname.endsWith(`.${process.env.VERCEL_DEPLOYMENT_SUFFIX}`)
  ) {
    hostname = `${hostname.split("---")[0]}.${process.env.BASE_URL}`;
  }

  const url = new URL(context.url);
  const searchParams = url.searchParams.toString();
  // Get the pathname of the request (e.g. /, /about, /blog/first-post)
  const path = `${url.pathname}${
    searchParams.length > 0 ? `?${searchParams}` : ""
  }`;

  // rewrite root application to `/home` folder
  if (hostname === process.env.BASE_URL) {
    return next(`/home${path === "/" ? "" : path}`);
  }

  const subdomain = hostname.split(".")[0];

  return next(`/app/${subdomain}${path}`);
};
