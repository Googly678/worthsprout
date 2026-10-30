import Image from "next/image";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { getReviewExcerpt, getReviewFeaturedImage, getReviewRating, getReviewTitle } from "@/lib/present";
import type { ReviewPost } from "@/lib/types";
import RatingBadge from "./RatingBadge";

export interface ReviewPreviewCardProps {
  post: ReviewPost;
}

export default function ReviewPreviewCard({ post }: ReviewPreviewCardProps) {
  const title = getReviewTitle(post);
  const image = getReviewFeaturedImage(post);
  const rating = getReviewRating(post);

  return (
    <article className="group flex h-full flex-col rounded-xl bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <Link href={`/reviews/${post.slug}`} className="block overflow-hidden rounded-lg bg-gray-50">
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width ?? 800}
            height={image.height ?? 500}
            sizes="(min-width: 768px) 360px, 100vw"
            className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-xs font-medium uppercase tracking-widest text-gray-400">
            No image
          </div>
        )}
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold leading-snug text-gray-900">
          <Link href={`/reviews/${post.slug}`} className="transition-colors hover:text-gray-500">
            {title}
          </Link>
        </h2>
        <RatingBadge rating={rating} />
      </div>

      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-500">{getReviewExcerpt(post, 130)}</p>

      <p className="mt-4 text-xs text-gray-400">Updated {formatDate(post.modified ?? post.date)}</p>
    </article>
  );
}
