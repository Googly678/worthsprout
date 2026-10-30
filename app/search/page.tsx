import type { Metadata } from "next";
import { Suspense } from "react";
import SearchResults from "@/components/SearchResults";

export const metadata: Metadata = {
  title: "Search",
  description: "Search WorthSprout's independent product reviews.",
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-serif text-4xl font-bold leading-tight text-gray-900">Search</h1>
      <Suspense fallback={<p className="mt-6 text-sm text-gray-500">Loading…</p>}>
        <SearchResults />
      </Suspense>
    </div>
  );
}
