import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-gray-500">404</p>
      <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-gray-900">This review does not exist</h1>
      <p className="mt-4 text-base leading-relaxed text-gray-500">
        The link may be broken, or the article was unpublished in WordPress.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
      >
        Browse all reviews
      </Link>
    </div>
  );
}
