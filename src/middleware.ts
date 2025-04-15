import type { MiddlewareHandler } from "astro";
import { site } from "./config/site";
import { sequence } from "astro:middleware";

const subdomains = ["const", "gallery"];
const ignorePattern = /\/api|\/[^/]+\.[^/]+|\/_actions/;

import vercelOGPagesPlugin from "@cloudflare/pages-plugin-vercel-og";
import { BlogOg } from "./components/og/BlogOg";

const subdomain: MiddlewareHandler = async (context, next) => {
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

const ogImage = vercelOGPagesPlugin<{ ogTitle: string }>({
  imagePathSuffix: "/og.png",
  component: BlogOg,
  extractors: {
    on: {
      'meta[property="og:title"]': (props) => ({
        element(element) {
          props.ogTitle = element.getAttribute("content");
        },
      }),
    },
  },
  autoInject: {
    openGraph: true,
  },
});

export const onRequest = sequence(subdomain);
