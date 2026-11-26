"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import {
  ApiError,
  clearNotifications,
  fetchNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/wp-api";

const PAGE_SIZE = 20;

function initialOf(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

export default function NotificationsView() {
  const { profile, token, isReady, openModal, refreshNotificationSummary } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      if (!token) return;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError(null);
      }

      try {
        const result = await fetchNotifications(token, nextPage, PAGE_SIZE);

        setItems((previous) => {
          if (!append) return result.items;

          const seen = new Set(previous.map((item) => item.id));
          return [...previous, ...result.items.filter((item) => !seen.has(item.id))];
        });
        setTotal(result.total);
        setUnread(result.unread);
        setPage(result.page);
        setTotalPages(result.totalPages);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Unable to load your notifications.");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isReady) return;

    if (!token) {
      setIsLoading(false);
      return;
    }

    void load(1);
  }, [isReady, token, load]);

  const handleMarkAll = async () => {
    if (!token) return;

    setIsMarking(true);
    setError(null);
    setNotice(null);

    try {
      const nextUnread = await markNotificationsRead(token, { all: true });
      setUnread(nextUnread);
      setItems((previous) => previous.map((item) => ({ ...item, isRead: true })));
      setNotice("All notifications marked as read.");
      void refreshNotificationSummary();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Your notifications could not be updated.");
    } finally {
      setIsMarking(false);
    }
  };

  const handleClearRead = async () => {
    if (!token) return;

    setIsClearing(true);
    setError(null);
    setNotice(null);

    try {
      const result = await clearNotifications(token, false);
      setUnread(result.unread);
      setNotice(
        result.deleted > 0
          ? `${result.deleted} read notification${result.deleted === 1 ? "" : "s"} cleared.`
          : "There are no read notifications to clear.",
      );
      void refreshNotificationSummary();
      await load(1);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Your notifications could not be cleared.");
    } finally {
      setIsClearing(false);
    }
  };

  const openItem = async (item: NotificationItem) => {
    if (!item.isRead && token) {
      setItems((previous) => previous.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
      setUnread((previous) => Math.max(0, previous - 1));

      try {
        await markNotificationsRead(token, { ids: [item.id] });
      } catch {
        // Navigation should still work if the read receipt fails.
      }

      void refreshNotificationSummary();
    }

    router.push(item.href);
  };

  if (!isReady) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-8 h-56 animate-pulse rounded-xl bg-gray-50" />
      </div>
    );
  }

  if (!profile || !token) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl font-bold leading-tight text-gray-900">Notifications</h1>
        <p className="mt-4 text-base leading-relaxed text-gray-500">
          Log in to see replies and moderation updates.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => openModal("login")}
            className="w-full rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 sm:w-auto"
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => openModal("register")}
            className="w-full rounded-lg bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 sm:w-auto"
          >
            Create an account
          </button>
        </div>
        <p className="mt-8 text-sm text-gray-400">
          <Link href="/" className="transition-colors hover:text-gray-900">
            Back to reviews
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl font-bold leading-tight text-gray-900">Notifications</h1>
          <p className="mt-2 text-sm text-gray-500">
            {total === 0
              ? "Replies and moderation updates will appear here."
              : `${total} total${unread > 0 ? ` · ${unread} unread` : ""}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleMarkAll()}
            disabled={isMarking || unread === 0}
            className="text-sm font-semibold text-gray-700 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            {isMarking ? "Marking…" : "Mark all read"}
          </button>
          <button
            type="button"
            onClick={() => void handleClearRead()}
            disabled={isClearing}
            className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            {isClearing ? "Clearing…" : "Clear read"}
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div role="status" className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm leading-relaxed text-green-700">
          {notice}
        </div>
      ) : null}

      {isLoading ? (
        <ul className="mt-8 space-y-3" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <li key={index} className="flex animate-pulse gap-3 rounded-xl bg-white p-4 shadow-sm">
              <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-32 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-full rounded bg-gray-200" />
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm leading-relaxed text-gray-500">
            No notifications yet. When someone replies to one of your comments, you&apos;ll see it here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-gray-900 underline underline-offset-2 transition-colors hover:text-gray-500"
          >
            Browse reviews
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-sm">
            {items.map((item) => {
              const actorName = item.actor?.name?.trim() || "A reader";
              const avatar = item.actor?.avatarUrl ?? null;

              return (
                <li key={item.id} className={item.isRead ? "bg-white" : "bg-amber-50/40"}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50 md:px-5"
                  >
                    {avatar ? (
                      <Image
                        src={avatar}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white"
                      >
                        {item.type === "reply" ? (item.actor ? initialOf(actorName) : "?") : "W"}
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm leading-relaxed text-gray-700">
                          {item.type === "reply" ? (
                            <>
                              <strong className="font-semibold text-gray-900">{actorName}</strong> replied to your
                              comment
                              {item.post ? (
                                <>
                                  {" "}
                                  on <span className="font-medium text-gray-900">{item.post.title}</span>
                                </>
                              ) : null}
                              .
                            </>
                          ) : (
                            item.message || "There is an update on your account."
                          )}
                        </span>
                        {!item.isRead ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="Unread" />
                        ) : null}
                      </span>

                      {item.excerpt ? (
                        <span className="mt-1 block text-sm leading-relaxed text-gray-600">
                          &ldquo;{item.excerpt}&rdquo;
                        </span>
                      ) : null}

                      <span className="mt-1.5 block text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {page < totalPages ? (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => void load(page + 1, true)}
                disabled={isLoadingMore}
                className="rounded-md bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                {isLoadingMore ? "Loading…" : "Load more notifications"}
              </button>
            </div>
          ) : null}
        </>
      )}

      <p className="mt-10 text-sm text-gray-400">
        Manage what you receive in{" "}
        <Link
          href="/account/#notifications"
          className="font-semibold text-gray-700 underline underline-offset-2 hover:text-gray-900"
        >
          notification settings
        </Link>
        .
      </p>
    </div>
  );
}
