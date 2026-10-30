import Image from "next/image";
import Link from "next/link";
import { getReviewFeaturedImage, getReviewTitle } from "@/lib/present";
import type { ReviewPost } from "@/lib/types";

export interface RelatedArticlesProps {
  posts: ReviewPost[];
  heading?: string;
}

export default function RelatedArticles({ posts, heading = "Related reviews" }: RelatedArticlesProps) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="related-heading">
      <h2 id="related-heading" className="text-xs font-bold uppercase tracking-widest text-gray-500">
        {heading}
      </h2>

      <ul className="mt-4 flex flex-col gap-4">
        {posts.map((post) => {
          const image = getReviewFeaturedImage(post);
          const title = getReviewTitle(post);

          return (
            <li key={post.id}>
              <Link href={`/reviews/${post.slug}/`} className="group flex items-start gap-3">
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                  {image ? (
                    <Image
                      src={image.src}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : null}
                </span>
                <span className="line-clamp-3 text-sm font-semibold leading-snug text-gray-900 transition-colors group-hover:text-gray-500">
                  {title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
