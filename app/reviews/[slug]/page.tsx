import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AffiliateBar from "@/components/AffiliateBar";
import AllPicksDrawer from "@/components/AllPicksDrawer";
import ArticleHeader from "@/components/ArticleHeader";
import CommentsSection from "@/components/CommentsSection";
import ProgressBar from "@/components/ProgressBar";
import RelatedArticles from "@/components/RelatedArticles";
import StickyTOC from "@/components/StickyTOC";
import WirecutterProductCard from "@/components/WirecutterProductCard";
import { extractHeadings, selectRelatedPosts, toPickItem } from "@/lib/article";
import {
  getReviewAuthor,
  getReviewCategory,
  getReviewExcerpt,
  getReviewFeaturedImage,
  getReviewTitle,
} from "@/lib/present";
import { safeGetAllReviews, safeGetReviewBySlug, safeGetReviewSlugs } from "@/lib/wordpress";

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

  const allReviews = await safeGetAllReviews();
  const related = selectRelatedPosts(allReviews, post, 4);

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

          <div className="mx-auto max-w-6xl px-6">
            <div className="lg:grid lg:grid-cols-[minmax(0,42rem)_minmax(0,22rem)] lg:items-start lg:gap-12">
              <div className="min-w-0">
                <div className="py-12">
                  <WirecutterProductCard pick={mainPick} />
                </div>

                <div className="max-w-2xl">
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

                <div className="mt-16 max-w-2xl">
                  <CommentsSection postId={post.id} />
                </div>

                <div className="mt-16 max-w-2xl lg:hidden">
                  <RelatedArticles posts={related} />
                </div>
              </div>

              {/* 侧栏吸顶位置留出目录条的高度，避免被压在目录下面 */}
              <aside className="hidden lg:sticky lg:top-32 lg:mt-12 lg:block">
                <RelatedArticles posts={related} />
              </aside>
            </div>
          </div>
        </div>
      </article>

      <AllPicksDrawer picks={picks} />
    </>
  );
}
