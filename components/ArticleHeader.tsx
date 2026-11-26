"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ShareModal, { type ShareChannel } from "@/components/ShareModal";
import { useAuth } from "@/context/AuthContext";
import { formatDate, orFallback } from "@/lib/format";
import {
  ApiError,
  fetchPostStats,
  recordPostShare,
  togglePostReaction,
  type PostStats,
} from "@/lib/wp-api";
import type { FeaturedImage } from "@/lib/types";

export interface ArticleHeaderProps {
  postId: number;
  title: string;
  category?: string | null;
  author?: string | null;
  date?: string | null;
  image?: FeaturedImage | null;
}

function ActionButton({
  label,
  count,
  isActive,
  disabled,
  onClick,
  children,
}: {
  label: string;
  count?: number;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={typeof count === "number" ? `${label} (${count})` : label}
      title={label}
      aria-pressed={isActive}
      disabled={disabled}
      className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
      {typeof count === "number" ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}

export default function ArticleHeader({ postId, title, category, author, date, image }: ArticleHeaderProps) {
  const { profile, token, openModal } = useAuth();
  const [stats, setStats] = useState<PostStats | null>(null);
  const [busy, setBusy] = useState<"like" | "save" | "share" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState<"Share" | "Link copied">("Share");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchPostStats(postId, token));
    } catch {
      // Counts are supplementary; a failed load must not block the article.
    }
  }, [postId, token]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const requireLogin = () => {
    if (!profile || !token) {
      openModal("login");
      return false;
    }

    return true;
  };

  const react = async (kind: "like" | "save") => {
    if (!requireLogin() || !token) return;

    setBusy(kind);
    setActionError(null);

    try {
      setStats(await togglePostReaction(postId, kind, token));
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.code === "rest_not_logged_in")) {
        openModal("login");
      }
      setActionError(cause instanceof ApiError ? cause.message : "Your reaction could not be saved.");
    } finally {
      setBusy(null);
    }
  };

  const recordShare = async (channel: ShareChannel) => {
    setBusy("share");
    setActionError(null);

    try {
      setStats(await recordPostShare(postId, channel, token));
    } catch {
      // The share already happened; a failed counter should stay invisible.
    } finally {
      setBusy(null);
    }
  };

  const openShare = () => {
    setShareUrl(window.location.href);
    setShareOpen(true);
  };

  const handleShared = (channel: ShareChannel) => {
    if (channel === "copy") {
      setShareLabel("Link copied");
      window.setTimeout(() => setShareLabel("Share"), 3000);
    }

    void recordShare(channel);
  };

  return (
    <header className="mx-auto max-w-6xl px-6 pt-12">
      <div className="max-w-2xl">
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ActionButton
            label={stats?.liked ? "Unlike" : "Like"}
            count={stats?.likes}
            isActive={stats?.liked}
            disabled={busy !== null}
            onClick={() => void react("like")}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
              <path d="M10 17.5 8.6 16.2C4.1 12.1 1.5 9.8 1.5 6.9 1.5 4.6 3.3 2.9 5.6 2.9c1.3 0 2.6.6 3.4 1.6.8-1 2.1-1.6 3.4-1.6 2.3 0 4.1 1.7 4.1 4 0 2.9-2.6 5.2-7.1 9.3L10 17.5Z" />
            </svg>
          </ActionButton>

          <ActionButton
            label={stats?.saved ? "Remove from saved" : "Save for later"}
            count={stats?.saves}
            isActive={stats?.saved}
            disabled={busy !== null}
            onClick={() => void react("save")}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
              <path d="M5 2h10a2 2 0 0 1 2 2v14a1 1 0 0 1-1.6.8L10 15l-5.4 3.8A1 1 0 0 1 3 18V4a2 2 0 0 1 2-2Z" />
            </svg>
          </ActionButton>

          <ActionButton
            label={shareLabel}
            count={stats?.shares}
            disabled={busy !== null}
            onClick={openShare}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
              <path d="M10 1.5a1 1 0 0 1 .7.3l3.5 3.5a1 1 0 0 1-1.4 1.4L11 4.9V12a1 1 0 1 1-2 0V4.9L7.2 6.7a1 1 0 0 1-1.4-1.4l3.5-3.5a1 1 0 0 1 .7-.3ZM3 11a1 1 0 0 1 1 1v4h12v-4a1 1 0 1 1 2 0v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a1 1 0 0 1 1-1Z" />
            </svg>
          </ActionButton>
        </div>

        {actionError ? (
          <p role="alert" className="mt-2 text-xs leading-relaxed text-red-600">
            {actionError}
          </p>
        ) : null}
      </div>

      {image ? (
        // 首图与正文同宽，保持整页只有一条左对齐基准线
        <div data-toc-trigger className="mt-10 max-w-2xl">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width ?? 1200}
            height={image.height ?? 800}
            priority
            sizes="(min-width: 768px) 672px, 100vw"
            className="h-auto max-h-96 w-full rounded-xl object-cover"
          />
        </div>
      ) : null}

      <ShareModal
        open={shareOpen}
        title={title}
        url={shareUrl}
        onClose={() => setShareOpen(false)}
        onShared={handleShared}
      />

      {shareLabel === "Link copied" ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          Link copied to clipboard
        </div>
      ) : null}
    </header>
  );
}
