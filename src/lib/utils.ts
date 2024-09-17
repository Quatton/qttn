import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAppHref(subdomain: string) {
  if (import.meta.env.DEV) {
    return `/app/${subdomain}`
  } 

  return `https://${subdomain}.qttn.dev`
}