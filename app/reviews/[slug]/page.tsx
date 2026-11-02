import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import AffiliateBar from "@/components/AffiliateBar";
import AllPicksDrawer from "@/components/AllPicksDrawer";
import ArticleHeader from "@/components/ArticleHeader";
import CommentsSection from "@/components/CommentsSection";
import ProgressBar from "@/components/ProgressBar";
import RelatedArticles from "@/components/RelatedArticles";
import StickyTOC from "@/components/StickyTOC";
import WirecutterProductCard from "@/components/WirecutterProductCard";
import {
  extractHeadings,
  sectionMatchesHeading,
  selectRelatedPosts,
  splitHtmlByHeadings,
  toPickItem,
  toSectionPicks,
} from "@/lib/article";
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

  const sectionPicks = toSectionPicks(post);
  const hasSections = sectionPicks.length > 0;
  const fallbackPick = toPickItem(post, { summary: getReviewExcerpt(post, 110) });

  // 抽屉只展示本文提到的产品，不混入站内其他文章
  const picks = hasSections ? sectionPicks.map((section) => section.pick) : [fallbackPick];

  const segments = splitHtmlByHeadings(html);

  // 同一 anchor 被重复使用时，只渲染第一张，剩下的兜底到正文末尾，避免丢卡
  const renderedPickIds = new Set<string>();
  for (const segment of segments) {
    const headingId = segment.headingId;
    if (!headingId) continue;

    const section = sectionPicks.find((candidate) => sectionMatchesHeading(candidate, headingId));
    if (section) {
      section.pick.href = `/reviews/${post.slug}/#${headingId}`;
      renderedPickIds.add(String(section.pick.id));
    }
  }

  const unmatchedSections = hasSections
    ? sectionPicks.filter((section) => !renderedPickIds.has(String(section.pick.id)))
    : [];

  // 未匹配到 H2 的卡兜底到正文末尾，抽屉链接回到文章顶部
  for (const section of unmatchedSections) {
    section.pick.href = `/reviews/${post.slug}/`;
  }

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
                {!hasSections ? (
                  <div className="py-12">
                    <WirecutterProductCard pick={fallbackPick} />
                  </div>
                ) : null}

                <div className="max-w-2xl">
                  {html ? (
                    hasSections ? (
                      <div className="space-y-10">
                        {segments.map((segment, index) => {
                          const headingId = segment.headingId;
                          const section = headingId
                            ? sectionPicks.find((candidate) => sectionMatchesHeading(candidate, headingId))
                            : undefined;

                          return (
                            <Fragment key={`${segment.headingId ?? "intro"}-${index}`}>
                              <div
                                className="prose prose-lg prose-gray max-w-none"
                                // 正文来自我们自己的 Headless WordPress，已在编辑端做过过滤
                                dangerouslySetInnerHTML={{ __html: segment.html }}
                              />
                              {section ? (
                                <div className="my-10">
                                  <WirecutterProductCard
                                    pick={section.pick}
                                    id={segment.headingId ?? String(index)}
                                    label={section.label ?? "Top pick"}
                                  />
                                </div>
                              ) : null}
                            </Fragment>
                          );
                        })}

                        {unmatchedSections.length > 0 ? (
                          <div className="mt-10 space-y-10">
                            {unmatchedSections.map((section) => (
                              <WirecutterProductCard
                                key={section.pick.id}
                                pick={section.pick}
                                id={String(section.pick.id)}
                                label={section.label ?? "Top pick"}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div
                        className="prose prose-lg prose-gray max-w-none"
                        // 正文来自我们自己的 Headless WordPress，已在编辑端做过过滤
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    )
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
