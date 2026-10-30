"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Log in to join the discussion.",
    submit: "Log in",
    pending: "Logging in…",
    switchHint: "New to WorthSprout?",
    switchLabel: "Create an account",
  },
  register: {
    title: "Create your account",
    subtitle: "One account to comment on every review.",
    submit: "Create account",
    pending: "Creating account…",
    switchHint: "Already have an account?",
    switchLabel: "Log in",
  },
} as const;

export default function AuthModal() {
  const { isModalOpen, mode, error, isSubmitting, closeModal, switchMode, login, register } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isModalOpen) return;

    setLocalError(null);
    setPassword("");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    firstFieldRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isModalOpen, closeModal]);

  if (!isModalOpen) return null;

  const copy = COPY[mode];
  const message = localError ?? error;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    if (!username.trim()) {
      setLocalError("Please enter your username.");
      return;
    }

    if (mode === "register" && !EMAIL_PATTERN.test(email.trim())) {
      setLocalError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "login") {
      await login(username.trim(), password);
    } else {
      await register(username.trim(), email.trim(), password);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-modal-title" className="text-2xl font-bold text-gray-900">
              {copy.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">{copy.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close dialog"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 flex border-b border-gray-100" role="tablist" aria-label="Authentication mode">
          {(["login", "register"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mode === tab}
              onClick={() => switchMode(tab)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                mode === tab
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="auth-username" className="text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="auth-username"
              ref={firstFieldRef}
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
              placeholder="yourname"
            />
          </div>

          {mode === "register" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="auth-email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
                placeholder="you@example.com"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label htmlFor="auth-password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
              placeholder="••••••••"
            />
          </div>

          {message ? (
            <p role="alert" aria-live="polite" className="rounded-lg bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-600">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSubmitting ? copy.pending : copy.submit}
          </button>

          <p className="text-center text-sm text-gray-500">
            {copy.switchHint}{" "}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              className="font-semibold text-gray-900 underline-offset-2 transition-colors hover:text-gray-500 hover:underline"
            >
              {copy.switchLabel}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
