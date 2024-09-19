import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAppHref(subdomain: string, pathname = "/") {
  return `/app/${subdomain}${pathname}`;
  // if (import.meta.env.DEV) {
  //   return `${site.url.protocol}://${site.url.host}/app/${subdomain}${pathname}`;
  // }
  // return `${subdomain}.${site.url.host}${pathname}`;
}
