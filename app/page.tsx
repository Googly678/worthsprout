import type { Metadata } from "next";
import ReviewPreviewCard from "@/components/ReviewPreviewCard";
import { safeGetAllReviews } from "@/lib/wordpress";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Every WorthSprout review, ranked by our hands-on test scores.",
};

export default async function HomePage() {
  const reviews = await safeGetAllReviews();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* 视觉上不显示，但保留语义标题，避免首页缺失 h1 */}
      <h1 className="sr-only">WorthSprout product reviews</h1>

      {reviews.length === 0 ? (
        <div className="mt-12 max-w-2xl rounded-xl bg-gray-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">No reviews available right now</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            We could not reach the content API. Refresh in a moment — the site is rebuilt whenever new reviews are
            published.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((post) => (
            <ReviewPreviewCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
