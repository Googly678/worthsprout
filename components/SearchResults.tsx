"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { extractHeadings, toPickItem, type PickItem } from "@/lib/article";
import { getReviewExcerpt } from "@/lib/present";
import { safeGetAllReviews } from "@/lib/wordpress";
import type { ReviewPost } from "@/lib/types";

interface SearchHit {
  pick: PickItem;
  excerpt: string;
  tags: string[];
}

function matches(post: ReviewPost, term: string): boolean {
  const haystack = [
    post.title?.rendered,
    post.acf?.product_name,
    post.acf?.pros,
    post.acf?.cons,
    post.content?.rendered,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(term);
}

export default function SearchResults() {
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const reviews = await safeGetAllReviews();
        if (cancelled) return;

        const term = query.toLowerCase();
        const results = (term ? reviews.filter((post) => matches(post, term)) : []).map((post) => {
          const { headings } = extractHeadings(post.content?.rendered ?? "");

          return {
            pick: toPickItem(post, { summary: getReviewExcerpt(post, 90) }),
            excerpt: getReviewExcerpt(post, 160),
            tags: headings.slice(0, 3).map((heading) => heading.text),
          };
        });

        setHits(results);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Search failed. Please try again.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!query) {
    return (
      <p className="mt-6 text-sm text-gray-500">Type a product name, brand, or category to search our reviews.</p>
    );
  }

  if (isLoading) {
    return (
      <ul className="mt-6 space-y-4" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <li key={index} className="animate-pulse rounded-xl bg-white p-4 shadow-sm">
            <div className="h-4 w-1/3 rounded bg-gray-100" />
            <div className="mt-2 h-3 w-full rounded bg-gray-100" />
          </li>
        ))}
      </ul>
    );
  }

  if (error) {
    return <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">{error}</p>;
  }

  if (hits.length === 0) {
    return (
      <p className="mt-6 text-sm text-gray-500">
        No results for <span className="font-semibold text-gray-900">“{query}”</span>. Try a shorter or more general
        term.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {hits.map(({ pick, excerpt, tags }) => (
        <li key={pick.id} className="rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex gap-4">
            {pick.image ? (
              <Image
                src={pick.image.src}
                alt={pick.image.alt}
                width={80}
                height={80}
                className="h-16 w-16 shrink-0 rounded-lg bg-gray-50 object-contain"
              />
            ) : null}

            <div className="min-w-0">
              <Link
                href={pick.href}
                className="text-base font-bold text-gray-900 transition-colors hover:text-gray-600"
              >
                {pick.name}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500">{excerpt}</p>
              {tags.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
