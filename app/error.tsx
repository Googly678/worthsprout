"use client";

import { useEffect } from "react";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] 页面渲染失败:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Something broke</p>
      <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-gray-900">
        We could not load this page
      </h1>
      <p className="mt-4 text-base leading-relaxed text-gray-500">
        The page failed to render. Try again — if it keeps happening, the content API is probably down.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-4 md:flex-row">
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 md:w-auto"
        >
          Try again
        </button>
        <a
          href="/"
          className="w-full rounded-lg bg-gray-100 px-6 py-3 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 md:w-auto"
        >
          Back to reviews
        </a>
      </div>
    </div>
  );
}
