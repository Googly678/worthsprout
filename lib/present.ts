import { decodeHtmlEntities, orFallback, parseRating, stripHtml } from "./format";
import type { FeaturedImage, ReviewPost } from "./types";

/** post.title.rendered → 可读标题 */
export function getReviewTitle(post: ReviewPost): string {
  return orFallback(decodeHtmlEntities(post.title?.rendered), "Untitled review");
}

/** post._embedded['wp:featuredmedia'][0].source_url → 封面（含空值防御） */
export function getReviewFeaturedImage(post: ReviewPost): FeaturedImage | null {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const src = media?.source_url?.trim();
  if (!src) return null;

  const width = media?.media_details?.width;
  const height = media?.media_details?.height;

  return {
    src,
    alt: media?.alt_text?.trim() || getReviewTitle(post),
    width: typeof width === "number" ? width : undefined,
    height: typeof height === "number" ? height : undefined,
  };
}

/** 取第一个非 tag 分类作为栏目名 */
export function getReviewCategory(post: ReviewPost): string | null {
  const groups = post._embedded?.["wp:term"] ?? [];

  for (const group of groups) {
    for (const term of group) {
      if (term.taxonomy === "post_tag") continue;
      if (term.name?.trim()) return term.name.trim();
    }
  }

  return null;
}

export function getReviewAuthor(post: ReviewPost): string | null {
  const author = post._embedded?.author?.[0]?.name?.trim();
  return author || null;
}

/** excerpt 为空时退化为正文第一段（比整篇去标签更干净） */
export function getReviewExcerpt(post: ReviewPost, length = 160): string {
  const excerpt = stripHtml(post.excerpt?.rendered);
  const source =
    excerpt || stripHtml(/<p[^>]*>([\s\S]*?)<\/p>/i.exec(post.content?.rendered ?? "")?.[1]) || stripHtml(post.content?.rendered);

  if (!source) return "No summary available yet.";
  return source.length > length ? `${source.slice(0, length).trimEnd()}…` : source;
}

export function getReviewRating(post: ReviewPost): number | null {
  return parseRating(post.acf?.rating);
}
