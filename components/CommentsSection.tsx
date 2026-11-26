"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { formatDate, stripHtml } from "@/lib/format";
import {
  ApiError,
  createComment,
  deleteComment,
  fetchComments,
  reportComment,
  updateComment,
  type WPComment,
} from "@/lib/wp-api";

export interface CommentsSectionProps {
  postId: number;
}

interface CommentNode extends WPComment {
  children: CommentNode[];
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam or advertising" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "misinformation", label: "Misinformation" },
  { value: "off_topic", label: "Off-topic" },
  { value: "other", label: "Something else" },
] as const;

function initialOf(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

export default function CommentsSection({ postId }: CommentsSectionProps) {
  const { profile, token, isReady, openModal, logout } = useAuth();

  const [comments, setComments] = useState<WPComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);
  const [editing, setEditing] = useState<{ id: number; content: string } | null>(null);
  const [savingEditId, setSavingEditId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [sessionRejected, setSessionRejected] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reporting, setReporting] = useState<{ id: number; reason: string; details: string } | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<number>>(new Set());
  const [isReporting, setIsReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hashHandled = useRef(false);

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setLoadError(null);
      }

      try {
        const result = await fetchComments(postId, nextPage);
        setComments((previous) => {
          if (!append) return result.comments;

          const seen = new Set(previous.map((comment) => comment.id));
          return [...previous, ...result.comments.filter((comment) => !seen.has(comment.id))];
        });
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(nextPage);
      } catch (cause) {
        if (!append) {
          setLoadError(cause instanceof ApiError ? cause.message : "Unable to load comments.");
        }
      } finally {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [postId],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  // Links from notifications point at #comment-{id}; land on the right reply.
  useEffect(() => {
    if (typeof window === "undefined" || comments.length === 0 || hashHandled.current) return;

    const match = window.location.hash.match(/^#comment-(\d+)$/);
    if (!match) return;

    const id = Number(match[1]);
    if (!Number.isFinite(id) || id <= 0) return;

    const scrollToTarget = (attempt: number) => {
      const element = document.getElementById(`comment-${id}`);

      if (!element) {
        if (attempt === 0) {
          // The comment might be on a later page; at least land on the section.
          hashHandled.current = true;
          document.getElementById("comments")?.scrollIntoView({ behavior: "auto", block: "start" });
        }
        return;
      }

      if (attempt === 0) {
        hashHandled.current = true;
        setHighlightId(id);
        window.setTimeout(() => setHighlightId(null), 6000);
      }

      const rect = element.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        element.scrollIntoView({
          behavior: attempt === 0 ? "smooth" : "auto",
          block: "center",
        });
      }

      // Review images lazy-load and can move the comment after the first scroll.
      if (attempt < 5) {
        window.setTimeout(() => scrollToTarget(attempt + 1), attempt === 0 ? 900 : 1200);
      }
    };

    const timer = window.setTimeout(() => scrollToTarget(0), 150);

    return () => window.clearTimeout(timer);
  }, [comments]);

  const startReply = (comment: WPComment) => {
    const name = comment.author_name?.trim() || "this reader";
    setReplyTo({ id: comment.id, name });
    setEditing(null);
    setReporting(null);
    setReportError(null);

    window.requestAnimationFrame(() => {
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      textareaRef.current?.focus();
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || !token) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitNotice(null);
    setSessionRejected(false);

    try {
      const created = await createComment(postId, trimmed, token, replyTo?.id ?? 0);
      setContent("");
      setReplyTo(null);

      if (created.status === "hold") {
        setSubmitNotice("Your comment was submitted and is awaiting moderation.");
      } else {
        setComments((previous) =>
          previous.some((item) => item.id === created.id) ? previous : [...previous, created],
        );
        setTotal((previous) => previous + 1);
        setSubmitNotice(replyTo ? "Reply posted." : "Comment posted.");
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setSessionRejected(true);
      }
      setSubmitError(cause instanceof ApiError ? cause.message : "Your comment could not be posted.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (comment: WPComment) => {
    if (!token || !window.confirm("Delete this comment? This cannot be undone.")) return;

    setDeletingId(comment.id);
    setSubmitError(null);

    try {
      await deleteComment(comment.id, token);
      setComments((previous) => previous.filter((item) => item.id !== comment.id));
      setTotal((previous) => Math.max(0, previous - 1));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setSessionRejected(true);
      }
      setSubmitError(cause instanceof ApiError ? cause.message : "Your comment could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSave = async () => {
    if (!token || !editing) return;

    const trimmed = editing.content.trim();
    if (!trimmed) {
      setSubmitError("Comment cannot be empty.");
      return;
    }

    setSavingEditId(editing.id);
    setSubmitError(null);

    try {
      const updated = await updateComment(editing.id, trimmed, token);
      setComments((previous) => previous.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setEditing(null);
      setSubmitNotice("Comment updated.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setSessionRejected(true);
      }
      setSubmitError(cause instanceof ApiError ? cause.message : "Your comment could not be updated.");
    } finally {
      setSavingEditId(null);
    }
  };

  const startReport = (comment: WPComment) => {
    setReporting({ id: comment.id, reason: "spam", details: "" });
    setReportError(null);
    setEditing(null);
    setReplyTo(null);
  };

  const handleReportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !reporting) return;

    setIsReporting(true);
    setReportError(null);

    try {
      await reportComment(reporting.id, reporting.reason, reporting.details.trim(), token);
      const reportedId = reporting.id;
      setReportedIds((previous) => new Set(previous).add(reportedId));
      setReporting(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "rest_report_exists") {
        const reportedId = reporting.id;
        setReportedIds((previous) => new Set(previous).add(reportedId));
        setReporting(null);
      } else {
        if (cause instanceof ApiError && cause.status === 401) {
          setSessionRejected(true);
        }
        setReportError(cause instanceof ApiError ? cause.message : "Your report could not be submitted.");
      }
    } finally {
      setIsReporting(false);
    }
  };

  const tree = useMemo(() => {
    const nodes = new Map<number, CommentNode>();
    const roots: CommentNode[] = [];

    for (const comment of comments) {
      nodes.set(comment.id, { ...comment, children: [] });
    }

    for (const node of nodes.values()) {
      const parent = node.parent ? nodes.get(node.parent) : null;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }, [comments]);

  const canComment = isReady && Boolean(profile && token);

  const renderComment = (node: CommentNode, depth: number): ReactNode => {
    const name = node.author_name?.trim() || "Anonymous";
    const avatar = node.author_avatar_urls ? Object.values(node.author_avatar_urls)[0] ?? null : null;
    const isMine = Boolean(profile?.id && node.author === profile.id);
    const isEditing = editing?.id === node.id;
    const isReportingHere = reporting?.id === node.id;
    const isHighlighted = highlightId === node.id;

    return (
      <li
        key={node.id}
        id={`comment-${node.id}`}
        className={`flex scroll-mt-24 gap-3 rounded-lg transition-colors ${
          isHighlighted ? "bg-amber-50 p-2 ring-1 ring-amber-200" : ""
        }`}
      >
        {avatar ? (
          <Image
            src={avatar}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700"
          >
            {initialOf(name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold text-gray-900">{name}</span>
            <span className="text-xs text-gray-500">{formatDate(node.date)}</span>
            {node.status === "hold" ? (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                Pending
              </span>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {canComment ? (
                <button
                  type="button"
                  onClick={() => startReply(node)}
                  className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-900"
                >
                  Reply
                </button>
              ) : null}
              {canComment && !isMine ? (
                reportedIds.has(node.id) ? (
                  <span className="text-xs font-medium text-gray-400">Reported</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => startReport(node)}
                    className="text-xs font-medium text-gray-400 transition-colors hover:text-red-600"
                  >
                    Report
                  </button>
                )
              ) : null}
              {isMine ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing({ id: node.id, content: stripHtml(node.content?.rendered) });
                      setSubmitError(null);
                    }}
                    className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-900"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(node)}
                    disabled={deletingId === node.id}
                    className="text-xs font-medium text-gray-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300"
                  >
                    {deletingId === node.id ? "Deleting…" : "Delete"}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {isEditing ? (
            <div className="mt-2">
              <textarea
                aria-label="Edit comment"
                rows={4}
                value={editing.content}
                onChange={(event) => setEditing({ id: node.id, content: event.target.value })}
                className="w-full resize-none border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-gray-900 focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleEditSave()}
                  disabled={savingEditId === node.id || editing.content.trim().length === 0}
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {savingEditId === node.id ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-sm leading-relaxed text-gray-700">
              {stripHtml(node.content?.rendered)}
            </p>
          )}

          {reporting && reporting.id === node.id ? (
            <form
              onSubmit={(event) => void handleReportSubmit(event)}
              className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <p className="text-sm font-semibold text-gray-900">Report this comment</p>

              <div className="mt-3 flex flex-col gap-1">
                <label htmlFor={`report-reason-${node.id}`} className="text-xs font-medium text-gray-600">
                  Reason
                </label>
                <select
                  id={`report-reason-${node.id}`}
                  value={reporting.reason}
                  onChange={(event) =>
                    setReporting((previous) =>
                      previous ? { ...previous, reason: event.target.value } : previous,
                    )
                  }
                  disabled={isReporting}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none disabled:text-gray-400"
                >
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex flex-col gap-1">
                <label htmlFor={`report-details-${node.id}`} className="text-xs font-medium text-gray-600">
                  Details (optional)
                </label>
                <textarea
                  id={`report-details-${node.id}`}
                  rows={3}
                  maxLength={1000}
                  value={reporting.details}
                  onChange={(event) =>
                    setReporting((previous) =>
                      previous ? { ...previous, details: event.target.value } : previous,
                    )
                  }
                  disabled={isReporting}
                  placeholder="Anything that helps us understand the problem…"
                  className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none disabled:text-gray-400"
                />
              </div>

              {reportError ? (
                <p role="alert" className="mt-2 text-sm leading-relaxed text-red-600">
                  {reportError}
                </p>
              ) : null}

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isReporting}
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isReporting ? "Sending…" : "Submit report"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReporting(null);
                    setReportError(null);
                  }}
                  className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {node.children.length > 0 ? (
            <ul className={`mt-4 space-y-4 ${depth < 2 ? "border-l border-gray-100 pl-4" : ""}`}>
              {node.children.map((child) => renderComment(child, depth + 1))}
            </ul>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <section id="comments" aria-labelledby="comments-heading" className="border-t-4 border-black pt-6">
      <h2 id="comments-heading" className="text-2xl font-bold text-gray-900 md:text-3xl">
        Comments
        {total > 0 ? <span className="ml-2 align-middle text-sm font-medium text-gray-400">{total}</span> : null}
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        Be kind. Ask questions. Stay on topic. Promotional links and spam will be removed. WorthSprout is
        reader-supported — read{" "}
        <Link href="/affiliate-disclosure/" className="underline underline-offset-2 hover:text-gray-900">
          how we make money
        </Link>{" "}
        and our{" "}
        <Link href="/privacy-policy/" className="underline underline-offset-2 hover:text-gray-900">
          privacy policy
        </Link>
        .
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        {canComment ? (
          <>
            <label htmlFor="comment-content" className="text-sm font-medium text-gray-700">
              {replyTo ? "Write a reply" : "Add comment"}
              {profile?.name || profile?.username ? (
                <span className="text-gray-400"> as {profile.name || profile.username}</span>
              ) : null}
            </label>
            {replyTo ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span>
                  Replying to <strong className="text-gray-900">{replyTo.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="font-semibold text-gray-500 transition-colors hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <textarea
              id="comment-content"
              ref={textareaRef}
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={isSubmitting}
              placeholder={replyTo ? "Write your reply…" : "Add your thoughts…"}
              className="mt-2 w-full resize-none border border-gray-300 bg-white px-4 py-3 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none disabled:text-gray-400"
            />
            {submitError ? (
              <p role="alert" className="mt-2 text-sm leading-relaxed text-red-600">
                {submitError}
              </p>
            ) : null}
            {submitNotice ? (
              <p role="status" aria-live="polite" className="mt-2 text-sm leading-relaxed text-gray-600">
                {submitNotice}
              </p>
            ) : null}
            {sessionRejected ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-600">If this keeps happening, sign in again.</span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    openModal("login");
                  }}
                  className="font-semibold text-gray-900 underline underline-offset-2 hover:text-gray-500"
                >
                  Log out and sign in
                </button>
              </div>
            ) : null}
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || content.trim().length === 0}
                className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSubmitting ? "Posting…" : replyTo ? "Post Reply" : "Post Comment"}
              </button>
            </div>
          </>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700">Add comment</p>
            <textarea
              id="comment-content"
              rows={4}
              disabled
              placeholder="Log in to join the discussion."
              className="mt-2 w-full resize-none border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400 placeholder:text-gray-400"
            />
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => openModal("login")}
                className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => openModal("register")}
                className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
              >
                Create an account
              </button>
            </div>
          </div>
        )}
      </form>

      {isLoading ? (
        <ul className="mt-10" aria-busy="true">
          {[0, 1].map((index) => (
            <li key={index} className="flex animate-pulse gap-3 py-4">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-24 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-full rounded bg-gray-200" />
                <div className="mt-2 h-3 w-4/5 rounded bg-gray-200" />
              </div>
            </li>
          ))}
        </ul>
      ) : loadError ? (
        <div className="mt-8">
          <p className="text-sm leading-relaxed text-gray-500">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-sm font-semibold text-gray-900 transition-colors hover:text-gray-500"
          >
            Try again
          </button>
        </div>
      ) : tree.length === 0 ? (
        <p className="mt-10 text-sm text-gray-500">No comments yet. Be the first to share your experience.</p>
      ) : (
        <>
          <ul className="mt-10 flex flex-col gap-8">
            {tree.map((node) => renderComment(node, 0))}
          </ul>

          {page < totalPages ? (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => void load(page + 1, true)}
                disabled={isLoadingMore}
                className="rounded-md bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                {isLoadingMore ? "Loading…" : "Load more comments"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
