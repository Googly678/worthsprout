"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountView() {
  const {
    profile,
    isReady,
    isLoadingProfile,
    profileError,
    openModal,
    logout,
    updateProfile,
    deleteAccount,
  } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // profile 变化（首次加载 / 保存成功）时同步表单
  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setEmail(profile.email);
    setDescription(profile.description);
  }, [profile]);

  if (!isReady) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-8 h-64 animate-pulse rounded-xl bg-gray-50" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl font-bold leading-tight text-gray-900">You are not logged in</h1>
        <p className="mt-4 text-base leading-relaxed text-gray-500">
          Log in to manage your profile, change your password, or delete your account.
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!name.trim()) {
      setMessage("Display name cannot be empty.");
      return;
    }

    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setMessage("Please enter a valid email address.");
      return;
    }

    if (password) {
      if (password.length < 6) {
        setMessage("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }
    }

    setIsSaving(true);
    const ok = await updateProfile({
      name: name.trim(),
      email: email.trim(),
      description: description.trim(),
      password: password || undefined,
    });
    setIsSaving(false);

    if (ok) {
      setPassword("");
      setConfirmPassword("");
      setMessage("Your profile has been saved.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete your account permanently? This cannot be undone.")) return;

    setIsDeleting(true);
    const ok = await deleteAccount();
    setIsDeleting(false);

    if (!ok) setMessage(null);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-serif text-4xl font-bold leading-tight text-gray-900">My profile</h1>

      <div className="mt-8 flex items-center gap-4">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-xl font-semibold text-white"
          >
            {(profile.name || profile.username).slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-gray-900">{profile.name || profile.username}</p>
          <p className="truncate text-sm text-gray-500">@{profile.username}</p>
          <p className="mt-1 text-xs text-gray-400">Avatars come from Gravatar, based on your email.</p>
        </div>
      </div>

      {profileError ? (
        <div role="alert" className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          {profileError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-8 rounded-xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-bold text-gray-900">Account details</h2>

        {isLoadingProfile ? (
          <p className="mt-2 text-sm text-gray-400">Loading your profile…</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="profile-name" className="text-sm font-medium text-gray-700">
              Display name
            </label>
            <input
              id="profile-name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving}
              className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="profile-email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="profile-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSaving}
              className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="profile-bio" className="text-sm font-medium text-gray-700">
              Bio
            </label>
            <textarea
              id="profile-bio"
              name="description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSaving}
              placeholder="A short line about you…"
              className="w-full resize-none rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="profile-password" className="text-sm font-medium text-gray-700">
                New password
              </label>
              <input
                id="profile-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSaving}
                placeholder="Leave blank to keep current"
                className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="profile-password-confirm" className="text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <input
                id="profile-password-confirm"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSaving || !password}
                placeholder="Repeat new password"
                className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
              />
            </div>
          </div>

          {message ? (
            <p role="status" aria-live="polite" className="text-sm leading-relaxed text-gray-700">
              {message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={logout}
              className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              Log out
            </button>
          </div>
        </div>
      </form>

      <section className="mt-8 rounded-xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-bold text-gray-900">Delete account</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          This removes your profile and signs you out. WordPress does not let regular users delete themselves, so this
          may need a site administrator — you will see the exact reason if it fails.
        </p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="mt-4 rounded-lg bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          {isDeleting ? "Deleting…" : "Delete my account"}
        </button>
      </section>
    </div>
  );
}
