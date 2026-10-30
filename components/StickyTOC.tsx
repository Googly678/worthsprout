"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Heading } from "@/lib/article";

export interface StickyTOCProps {
  headings: Heading[];
}

export default function StickyTOC({ headings }: StickyTOCProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 首图滚出视口后才出现，避免和文章标题抢注意力
  useEffect(() => {
    const trigger = document.querySelector("[data-toc-trigger]");
    let frame: number | null = null;

    const measure = () => {
      frame = null;

      if (!trigger) {
        setIsVisible(window.scrollY > 400);
        return;
      }

      setIsVisible(trigger.getBoundingClientRect().bottom <= 0);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  const scrollTo = useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target) return;

    // 目录展开时会把下方内容推低，先收起再测量，否则会多滚一段
    setIsOpen(false);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        // 目录自身 sticky 后的 top 已经包含页头和联盟告知条的高度
        const tocTop = containerRef.current?.getBoundingClientRect().top ?? 0;
        const toggleHeight = containerRef.current?.querySelector("button")?.getBoundingClientRect().height ?? 0;
        const offset = tocTop + toggleHeight + 16;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;

        window.scrollTo({ top, behavior: "smooth" });
      });
    });

    // 让地址栏同步锚点，但不触发额外跳转
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  if (!isVisible || headings.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="sticky top-16 z-30 mt-12 border-y border-gray-200 bg-gray-100/95 backdrop-blur"
    >
      <div className="mx-auto max-w-2xl px-6">
        <button
          type="button"
          onClick={() => setIsOpen((previous) => !previous)}
          aria-expanded={isOpen}
          aria-controls="toc-panel"
          className="flex w-full items-center justify-between gap-4 py-3 text-left"
        >
          <span className="flex flex-wrap items-baseline gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Browse</span>
            <span className="text-sm font-medium text-gray-900">Sections in this article</span>
          </span>
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 fill-gray-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
          >
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>

        {isOpen ? (
          <nav id="toc-panel" aria-label="Sections in this article" className="pb-4">
            <ul className="flex flex-col gap-1">
              {headings.map((heading) => (
                <li key={heading.id}>
                  <button
                    type="button"
                    onClick={() => scrollTo(heading.id)}
                    className="w-full rounded-md px-2 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-white hover:text-gray-900"
                  >
                    {heading.text}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
