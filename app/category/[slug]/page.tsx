import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewPreviewCard from "@/components/ReviewPreviewCard";
import { decodeName } from "@/lib/format";
import { safeGetAllCategories, safeGetReviewsByCategoryIds, type ReviewCategory } from "@/lib/wordpress";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const categories = await safeGetAllCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

function findCategory(categories: ReviewCategory[], slug: string): ReviewCategory | null {
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const categories = await safeGetAllCategories();
  const category = findCategory(categories, slug);

  if (!category) return { title: "Category not found" };

  const name = decodeName(category.name);

  return {
    title: `${name} reviews`,
    description: `Independent, hands-on ${name.toLowerCase()} reviews and buying guides from WorthSprout.`,
    alternates: { canonical: `/category/${category.slug}/` },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const categories = await safeGetAllCategories();
  const category = findCategory(categories, slug);

  if (!category) notFound();

  // 一级分类自身的 count 常为 0（文章都挂在子分类上），需要连同子分类一起查
  const childIds = categories.filter((item) => item.parent === category.id).map((item) => item.id);
  const reviews = await safeGetReviewsByCategoryIds([category.id, ...childIds]);

  const name = decodeName(category.name);

  const parent = category.parent === 0 ? null : categories.find((item) => item.id === category.parent);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-2xl">
        <nav aria-label="Breadcrumb" className="text-xs font-bold uppercase tracking-wider text-gray-500">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition-colors hover:text-gray-900">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className={parent ? "" : "text-gray-900"}>
              {parent ? (
                <Link href={`/category/${parent.slug}`} className="transition-colors hover:text-gray-900">
                  {decodeName(parent.name)}
                </Link>
              ) : (
                name
              )}
            </li>
            {parent ? (
              <>
                <li aria-hidden="true">/</li>
                <li className="text-gray-900">{name}</li>
              </>
            ) : null}
          </ol>
        </nav>

        <h1 className="mt-8 font-serif text-4xl font-bold leading-tight text-gray-900 md:text-5xl">{name}</h1>
        <p className="mt-3 text-sm text-gray-500">
          {reviews.length > 0
            ? `${reviews.length} ${reviews.length === 1 ? "review" : "reviews"} in this category.`
            : "We are still testing products in this category."}
        </p>
      </div>

      {reviews.length > 0 ? (
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((post) => (
            <ReviewPreviewCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="mt-10 max-w-2xl rounded-xl bg-gray-50 p-6">
          <p className="text-sm leading-relaxed text-gray-500">
            No reviews here yet. New picks are published every week — check back soon, or{" "}
            <Link href="/" className="font-semibold text-gray-900 underline underline-offset-2">
              browse all reviews
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
