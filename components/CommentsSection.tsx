"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { formatDate, stripHtml } from "@/lib/format";
import { ApiError, createComment, fetchComments, type WPComment } from "@/lib/wp-api";

export interface CommentsSectionProps {
  postId: number;
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
    <section id="comments" aria-labelledby="comments-heading" className="rounded-2xl bg-gray-100 px-6 py-8">
      <h2 id="comments-heading" className="text-2xl font-bold text-gray-900">
        Comments
        {comments.length > 0 ? <span className="ml-2 text-sm font-medium text-gray-400">{comments.length}</span> : null}
      </h2>
      <p className="mt-1 text-sm text-gray-500">Join the conversation — we read every comment.</p>

      {isLoading ? (
        <ul className="mt-6" aria-busy="true">
          {[0, 1].map((index) => (
            <li key={index} className="animate-pulse border-b border-gray-200 py-4">
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-full rounded bg-gray-200" />
              <div className="mt-2 h-3 w-4/5 rounded bg-gray-200" />
            </li>
          ))}
        </ul>
      ) : loadError ? (
        <div className="mt-6 rounded-lg bg-white p-4">
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
        <p className="mt-6 text-sm text-gray-500">No comments yet. Be the first to share your experience.</p>
      ) : (
        <ul className="mt-6">
          {comments.map((comment) => (
            <li key={comment.id} className="border-b border-gray-200 py-4">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-gray-900">{comment.author_name || "Anonymous"}</span>
                <span className="text-xs text-gray-400">{formatDate(comment.date)}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">{stripHtml(comment.content?.rendered)}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-8">
        {canComment ? (
          <>
            <label htmlFor="comment-content" className="text-sm font-medium text-gray-700">
              Add a comment as{" "}
              <span className="font-semibold text-gray-900">{profile?.name || profile?.username}</span>
            </label>
            <textarea
              id="comment-content"
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={isSubmitting}
              placeholder="Share your experience with this product…"
              className="mt-2 w-full resize-none rounded-lg bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
            />
            {submitError ? (
              <p role="alert" className="mt-2 text-sm leading-relaxed text-red-600">
                {submitError}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-xs text-gray-400">Comments are moderated.</p>
              <button
                type="submit"
                disabled={isSubmitting || content.trim().length === 0}
                className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmitting ? "Posting…" : "Post Comment"}
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm text-gray-500">Log in to join the discussion.</p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => openModal("login")}
                className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
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
    </section>
  );
}
