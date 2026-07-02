import { useEffect } from "react";
import { applySeo, type SeoConfig } from "@/lib/seo";

/** Sets document title + meta tags for the current SPA route. */
export function SeoHead({
  title,
  description,
  canonical,
  ogImage,
  ogImageAlt,
  ogType,
  robots,
  themeColor,
  jsonLd,
}: SeoConfig) {
  useEffect(() => {
    applySeo({
      title,
      description,
      canonical,
      ogImage,
      ogImageAlt,
      ogType,
      robots,
      themeColor,
      jsonLd,
    });
  }, [
    title,
    description,
    canonical,
    ogImage,
    ogImageAlt,
    ogType,
    robots,
    themeColor,
    jsonLd,
  ]);

  return null;
}
