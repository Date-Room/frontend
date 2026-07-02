import { api } from "@/lib/api";

export type LinkPreview = {
  title: string;
  author?: string | null;
  is_book: boolean;
  site_name?: string | null;
};

export function isHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim());
}

export function isBookUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return (
      host.includes("amazon.") ||
      host === "amzn.to" ||
      host.includes("goodreads.com") ||
      host.includes("bookshop.org") ||
      host.includes("barnesandnoble.com") ||
      host.includes("audible.com") ||
      host.includes("libro.fm") ||
      host.includes("books.google.")
    );
  } catch {
    return false;
  }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    return await api.get<LinkPreview>(
      `/v1/link-preview?url=${encodeURIComponent(url.trim())}`,
    );
  } catch {
    return null;
  }
}

export function fallbackLinkTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
