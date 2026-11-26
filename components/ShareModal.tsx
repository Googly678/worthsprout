"use client";

import { useEffect, useRef, useState } from "react";

export type ShareChannel = "x" | "facebook" | "linkedin" | "reddit" | "email" | "copy";

interface ShareModalProps {
  open: boolean;
  title: string;
  url: string;
  onClose: () => void;
  onShared: (channel: ShareChannel) => void;
}

const PLATFORM_CLASS = {
  x: "bg-gray-900 text-white hover:bg-gray-800",
  facebook: "bg-[#1877F2] text-white hover:bg-[#0f63d0]",
  linkedin: "bg-[#0A66C2] text-white hover:bg-[#084f96]",
  reddit: "bg-[#FF4500] text-white hover:bg-[#e03d00]",
  email: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  copy: "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
} as const;

export default function ShareModal({ open, title, url, onClose, onShared }: ShareModalProps) {
  const [error, setError] = useState<string | null>(null);
  const firstButtonRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    firstButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onShared("copy");
      onClose();
    } catch {
      setError("Could not copy the link. Copy it from the address bar.");
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const platforms: {
    channel: Exclude<ShareChannel, "copy">;
    label: string;
    badge: string;
    href: string;
  }[] = [
    {
      channel: "x",
      label: "X",
      badge: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      channel: "facebook",
      label: "Facebook",
      badge: "f",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      channel: "linkedin",
      label: "LinkedIn",
      badge: "in",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      channel: "reddit",
      label: "Reddit",
      badge: "r/",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      channel: "email",
      label: "Email",
      badge: "✉",
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="share-modal-title" className="text-xl font-bold text-gray-900">
              Share this article
            </h2>
            <p className="mt-1 text-sm text-gray-500">Send it to your people.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="-mr-2 rounded-lg px-3 py-1.5 text-lg leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {platforms.map((platform, index) => (
            <a
              key={platform.channel}
              ref={index === 0 ? firstButtonRef : undefined}
              href={platform.href}
              target={platform.channel === "email" ? undefined : "_blank"}
              rel={platform.channel === "email" ? undefined : "noopener noreferrer"}
              aria-label={platform.channel === "email" ? "Share by email" : `Share on ${platform.label}`}
              onClick={() => {
                onShared(platform.channel);
                // Let the browser start the navigation before unmounting the link.
                window.setTimeout(onClose, 0);
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${PLATFORM_CLASS[platform.channel]}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-black">
                {platform.badge}
              </span>
              {platform.label}
            </a>
          ))}

          <button
            type="button"
            onClick={() => void copyLink()}
            className={`flex items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${PLATFORM_CLASS.copy}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-black">
              ⧉
            </span>
            Copy link
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
            {error}
          </p>
        ) : null}

        <p className="mt-4 text-xs leading-relaxed text-gray-500">
          Social links open in a new tab; Email opens your mail app. On mobile, your browser may offer its own share
          sheet.
        </p>
      </div>
    </div>
  );
}
