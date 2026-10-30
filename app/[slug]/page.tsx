import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { extractHeadings } from "@/lib/article";
import { formatDate } from "@/lib/format";
import { getReviewExcerpt, getReviewTitle } from "@/lib/present";
import { safeGetContentPostBySlug, safeGetContentPostSlugs } from "@/lib/wordpress";

interface ContentPageProps {
  params: Promise<{ slug: string }>;
}

/** 静态导出：只允许 generateStaticParams 里出现过的 slug，其余落到 404.html */
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await safeGetContentPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ContentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await safeGetContentPostBySlug(slug);

  if (!post) return { title: "Page not found" };

  const title = getReviewTitle(post);

  return {
    title,
    description: getReviewExcerpt(post, 155),
    alternates: { canonical: `/${post.slug}/` },
  };
}

export default async function ContentPage({ params }: ContentPageProps) {
  const { slug } = await params;
  const post = await safeGetContentPostBySlug(slug);

  if (!post) notFound();

  const title = getReviewTitle(post);
  // 注入 H2 id，页脚 "How we test" 之类带锚点的入口才能跳到位
  const { html } = extractHeadings(post.content?.rendered ?? "");

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <nav aria-label="Breadcrumb" className="text-xs font-bold uppercase tracking-wider text-gray-500">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="transition-colors hover:text-gray-900">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-900">{title}</li>
        </ol>
      </nav>

      <h1 className="mt-8 font-serif text-4xl font-bold leading-tight text-gray-900 md:text-5xl">{title}</h1>

      <p className="mt-3 text-sm text-gray-500">Last updated {formatDate(post.modified ?? post.date)}</p>

      <div className="mt-4 w-32 border-t-4 border-black" />

      {html ? (
        <div
          className="prose prose-lg prose-gray mt-10 max-w-none"
          // 正文来自我们自己的 Headless WordPress，已在编辑端做过过滤
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="mt-10 rounded-xl bg-gray-50 p-6 text-sm leading-relaxed text-gray-500">
          This page is being written. Please check back soon.
        </p>
      )}
    </div>
  );
}
