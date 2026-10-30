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
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Reviews</p>
        <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-gray-900 md:text-5xl">
          We test the boring stuff so you only buy it once.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-gray-500">
          Every product below was bought at retail and lived with for weeks. No sponsored placements, no paid scores.
        </p>
      </header>

      {reviews.length === 0 ? (
        <div className="mt-12 max-w-2xl rounded-xl bg-gray-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">No reviews available right now</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            We could not reach the content API. Refresh in a moment — the site is rebuilt whenever new reviews are
            published.
          </p>
        </div>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((post) => (
            <ReviewPreviewCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
