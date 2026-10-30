"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { formatDate, stripHtml } from "@/lib/format";
import { ApiError, createComment, fetchComments, type WPComment } from "@/lib/wp-api";

export interface CommentsSectionProps {
  postId: number;
}

function initialOf(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

export default function CommentsSection({ postId }: CommentsSectionProps) {
  const { profile, token, isReady, openModal } = useAuth();

  const [comments, setComments] = useState<WPComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      setComments(await fetchComments(postId));
    } catch (cause) {
      setLoadError(cause instanceof ApiError ? cause.message : "Unable to load comments.");
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || !token) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await createComment(postId, trimmed, token);
      setComments((previous) => [...previous, created]);
      setContent("");
    } catch (cause) {
      setSubmitError(cause instanceof ApiError ? cause.message : "Your comment could not be posted.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canComment = isReady && Boolean(profile && token);

  return (
    <section id="comments" aria-labelledby="comments-heading" className="border-t-4 border-black pt-6">
      <h2 id="comments-heading" className="text-2xl font-bold text-gray-900 md:text-3xl">
        Comments
        {comments.length > 0 ? <span className="ml-2 align-middle text-sm font-medium text-gray-400">{comments.length}</span> : null}
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
              Add comment
              {profile?.name || profile?.username ? (
                <span className="text-gray-400"> as {profile.name || profile.username}</span>
              ) : null}
            </label>
            <textarea
              id="comment-content"
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={isSubmitting}
              placeholder="Add your thoughts…"
              className="mt-2 w-full resize-none border border-gray-300 bg-white px-4 py-3 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none disabled:text-gray-400"
            />
            {submitError ? (
              <p role="alert" className="mt-2 text-sm leading-relaxed text-red-600">
                {submitError}
              </p>
            ) : null}
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || content.trim().length === 0}
                className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSubmitting ? "Posting…" : "Post Comment"}
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
      ) : comments.length === 0 ? (
        <p className="mt-10 text-sm text-gray-500">No comments yet. Be the first to share your experience.</p>
      ) : (
        <ul className="mt-10 flex flex-col gap-8">
          {comments.map((comment) => {
            const name = comment.author_name?.trim() || "Anonymous";

            return (
              <li key={comment.id} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700"
                >
                  {initialOf(name)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-bold text-gray-900">{name}</span>
                    <span className="text-xs text-gray-500">{formatDate(comment.date)}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-700">
                    {stripHtml(comment.content?.rendered)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
