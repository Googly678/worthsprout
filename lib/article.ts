import { decodeHtmlEntities, isSafeHttpUrl, parseRating, stripHtml } from "./format";
import { getReviewCategory } from "./present";
import type { ACFData, FeaturedImage, ReviewPost } from "./types";

export interface Heading {
  id: string;
  text: string;
}

function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return slug || "section";
}

/**
 * 从正文 HTML 里提取 H2 并注入稳定 id，供目录跳转使用。
 * 已有 id 的标题保留原 id，避免破坏 WordPress 内的锚点。
 */
export function extractHeadings(html: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const used = new Set<string>();

  const withIds = html.replace(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi, (match, attrs: string, inner: string) => {
    const text = decodeHtmlEntities(stripHtml(inner));
    if (!text) return match;

    const existing = /\sid="([^"]+)"/i.exec(attrs)?.[1];
    let id = existing ?? slugifyHeading(text);

    if (!existing) {
      let suffix = 2;
      while (used.has(id)) {
        id = `${slugifyHeading(text)}-${suffix}`;
        suffix += 1;
      }
    }

    used.add(id);
    headings.push({ id, text });

    if (existing) return match;
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });

  return { html: withIds, headings };
}

export interface MerchantLink {
  merchant: string;
  url: string;
  price?: string;
}

const BRAND_BY_HOSTNAME: Record<string, string> = {
  "amazon.com": "Amazon",
  "amazon.co.uk": "Amazon",
  "amazon.de": "Amazon",
  "amazon.ca": "Amazon",
  "chewy.com": "Chewy",
  "walmart.com": "Walmart",
  "target.com": "Target",
  "bestbuy.com": "Best Buy",
  "homedepot.com": "Home Depot",
  "lowes.com": "Lowe's",
  "ikea.com": "IKEA",
  "wayfair.com": "Wayfair",
  "rei.com": "REI",
  "backcountry.com": "Backcountry",
  "bhphotovideo.com": "B&H Photo",
  "store.hermanmiller.com": "Herman Miller",
  "hermanmiller.com": "Herman Miller",
};

/** 从域名推导商家名，未知域名退化成去掉 www 的主机名 */
export function brandFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (BRAND_BY_HOSTNAME[hostname]) return BRAND_BY_HOSTNAME[hostname];

    // 取主域的中间段：store.example.com → Example
    const parts = hostname.split(".");
    const candidate = parts.length >= 2 ? parts[parts.length - 2] : hostname;

    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  } catch {
    return "Retailer";
  }
}

/**
 * 当前 ACF 只有一个 affiliate_link，这里归一化成「多商家列表」结构，
 * 将来 ACF 增加 offers 数组时只需在这里扩展，组件不用改。
 */
export function buildMerchantLinks(acf?: ACFData | null): MerchantLink[] {
  const links: MerchantLink[] = [];
  const seen = new Set<string>();

  const push = (url: string | null | undefined, price?: string | number | null) => {
    if (!isSafeHttpUrl(url)) return;

    const trimmed = url.trim();
    if (seen.has(trimmed)) return;
    seen.add(trimmed);

    const normalizedPrice =
      typeof price === "number" ? String(price) : typeof price === "string" ? price.trim().replace(/^\$/, "") : "";

    links.push({
      merchant: brandFromUrl(trimmed),
      url: trimmed,
      price: normalizedPrice || undefined,
    });
  };

  push(acf?.affiliate_link, acf?.price);

  return links;
}

export interface PickItem {
  id: string | number;
  name: string;
  summary: string;
  rating: number | null;
  image: FeaturedImage | null;
  merchantLinks: MerchantLink[];
  href: string;
}

/** 把一篇文章的 ACF 归一化成抽屉/卡片共用的 Pick 结构 */export function toPickItem(post: ReviewPost, options: { summary?: string } = {}): PickItem {
  const acf = post.acf;

  return {
    id: post.id,
    name: acf?.product_name?.trim() || "Untitled product",
    summary: options.summary || stripHtml(acf?.pros) || "No summary available.",
    rating: parseRating(acf?.rating),
    image: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url
      ? {
          src: post._embedded["wp:featuredmedia"][0].source_url as string,
          alt: post._embedded["wp:featuredmedia"][0].alt_text?.trim() || acf?.product_name || "Product image",
        }
      : null,
    merchantLinks: buildMerchantLinks(acf),
    href: `/reviews/${post.slug}/`,
  };
}

/**
 * 相关文章：优先同分类，不足时用最新文章补齐；始终排除当前文章。
 * 调用方传入的顺序即为兜底顺序（列表接口已按发布时间倒序）。
 */
export function selectRelatedPosts(posts: ReviewPost[], current: ReviewPost, limit = 4): ReviewPost[] {
  const category = getReviewCategory(current);
  const others = posts.filter((post) => post.id !== current.id);

  if (!category) return others.slice(0, limit);

  const sameCategory: ReviewPost[] = [];
  const rest: ReviewPost[] = [];

  for (const post of others) {
    if (getReviewCategory(post) === category) sameCategory.push(post);
    else rest.push(post);
  }

  return [...sameCategory, ...rest].slice(0, limit);
}
