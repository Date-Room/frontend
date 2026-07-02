/** Canonical SEO copy for the marketing landing page. */
export const SITE_URL = "https://dateroom.io";

export const LANDING_SEO = {
  title: "DateRoom | The Room Before the Phone Number",
  description:
    "Date them before you date them. Private video rooms via a 6-digit code. No phone numbers, zero downloads.",
  ogImage: `${SITE_URL}/assets/dateroom-preview.jpg`,
  ogImageAlt: "DateRoom — a private room you share with a six-digit code.",
  canonical: SITE_URL,
  themeColor: "#111111",
} as const;

export type SeoConfig = {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogType?: "website" | "article";
  robots?: string;
  themeColor?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function upsertMeta(
  selector: string,
  attrs: Record<string, string>,
  createTag: "meta" | "link" = "meta",
) {
  let el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  if (!el) {
    el = document.createElement(createTag);
    Object.entries(attrs).forEach(([key, value]) => {
      el!.setAttribute(key, value);
    });
    document.head.appendChild(el);
    return;
  }
  Object.entries(attrs).forEach(([key, value]) => {
    el!.setAttribute(key, value);
  });
}

/** Apply SEO tags at runtime (SPA route changes). index.html carries defaults for crawlers. */
export function applySeo(config: SeoConfig) {
  const {
    title,
    description,
    canonical = SITE_URL,
    ogImage = LANDING_SEO.ogImage,
    ogImageAlt = LANDING_SEO.ogImageAlt,
    ogType = "website",
    robots = "index, follow",
    themeColor = LANDING_SEO.themeColor,
    jsonLd,
  } = config;

  document.title = title;

  upsertMeta('meta[name="title"]', { name: "title", content: title });
  upsertMeta('meta[name="description"]', { name: "description", content: description });
  upsertMeta('meta[name="robots"]', { name: "robots", content: robots });
  upsertMeta('meta[name="theme-color"]', { name: "theme-color", content: themeColor });
  upsertMeta('meta[name="apple-mobile-web-app-status-bar-style"]', {
    name: "apple-mobile-web-app-status-bar-style",
    content: "black-translucent",
  });

  upsertMeta('link[rel="canonical"]', { rel: "canonical", href: canonical }, "link");

  upsertMeta('meta[property="og:type"]', { property: "og:type", content: ogType });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
  upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "DateRoom" });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', {
    property: "og:description",
    content: description,
  });
  upsertMeta('meta[property="og:image"]', { property: "og:image", content: ogImage });
  upsertMeta('meta[property="og:image:alt"]', {
    property: "og:image:alt",
    content: ogImageAlt,
  });
  upsertMeta('meta[property="og:image:width"]', { property: "og:image:width", content: "1200" });
  upsertMeta('meta[property="og:image:height"]', { property: "og:image:height", content: "630" });

  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  upsertMeta('meta[name="twitter:description"]', {
    name: "twitter:description",
    content: description,
  });
  upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: ogImage });

  const existing = document.getElementById("dateroom-jsonld");
  existing?.remove();
  if (jsonLd) {
    const script = document.createElement("script");
    script.id = "dateroom-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}

export const LANDING_JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "DateRoom",
    url: SITE_URL,
    description: LANDING_SEO.description,
    inLanguage: "en",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "DateRoom",
    url: SITE_URL,
    logo: `${SITE_URL}/dateroom-logo.png`,
    description: LANDING_SEO.description,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "DateRoom",
    applicationCategory: "SocialNetworkingApplication",
    operatingSystem: "Web, iOS, Android",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: LANDING_SEO.description,
    url: SITE_URL,
  },
];
