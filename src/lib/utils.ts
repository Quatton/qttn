import { site } from "@/config/site";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAppHref(subdomain: string, pathname = "/") {
  if (import.meta.env.DEV) {
    return `${site.url.protocol}://${site.url.host}/app/${subdomain}${pathname}`;
  }
  return `${site.url.protocol}://${subdomain}.${site.url.host}${pathname}`;
}
