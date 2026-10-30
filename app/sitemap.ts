import type { MetadataRoute } from "next";
import { safeGetAllCategories, safeGetAllReviews, safeGetContentPostSlugs } from "@/lib/wordpress";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://worthsprout.com").replace(/\/+$/, "");

/** `output: "export"` 下 metadata 路由必须是静态的 */
export const dynamic = "force-static";

/** WordPress 的 modified/date 可能是无时区的字符串，解析失败就不要给出错误的 lastModified */
function toDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [reviews, categories, contentSlugs] = await Promise.all([
    safeGetAllReviews(),
    safeGetAllCategories(),
    safeGetContentPostSlugs(),
  ]);

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  for (const post of reviews) {
    entries.push({
      url: `${SITE_URL}/reviews/${post.slug}/`,
      lastModified: toDate(post.modified ?? post.date),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const category of categories) {
    entries.push({
      url: `${SITE_URL}/category/${category.slug}/`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const slug of contentSlugs) {
    entries.push({
      url: `${SITE_URL}/${slug}/`,
      changeFrequency: "monthly",
      priority: 0.3,
    });
  }

  return entries;
}
