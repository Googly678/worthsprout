export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12" aria-busy="true" aria-live="polite">
      <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 h-8 w-2/3 animate-pulse rounded bg-gray-100" />
      <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-gray-100" />

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="rounded-xl bg-white p-6 shadow-sm">
            <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
            <div className="mt-6 h-5 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="mt-2 h-4 w-full animate-pulse rounded bg-gray-100" />
            <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
