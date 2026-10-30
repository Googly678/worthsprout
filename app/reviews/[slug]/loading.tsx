export default function ArticleLoading() {
  return (
    <div className="mx-auto max-w-2xl px-6 pb-16 pt-12" aria-busy="true" aria-live="polite">
      <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 h-9 w-full animate-pulse rounded bg-gray-100" />
      <div className="mt-2 h-9 w-2/3 animate-pulse rounded bg-gray-100" />
      <div className="mt-6 h-4 w-48 animate-pulse rounded bg-gray-100" />
      <div className="mb-12 mt-8 h-64 animate-pulse rounded-xl bg-gray-100" />

      <div className="rounded-xl bg-white p-6 shadow-sm md:p-8">
        <div className="h-6 w-1/2 animate-pulse rounded bg-gray-100" />
        <div className="mt-2 h-7 w-24 animate-pulse rounded-md bg-gray-100" />
        <div className="mt-6 space-y-2 rounded-lg bg-gray-50 p-4">
          <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
        </div>
      </div>

      <div className="mt-12 space-y-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-4 w-full animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
