"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { formatDate, orFallback } from "@/lib/format";
import type { FeaturedImage } from "@/lib/types";

export interface ArticleHeaderProps {
  title: string;
  category?: string | null;
  author?: string | null;
  date?: string | null;
  image?: FeaturedImage | null;
}

function ActionButton({
  label,
  isActive,
  onClick,
  children,
}: {
  label: string;
  isActive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={isActive}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
        isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

export default function ArticleHeader({ title, category, author, date, image }: ArticleHeaderProps) {
  const { profile, openModal } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [shareLabel, setShareLabel] = useState<"Share" | "Link copied">("Share");

  // 收藏按用户隔离：每个账号一个 key，未登录不落盘
  const storageKey = profile ? `worthsprout.saved.${profile.username}` : null;

  useEffect(() => {
    if (!storageKey) {
      setIsSaved(false);
      return;
    }

    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[];
      setIsSaved(saved.includes(title));
    } catch {
      setIsSaved(false);
    }
  }, [storageKey, title]);

  const toggleSave = () => {
    if (!profile || !storageKey) {
      // 没有用户就没有“保存到哪儿”的问题，先引导登录
      openModal("login");
      return;
    }

    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[];
      const next = saved.includes(title) ? saved.filter((item) => item !== title) : [...saved, title];
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setIsSaved(next.includes(title));
    } catch {
      setIsSaved((previous) => !previous);
    }
  };

  const share = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      setShareLabel("Link copied");
      window.setTimeout(() => setShareLabel("Share"), 2000);
    } catch {
      setShareLabel("Share");
    }
  };

  return (
    <header className="mx-auto max-w-2xl px-6 pt-12">
      <nav aria-label="Breadcrumb" className="text-xs font-bold uppercase tracking-wider text-gray-500">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="transition-colors hover:text-gray-900">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/" className="transition-colors hover:text-gray-900">
              Reviews
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-900">{orFallback(category, "Review")}</li>
        </ol>
      </nav>

      <div className="mb-4 mt-8 w-32 border-t-4 border-black" />

      <h1 className="mb-4 text-4xl font-black leading-[1.05] tracking-tight text-gray-900 md:text-5xl">{title}</h1>

      <p className="text-sm text-gray-500">
        By <span className="font-semibold text-gray-900">{orFallback(author, "WorthSprout Editorial")}</span>
        <span aria-hidden="true" className="px-1">
          ·
        </span>
        Updated {formatDate(date)}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <ActionButton label={shareLabel} onClick={() => void share()}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
            <path d="M10 1.5a1 1 0 0 1 .7.3l3.5 3.5a1 1 0 0 1-1.4 1.4L11 4.9V12a1 1 0 1 1-2 0V4.9L7.2 6.7a1 1 0 0 1-1.4-1.4l3.5-3.5a1 1 0 0 1 .7-.3ZM3 11a1 1 0 0 1 1 1v4h12v-4a1 1 0 1 1 2 0v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a1 1 0 0 1 1-1Z" />
          </svg>
        </ActionButton>

        <ActionButton label={isSaved ? "Remove from saved" : "Save for later"} isActive={isSaved} onClick={toggleSave}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
            <path d="M5 2h10a2 2 0 0 1 2 2v14a1 1 0 0 1-1.6.8L10 15l-5.4 3.8A1 1 0 0 1 3 18V4a2 2 0 0 1 2-2Z" />
          </svg>
        </ActionButton>
      </div>

      {image ? (
        <div data-toc-trigger className="mt-8">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width ?? 1200}
            height={image.height ?? 800}
            priority
            sizes="(min-width: 672px) 672px, 100vw"
            className="h-auto max-h-96 w-full rounded-xl object-cover"
          />
        </div>
      ) : null}
    </header>
  );
}
