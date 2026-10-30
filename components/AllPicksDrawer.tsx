"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PickItem } from "@/lib/article";

export interface AllPicksDrawerProps {
  picks: PickItem[];
  /** 抽屉标题，默认为 “All our picks” */
  title?: string;
}

export default function AllPicksDrawer({ picks, title = "All our picks" }: AllPicksDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(false);

  // 滚动到页脚时收掉悬浮按钮，避免压住页脚内容
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setIsFooterVisible(entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  if (picks.length === 0) return null;

  return (
    <>
      <div
        className={`fixed bottom-3 left-3 right-3 z-40 transition-all duration-300 md:bottom-8 md:left-1/2 md:right-auto md:-translate-x-1/2 ${
          isFooterVisible && !isOpen ? "pointer-events-none translate-y-4 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gray-900 py-2.5 pl-3 pr-5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-gray-800 md:w-auto md:justify-start md:gap-3 md:py-2 md:pl-2"
        >
          <span aria-hidden="true" className="flex items-center -space-x-2">
            {picks.slice(0, 3).map((pick) =>
              pick.image ? (
                <Image
                  key={pick.id}
                  src={pick.image.src}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full bg-white object-cover ring-2 ring-gray-900"
                />
              ) : (
                <span
                  key={pick.id}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[10px] font-bold text-gray-900 ring-2 ring-gray-900"
                >
                  {pick.name.slice(0, 1).toUpperCase()}
                </span>
              ),
            )}
          </span>
          See all our picks
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{picks.length}</span>
        </button>
      </div>

      <div
        className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!isOpen}
        role="presentation"
      >
        <div
          onClick={() => setIsOpen(false)}
          className={`absolute inset-0 bg-gray-900/40 transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="picks-drawer-heading"
          className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
            <div>
              <h2 id="picks-drawer-heading" className="text-lg font-bold text-gray-900">
                {title}
              </h2>
              <p className="mt-1 text-xs text-gray-500">Independently tested by WorthSprout</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close picks"
              className="-mr-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              ✕
            </button>
          </div>

          <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto px-6">
            {picks.map((pick) => (
              <li key={pick.id} className="py-6">
                <div className="flex gap-4">
                  {pick.image ? (
                    <Image
                      src={pick.image.src}
                      alt={pick.image.alt}
                      width={96}
                      height={96}
                      className="h-20 w-20 shrink-0 rounded-lg bg-gray-50 object-contain"
                    />
                  ) : (
                    <div aria-hidden="true" className="h-20 w-20 shrink-0 rounded-lg bg-gray-50" />
                  )}

                  <div className="min-w-0">
                    <Link
                      href={pick.href}
                      onClick={() => setIsOpen(false)}
                      className="text-sm font-bold text-gray-900 transition-colors hover:text-gray-600"
                    >
                      {pick.name}
                    </Link>

                    {pick.rating !== null ? (
                      <p className="mt-1 text-xs text-gray-500">{pick.rating.toFixed(1)} / 10</p>
                    ) : null}

                    <ul className="mt-2 flex flex-col gap-1">
                      {pick.merchantLinks.map((link) => (
                        <li key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="nofollow sponsored noopener noreferrer"
                            className="inline-flex items-baseline gap-1 text-sm text-gray-700 transition-colors hover:text-gray-900"
                          >
                            {link.price ? <span className="font-semibold">${link.price}</span> : null}
                            <span className="underline underline-offset-2">{link.merchant}</span>
                            <span aria-hidden="true">→</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-gray-100 px-6 py-4">
            <p className="text-xs leading-relaxed text-gray-500">
              We may earn a commission when you buy through these links. It never affects our picks.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
