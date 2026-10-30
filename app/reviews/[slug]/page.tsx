import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AffiliateBar from "@/components/AffiliateBar";
import AllPicksDrawer from "@/components/AllPicksDrawer";
import ArticleHeader from "@/components/ArticleHeader";
import CommentsSection from "@/components/CommentsSection";
import ProgressBar from "@/components/ProgressBar";
import StickyTOC from "@/components/StickyTOC";
import WirecutterProductCard from "@/components/WirecutterProductCard";
import { extractHeadings, toPickItem } from "@/lib/article";
import {
  getReviewAuthor,
  getReviewCategory,
  getReviewExcerpt,
  getReviewFeaturedImage,
  getReviewTitle,
} from "@/lib/present";
import { safeGetReviewBySlug, safeGetReviewSlugs } from "@/lib/wordpress";

interface ReviewPageProps {
  params: Promise<{ slug: string }>;
}

/** 静态导出：只允许 generateStaticParams 里出现过的 slug，其余落到 404.html */
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await safeGetReviewSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ReviewPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await safeGetReviewBySlug(slug);

  if (!post) {
    return { title: "Review not found" };
  }

  const title = getReviewTitle(post);
  const description = getReviewExcerpt(post, 155);
  const image = getReviewFeaturedImage(post);

  return {
    title,
    description,
    alternates: { canonical: `/reviews/${post.slug}/` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/reviews/${post.slug}/`,
      publishedTime: post.date,
      modifiedTime: post.modified ?? post.date,
      images: image ? [{ url: image.src, alt: image.alt }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ArticlePage({ params }: ReviewPageProps) {
  const { slug } = await params;
  const post = await safeGetReviewBySlug(slug);

  if (!post) notFound();

  const title = getReviewTitle(post);
  const image = getReviewFeaturedImage(post);

  // 给正文 H2 注入 id，TOC 才能可靠跳转
  const { html, headings } = extractHeadings(post.content?.rendered ?? "");

  const mainPick = toPickItem(post, { summary: getReviewExcerpt(post, 110) });

  // 抽屉只展示本文提到的产品，不混入站内其他文章
  const picks = [mainPick];

  return (
    <>
      <ProgressBar />

      <article className="pb-12">
        <AffiliateBar />

        <ArticleHeader
          title={title}
          category={getReviewCategory(post)}
          author={getReviewAuthor(post)}
          date={post.modified ?? post.date}
          image={image}
        />

        {/* sticky 目录限制在正文范围内，正文结束就停止跟随 */}
        <div className="relative">
          <StickyTOC headings={headings} />

          <div className="py-12">
            <WirecutterProductCard pick={mainPick} />
          </div>

          <div className="mx-auto max-w-2xl px-6">
            {html ? (
              <div
                className="prose prose-lg prose-gray max-w-none"
                // 正文来自我们自己的 Headless WordPress，已在编辑端做过过滤
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="rounded-xl bg-gray-50 p-6 text-sm leading-relaxed text-gray-500">
                The full write-up is not available right now. Please check back later.
              </p>
            )}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-2xl px-6">
          <CommentsSection postId={post.id} />
        </div>
      </article>

      <AllPicksDrawer picks={picks} />
    </>
  );
}
