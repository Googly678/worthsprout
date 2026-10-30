import type { ContentPost, ReviewPost } from "./types";

const API_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_BASE_URL ?? "https://cms.worthsprout.com/wp-json").replace(
  /\/+$/,
  "",
);

export const REVIEWS_ENDPOINT = `${API_BASE}/wp/v2/reviews`;

const PER_PAGE = 100;
const MAX_PAGES = 10;
const REQUEST_TIMEOUT_MS = 20_000;

export class WordPressApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WordPressApiError";
  }
}

async function request<T>(url: string): Promise<{ data: T; headers: Headers }> {
  const response = await fetch(url, {
    // 静态导出在 `next build` 时取数，必须走缓存语义；否则 Next 会按 no-store 处理
    cache: "force-cache",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new WordPressApiError(`WordPress 请求失败 (${response.status} ${response.statusText}): ${url}`, response.status);
  }

  return { data: (await response.json()) as T, headers: response.headers };
}

/** 列表页：`?_embed` 一次带上封面 / 作者 / 分类，避免 N+1 */
export async function getAllReviews(): Promise<ReviewPost[]> {
  const posts: ReviewPost[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, headers } = await request<ReviewPost[]>(
      `${REVIEWS_ENDPOINT}?_embed&per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc`,
    );

    if (!Array.isArray(data) || data.length === 0) break;
    posts.push(...data);

    const totalPages = Number.parseInt(headers.get("x-wp-totalpages") ?? "1", 10);
    if (!Number.isFinite(totalPages) || page >= totalPages) break;
  }

  return posts;
}

/** 静态导出只关心 slug，用 `_fields` 省流量 */
async function collectSlugs(endpoint: string): Promise<string[]> {
  const slugs: string[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, headers } = await request<{ slug?: string }[]>(
      `${endpoint}?_fields=slug&per_page=${PER_PAGE}&page=${page}`,
    );

    if (!Array.isArray(data) || data.length === 0) break;
    slugs.push(...data.map((item) => item?.slug).filter((slug): slug is string => Boolean(slug)));

    const totalPages = Number.parseInt(headers.get("x-wp-totalpages") ?? "1", 10);
    if (!Number.isFinite(totalPages) || page >= totalPages) break;
  }

  return slugs;
}

export async function getReviewSlugs(): Promise<string[]> {
  return collectSlugs(REVIEWS_ENDPOINT);
}

/** 单篇文章：WordPress 没有 `/reviews/<slug>` 端点，用 `?slug=` 过滤 */
export async function getReviewBySlug(slug: string): Promise<ReviewPost | null> {
  if (!slug) return null;

  const { data } = await request<ReviewPost[]>(`${REVIEWS_ENDPOINT}?_embed&slug=${encodeURIComponent(slug)}`);
  if (!Array.isArray(data) || data.length === 0) return null;

  return data[0] ?? null;
}

/* -------------------------------------------------------------- 内容页 */

const POSTS_ENDPOINT = `${API_BASE}/wp/v2/posts`;

/** 内容页（About / Privacy / Affiliate Disclosure）都建在 WP 普通文章里 */
export async function getContentPostSlugs(): Promise<string[]> {
  return collectSlugs(POSTS_ENDPOINT);
}

export async function getContentPostBySlug(slug: string): Promise<ContentPost | null> {
  if (!slug) return null;

  const { data } = await request<ContentPost[]>(`${POSTS_ENDPOINT}?_embed&slug=${encodeURIComponent(slug)}`);
  if (!Array.isArray(data) || data.length === 0) return null;

  return data[0] ?? null;
}

export async function safeGetContentPostSlugs(): Promise<string[]> {
  try {
    return await getContentPostSlugs();
  } catch (error) {
    console.error("[wordpress] 获取内容页 slug 列表失败，已降级为空列表:", error);
    return [];
  }
}

export async function safeGetContentPostBySlug(slug: string): Promise<ContentPost | null> {
  try {
    return await getContentPostBySlug(slug);
  } catch (error) {
    console.error(`[wordpress] 获取内容页 "${slug}" 失败:`, error);
    return null;
  }
}

/* -------------------------------------------------------------- 分类 */

export interface ReviewCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
}

const CATEGORIES_ENDPOINT = `${API_BASE}/wp/v2/review_category`;

/** GET /wp/v2/review_category?per_page=100 */
export async function getAllCategories(): Promise<ReviewCategory[]> {
  const { data } = await request<ReviewCategory[]>(`${CATEGORIES_ENDPOINT}?per_page=100&orderby=name&order=asc`);
  return Array.isArray(data) ? data : [];
}

export async function safeGetAllCategories(): Promise<ReviewCategory[]> {
  try {
    return await getAllCategories();
  } catch (error) {
    console.error("[wordpress] 获取分类失败，已降级为空列表:", error);
    return [];
  }
}

/**
 * GET /wp/v2/reviews?review_category=1,2,3
 * 该参数只接受 term ID（slug 会 400），所以调用方需先把 slug 解析成 id。
 */
export async function getReviewsByCategoryIds(ids: number[]): Promise<ReviewPost[]> {
  if (ids.length === 0) return [];

  const { data } = await request<ReviewPost[]>(
    `${REVIEWS_ENDPOINT}?_embed&per_page=100&review_category=${ids.join(",")}`,
  );

  return Array.isArray(data) ? data : [];
}

export async function safeGetReviewsByCategoryIds(ids: number[]): Promise<ReviewPost[]> {
  try {
    return await getReviewsByCategoryIds(ids);
  } catch (error) {
    console.error("[wordpress] 按分类获取文章失败，已降级为空列表:", error);
    return [];
  }
}

/**
 * 构建期的“软失败”包装：CMS 挂了也不应该让整站构建失败，
 * 只是对应页面降级 / 缺失，后续重新构建即可恢复。
 */
export async function safeGetReviewSlugs(): Promise<string[]> {
  try {
    return await getReviewSlugs();
  } catch (error) {
    console.error("[wordpress] 获取 slug 列表失败，已降级为空列表:", error);
    return [];
  }
}

export async function safeGetAllReviews(): Promise<ReviewPost[]> {
  try {
    return await getAllReviews();
  } catch (error) {
    console.error("[wordpress] 获取文章列表失败，已降级为空列表:", error);
    return [];
  }
}

export async function safeGetReviewBySlug(slug: string): Promise<ReviewPost | null> {
  try {
    return await getReviewBySlug(slug);
  } catch (error) {
    console.error(`[wordpress] 获取文章 "${slug}" 失败:`, error);
    return null;
  }
}
