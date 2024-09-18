import { site } from "@/config/site";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAppHref(subdomain: string) {
  return `${site.url.protocol}://${subdomain}.${site.url.host}`;
}
