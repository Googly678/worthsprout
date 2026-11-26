"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import {
  ApiError,
  confirmEmailChange,
  fetchMyActivity,
  fetchNotifications,
  markNotificationsRead,
  resetPassword as resetPasswordRequest,
  type ActivityItem,
  type CommentActivityItem,
  type MyActivity,
  type NotificationItem,
  type ShareActivityItem,
} from "@/lib/wp-api";

type ActivityRow = ActivityItem | CommentActivityItem | ShareActivityItem;
type AccountTab = "profile" | "password" | "inbox" | "activity" | "settings" | "danger";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WP_ADMIN_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_BASE_URL ?? "https://cms.worthsprout.com/wp-json").replace(
  /\/wp-json\/?$/,
  "",
);
const REPORTS_URL = `${WP_ADMIN_BASE}/wp-admin/edit-comments.php?page=ws-reports`;

const HASH_TO_TAB: Record<string, AccountTab> = {
  profile: "profile",
  password: "password",
  inbox: "inbox",
  activity: "activity",
  settings: "settings",
  // Backwards-compatible with the link used in reply emails.
  notifications: "settings",
  danger: "danger",
};

function tabFromHash(): AccountTab {
  if (typeof window === "undefined") return "profile";

  const hash = window.location.hash.replace(/^#/, "");
  return HASH_TO_TAB[hash] ?? "profile";
}

const NAV_GROUPS: { label: string; items: { key: AccountTab; label: string; danger?: boolean }[] }[] = [
  {
    label: "Account",
    items: [
      { key: "profile", label: "Profile" },
      { key: "password", label: "Password" },
    ],
  },
  {
    label: "Community",
    items: [
      { key: "inbox", label: "Notifications" },
      { key: "activity", label: "My activity" },
      { key: "settings", label: "Notification settings" },
    ],
  },
  {
    label: "Danger zone",
    items: [{ key: "danger", label: "Delete account", danger: true }],
  },
];

const ACTIVITY_TABS = [
  { key: "comments", label: "Comments" },
  { key: "likes", label: "Likes" },
  { key: "saves", label: "Saved" },
  { key: "shares", label: "Shares" },
] as const;

const ACTIVITY_EMPTY: Record<(typeof ACTIVITY_TABS)[number]["key"], string> = {
  comments: "No comments yet.",
  likes: "No liked articles yet.",
  saves: "No saved articles yet.",
  shares: "No shared articles yet.",
};

function activityHref(item: ActivityItem): string {
  return item.postType === "reviews" ? `/reviews/${item.postSlug}/` : `/${item.postSlug}/`;
}

function channelLabel(channel: string): string {
  switch (channel) {
    case "native":
      return "your device's share sheet";
    case "copy":
      return "a copied link";
    case "x":
      return "X";
    case "facebook":
      return "Facebook";
    case "linkedin":
      return "LinkedIn";
    case "email":
      return "email";
    default:
      return "a link";
  }
}

function initialOf(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M10 2.5c.4 0 .8.2 1 .6l7 12.1c.4.7-.1 1.6-.9 1.6H2.9c-.8 0-1.3-.9-.9-1.6l7-12.1c.2-.4.6-.6 1-.6Zm0 3.2-5.7 9.9h11.4L10 5.7Zm0 2.1c.4 0 .8.3.8.8v3.1a.8.8 0 0 1-1.6 0V8.6c0-.5.4-.8.8-.8Zm0 5.4a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z" />
    </svg>
  );
}

export default function AccountView() {
  const {
    profile,
    token,
    isReady,
    isLoadingProfile,
    profileError,
    openModal,
    logout,
    updateProfile,
    deleteAccount,
    refreshProfile,
    uploadAvatar,
    removeAvatar,
    resendEmailVerification,
    refreshNotificationSummary,
  } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AccountTab>("profile");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileFormError, setProfileFormError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [notifyReplies, setNotifyReplies] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [notificationNotice, setNotificationNotice] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const [activity, setActivity] = useState<MyActivity | null>(null);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityTab, setActivityTab] = useState<(typeof ACTIVITY_TABS)[number]["key"]>("comments");
  const activityLoaded = useRef(false);

  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
  const [recentUnread, setRecentUnread] = useState(0);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [isMarkingRecent, setIsMarkingRecent] = useState(false);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  const [resetState, setResetState] = useState<{ login: string; key: string } | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmValue, setResetConfirmValue] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteConfirmRef = useRef<HTMLInputElement>(null);

  const actionHandled = useRef(false);
  const lastProfileSignature = useRef("");

  const selectTab = useCallback((tab: AccountTab) => {
    setActiveTab(tab);

    if (typeof window === "undefined") return;

    const hash = tab === "settings" ? "notifications" : tab;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${hash}`,
    );
  }, []);

  useEffect(() => {
    setActiveTab(tabFromHash());

    const onHashChange = () => setActiveTab(tabFromHash());
    window.addEventListener("hashchange", onHashChange);

    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Keep the profile form in sync with saved data, but do not wipe unsaved edits
  // when an unrelated preference (e.g. a notification toggle) changes the profile.
  useEffect(() => {
    if (!profile) return;

    const signature = [
      profile.id,
      profile.name,
      profile.email,
      profile.description,
      profile.pendingEmail ?? "",
    ].join("|");

    if (signature === lastProfileSignature.current) return;
    lastProfileSignature.current = signature;

    setName(profile.name);
    setEmail(profile.email);
    setDescription(profile.description);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    setNotifyReplies(profile.notifyReplies);
    setNotifyEmail(profile.notifyEmail);
  }, [profile]);

  const loadActivity = useCallback(async () => {
    if (!token) return;

    setIsLoadingActivity(true);
    setActivityError(null);

    try {
      setActivity(await fetchMyActivity(token));
    } catch (cause) {
      setActivityError(cause instanceof ApiError ? cause.message : "Unable to load your activity.");
    } finally {
      setIsLoadingActivity(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      activityLoaded.current = false;
      setActivity(null);
      setActivityError(null);
      return;
    }

    if (activeTab === "activity" && !activityLoaded.current) {
      activityLoaded.current = true;
      void loadActivity();
    }
  }, [activeTab, token, loadActivity]);

  const loadRecentNotifications = useCallback(async () => {
    if (!token) return;

    setIsLoadingRecent(true);
    setRecentError(null);

    try {
      const result = await fetchNotifications(token, 1, 5);
      setRecentNotifications(result.items);
      setRecentUnread(result.unread);
    } catch (cause) {
      setRecentError(cause instanceof ApiError ? cause.message : "Unable to load your notifications.");
    } finally {
      setIsLoadingRecent(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "inbox" && token) {
      void loadRecentNotifications();
    }
  }, [activeTab, token, loadRecentNotifications]);

  useEffect(() => {
    if (actionHandled.current || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify_email");
    const action = params.get("action");
    const key = params.get("key");
    const login = params.get("login");

    if (verifyToken) {
      actionHandled.current = true;
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);

      confirmEmailChange(verifyToken)
        .then((result) => {
          setEmailNotice(
            result.email ? `Your email has been updated to ${result.email}.` : "Your email has been updated.",
          );
          if (token) void refreshProfile();
        })
        .catch((cause) => {
          setEmailNotice(
            cause instanceof ApiError ? cause.message : "This confirmation link is invalid or has expired.",
          );
        });

      return;
    }

    if (action === "reset-password" && key && login) {
      actionHandled.current = true;
      setResetState({ login, key });
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  }, [refreshProfile, token]);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be 2 MB or smaller.");
      return;
    }

    setAvatarError(null);
    setIsUploadingAvatar(true);
    const ok = await uploadAvatar(file);
    setIsUploadingAvatar(false);

    if (!ok) setAvatarError("Your photo could not be uploaded.");
  };

  const handleAvatarRemove = async () => {
    setAvatarError(null);
    setIsRemovingAvatar(true);
    const ok = await removeAvatar();
    setIsRemovingAvatar(false);

    if (!ok) setAvatarError("Your photo could not be removed.");
  };

  const handleResendEmail = async () => {
    setEmailNotice(null);
    setIsResendingEmail(true);
    const ok = await resendEmailVerification();
    setIsResendingEmail(false);
    setEmailNotice(ok ? "Confirmation email sent again." : "The confirmation email could not be sent.");
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileMessage(null);
    setProfileFormError(null);

    if (!name.trim()) {
      setProfileFormError("Display name cannot be empty.");
      return;
    }

    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setProfileFormError("Please enter a valid email address.");
      return;
    }

    setIsSavingProfile(true);
    const ok = await updateProfile({
      name: name.trim(),
      email: email.trim(),
      description: description.trim(),
    });
    setIsSavingProfile(false);

    if (ok) {
      setProfileMessage("Your profile has been saved.");
    } else {
      setProfileFormError("Your profile could not be saved.");
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsSavingPassword(true);
    const ok = await updateProfile({ password, currentPassword });
    setIsSavingPassword(false);

    if (ok) {
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
    } else {
      setPasswordError("Your password could not be updated. Check your current password.");
    }
  };

  const saveNotificationPrefs = async (patch: { notifyReplies?: boolean; notifyEmail?: boolean }) => {
    setNotificationNotice(null);
    setNotificationError(null);
    setIsSavingNotifications(true);

    const ok = await updateProfile(patch);
    setIsSavingNotifications(false);

    if (ok) {
      setNotificationNotice("Notification settings saved.");
      return;
    }

    setNotificationError("Your notification settings could not be saved.");

    if (profile) {
      setNotifyReplies(profile.notifyReplies);
      setNotifyEmail(profile.notifyEmail);
    }
  };

  const handleRecentClick = async (item: NotificationItem) => {
    if (!token) return;

    if (!item.isRead) {
      setRecentNotifications((previous) =>
        previous.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)),
      );
      setRecentUnread((previous) => Math.max(0, previous - 1));

      try {
        await markNotificationsRead(token, { ids: [item.id] });
      } catch {
        // Navigation should still work if the read receipt fails.
      }

      void refreshNotificationSummary();
    }

    router.push(item.href);
  };

  const handleMarkAllRecent = async () => {
    if (!token) return;

    setIsMarkingRecent(true);
    setRecentError(null);

    try {
      await markNotificationsRead(token, { all: true });
      setRecentNotifications((previous) => previous.map((item) => ({ ...item, isRead: true })));
      setRecentUnread(0);
      void refreshNotificationSummary();
    } catch (cause) {
      setRecentError(cause instanceof ApiError ? cause.message : "Your notifications could not be updated.");
    } finally {
      setIsMarkingRecent(false);
    }
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetMessage(null);
    setResetError(null);

    if (!resetState) return;

    if (resetPasswordValue.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }

    if (resetPasswordValue !== resetConfirmValue) {
      setResetError("Passwords do not match.");
      return;
    }

    setIsResetting(true);

    try {
      await resetPasswordRequest(resetState.login, resetState.key, resetPasswordValue);
      setResetMessage("Your password has been updated. You can now log in.");
      setResetPasswordValue("");
      setResetConfirmValue("");
    } catch (cause) {
      setResetError(cause instanceof ApiError ? cause.message : "Your password could not be reset.");
    } finally {
      setIsResetting(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteConfirmText("");
    setDeletePassword("");
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;

    setIsDeleteModalOpen(false);
    setDeleteConfirmText("");
    setDeletePassword("");
    setDeleteError(null);
  };

  useEffect(() => {
    if (!isDeleteModalOpen) return;

    deleteConfirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDeleteModal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDeleteModalOpen, isDeleting]);

  useEffect(() => {
    if (!isDeleteModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDeleteModalOpen]);

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    setDeleteError(null);

    if (deleteConfirmText.trim() !== profile.username) {
      setDeleteError(`Type ${profile.username} exactly to confirm.`);
      return;
    }

    if (!deletePassword) {
      setDeleteError("Enter your current password.");
      return;
    }

    setIsDeleting(true);
    const ok = await deleteAccount(deletePassword);
    setIsDeleting(false);

    if (!ok) {
      setDeletePassword("");
      setDeleteError("Your account could not be deleted. Check your password and try again.");
    }
  };

  if (!isReady) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="h-64 animate-pulse rounded-xl bg-gray-50" />
          <div className="h-96 animate-pulse rounded-xl bg-gray-50" />
        </div>
      </div>
    );
  }

  if (resetState) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-serif text-4xl font-bold leading-tight text-gray-900">Choose a new password</h1>
        <p className="mt-4 text-sm leading-relaxed text-gray-500">
          Set a new password for <strong className="text-gray-900">@{resetState.login}</strong>.
        </p>

        {resetMessage ? (
          <div className="mt-8 rounded-xl bg-white p-6 shadow-sm md:p-8">
            <p role="status" className="text-sm leading-relaxed text-green-700">
              {resetMessage}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {profile ? (
                <Link
                  href="/account/"
                  className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  Back to my profile
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openModal("login")}
                  className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  Log in
                </button>
              )}
              <Link href="/" className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">
                Back to reviews
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-8 rounded-xl bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="reset-password" className="text-sm font-medium text-gray-700">
                  New password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={resetPasswordValue}
                  onChange={(event) => setResetPasswordValue(event.target.value)}
                  disabled={isResetting}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="reset-password-confirm" className="text-sm font-medium text-gray-700">
                  Confirm new password
                </label>
                <input
                  id="reset-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={resetConfirmValue}
                  onChange={(event) => setResetConfirmValue(event.target.value)}
                  disabled={isResetting}
                  placeholder="Repeat new password"
                  className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
                />
              </div>

              {resetError ? (
                <p role="alert" className="text-sm leading-relaxed text-red-600">
                  {resetError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  disabled={isResetting || resetPasswordValue.length === 0}
                  className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isResetting ? "Saving…" : "Update password"}
                </button>
                <Link href="/account/" className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        {emailNotice ? (
          <div role="status" className="mb-8 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            {emailNotice}
          </div>
        ) : null}
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

  const activityCounts = activity?.totals ?? { comments: 0, likes: 0, saves: 0, shares: 0 };
  const activityItems: ActivityRow[] = activity ? activity[activityTab] : [];
  const canDelete =
    deleteConfirmText.trim() === profile.username && deletePassword.length > 0 && !isDeleting;

  const renderNotification = (item: NotificationItem) => {
    const actorName = item.actor?.name?.trim() || "A reader";
    const avatar = item.actor?.avatarUrl ?? null;

    return (
      <li key={item.id} className={item.isRead ? "bg-white" : "bg-amber-50/40"}>
        <button
          type="button"
          onClick={() => void handleRecentClick(item)}
          className="flex w-full items-start gap-3 px-1 py-3 text-left transition-colors hover:bg-gray-50"
        >
          {avatar ? (
            <Image
              src={avatar}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
            >
              {item.type === "reply" ? (item.actor ? initialOf(actorName) : "?") : "W"}
            </span>
          )}

          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-relaxed text-gray-700">
              {item.type === "reply" ? (
                <>
                  <strong className="font-semibold text-gray-900">{actorName}</strong> replied to your comment
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

            {item.excerpt ? (
              <span className="mt-1 block text-sm leading-relaxed text-gray-600">&ldquo;{item.excerpt}&rdquo;</span>
            ) : null}

            <span className="mt-1 block text-xs text-gray-400">{formatDate(item.createdAt)}</span>
          </span>

          {!item.isRead ? (
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="Unread" />
          ) : null}
        </button>
      </li>
    );
  };

  let panel: React.ReactNode;

  switch (activeTab) {
    case "profile":
      panel = (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Profile</h2>
              <p className="mt-1 text-sm text-gray-500">Your public name, photo and bio.</p>
            </div>
            <span className="text-xs text-gray-400">@{profile.username}</span>
          </div>

          {isLoadingProfile ? <p className="mt-3 text-sm text-gray-400">Loading your profile…</p> : null}

          <div className="mt-5 flex items-start gap-4">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xl font-semibold text-white"
              >
                {(profile.name || profile.username).slice(0, 1).toUpperCase()}
              </span>
            )}

            <div className="min-w-0">
              <p className="truncate text-base font-bold text-gray-900">{profile.name || profile.username}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                {profile.hasCustomAvatar ? "Custom photo." : "Using Gravatar based on your email."}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer text-xs font-semibold text-gray-700 transition-colors hover:text-gray-900">
                  {isUploadingAvatar ? "Uploading…" : profile.hasCustomAvatar ? "Change photo" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={handleAvatarChange}
                    disabled={isUploadingAvatar || isRemovingAvatar || isLoadingProfile}
                  />
                </label>
                {profile.hasCustomAvatar ? (
                  <button
                    type="button"
                    onClick={() => void handleAvatarRemove()}
                    disabled={isRemovingAvatar || isUploadingAvatar}
                    className="text-xs font-medium text-gray-500 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300"
                  >
                    {isRemovingAvatar ? "Removing…" : "Remove photo"}
                  </button>
                ) : null}
              </div>
              {avatarError ? (
                <p role="alert" className="mt-2 text-xs leading-relaxed text-red-600">
                  {avatarError}
                </p>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="mt-6 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                  disabled={isSavingProfile || isLoadingProfile}
                  className="w-full rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
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
                  disabled={isSavingProfile || isLoadingProfile}
                  className="w-full rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="profile-bio" className="text-sm font-medium text-gray-700">
                Bio
              </label>
              <textarea
                id="profile-bio"
                name="description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isSavingProfile || isLoadingProfile}
                placeholder="A short line about you…"
                className="w-full resize-none rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
              />
            </div>

            {profileFormError ? (
              <p role="alert" className="text-sm leading-relaxed text-red-600">
                {profileFormError}
              </p>
            ) : null}
            {profileMessage ? (
              <p role="status" aria-live="polite" className="text-sm leading-relaxed text-green-700">
                {profileMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSavingProfile || isLoadingProfile}
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSavingProfile ? "Saving…" : "Save profile"}
              </button>
              {profile.pendingEmail ? (
                <span className="text-xs text-amber-700">Email change awaiting confirmation</span>
              ) : null}
            </div>
          </form>
        </div>
      );
      break;

    case "password":
      panel = (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Password</h2>
          <p className="mt-1 text-sm text-gray-500">Use at least 8 characters.</p>

          <form onSubmit={handlePasswordSubmit} className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="profile-current-password" className="text-sm font-medium text-gray-700">
                Current password
              </label>
              <input
                id="profile-current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={isSavingPassword}
                placeholder="Your current password"
                className="w-full rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
                  disabled={isSavingPassword}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="profile-password-confirm" className="text-sm font-medium text-gray-700">
                  Confirm new password
                </label>
                <input
                  id="profile-password-confirm"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isSavingPassword || !password}
                  placeholder="Repeat new password"
                  className="w-full rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:text-gray-400"
                />
              </div>
            </div>

            {passwordError ? (
              <p role="alert" className="text-sm leading-relaxed text-red-600">
                {passwordError}
              </p>
            ) : null}
            {passwordMessage ? (
              <p role="status" aria-live="polite" className="text-sm leading-relaxed text-green-700">
                {passwordMessage}
              </p>
            ) : null}

            <div>
              <button
                type="submit"
                disabled={isSavingPassword}
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSavingPassword ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </div>
      );
      break;

    case "inbox":
      panel = (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
              <p className="mt-1 text-sm text-gray-500">
                {recentUnread > 0 ? `${recentUnread} unread` : "You're all caught up."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleMarkAllRecent()}
                disabled={isMarkingRecent || recentUnread === 0}
                className="text-sm font-semibold text-gray-700 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                {isMarkingRecent ? "Marking…" : "Mark all read"}
              </button>
              <button
                type="button"
                onClick={() => void loadRecentNotifications()}
                disabled={isLoadingRecent}
                className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 disabled:text-gray-300"
              >
                Refresh
              </button>
              <Link
                href="/notifications/"
                className="text-sm font-semibold text-gray-900 underline underline-offset-2 transition-colors hover:text-gray-500"
              >
                View all
              </Link>
            </div>
          </div>

          {isLoadingRecent ? (
            <p className="mt-6 text-sm text-gray-400" aria-busy="true">
              Loading your notifications…
            </p>
          ) : recentError ? (
            <div className="mt-6">
              <p className="text-sm leading-relaxed text-red-600">{recentError}</p>
              <button
                type="button"
                onClick={() => void loadRecentNotifications()}
                className="mt-2 text-sm font-semibold text-gray-900 transition-colors hover:text-gray-500"
              >
                Try again
              </button>
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="mt-6 rounded-lg bg-gray-50 p-5 text-sm leading-relaxed text-gray-500">
              No notifications yet. When someone replies to one of your comments, you&apos;ll see it here.
            </div>
          ) : (
            <ul className="mt-4 max-h-[42vh] divide-y divide-gray-100 overflow-y-auto pr-1">
              {recentNotifications.map(renderNotification)}
            </ul>
          )}
        </div>
      );
      break;

    case "activity":
      panel = (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">My activity</h2>
              <p className="mt-1 text-sm text-gray-500">Comments, likes, saves and shares.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadActivity()}
              disabled={isLoadingActivity}
              className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 disabled:text-gray-300"
            >
              Refresh
            </button>
          </div>

          <div role="tablist" aria-label="My activity" className="mt-4 flex flex-wrap gap-1 border-b border-gray-100">
            {ACTIVITY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activityTab === tab.key}
                onClick={() => setActivityTab(tab.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  activityTab === tab.key
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                {tab.label}
                <span className="ml-1 text-xs font-normal text-gray-400">{activityCounts[tab.key]}</span>
              </button>
            ))}
          </div>

          {isLoadingActivity ? (
            <p className="mt-4 text-sm text-gray-400">Loading your activity…</p>
          ) : activityError ? (
            <div className="mt-4">
              <p className="text-sm leading-relaxed text-red-600">{activityError}</p>
              <button
                type="button"
                onClick={() => void loadActivity()}
                className="mt-2 text-sm font-semibold text-gray-900 transition-colors hover:text-gray-500"
              >
                Try again
              </button>
            </div>
          ) : activityItems.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">{ACTIVITY_EMPTY[activityTab]}</p>
          ) : (
            <ul className="mt-2 max-h-[42vh] divide-y divide-gray-100 overflow-y-auto pr-1">
              {activityItems.map((item) => {
                const key = "id" in item ? `comment-${item.id}` : `${activityTab}-${item.postId}-${item.createdAt}`;

                return (
                  <li key={key} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <Link
                        href={activityHref(item)}
                        className="text-sm font-semibold text-gray-900 transition-colors hover:text-gray-500"
                      >
                        {item.postTitle}
                      </Link>
                      <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                    </div>

                    {"excerpt" in item && item.excerpt ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{item.excerpt}</p>
                    ) : null}

                    {activityTab === "comments" && "status" in item && item.status === "hold" ? (
                      <span className="mt-1.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        Pending review
                      </span>
                    ) : null}

                    {activityTab === "shares" && "channel" in item ? (
                      <p className="mt-1 text-xs text-gray-400">Shared via {channelLabel(item.channel)}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
      break;

    case "settings":
      panel = (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Notification settings</h2>
              <p className="mt-1 text-sm text-gray-500">
                Choose what happens when someone replies to your comments.
              </p>
            </div>
            <Link
              href="/notifications/"
              className="text-sm font-semibold text-gray-700 underline underline-offset-2 transition-colors hover:text-gray-900"
            >
              View notifications
            </Link>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={notifyReplies}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setNotifyReplies(checked);
                  void saveNotificationPrefs({ notifyReplies: checked });
                }}
                disabled={isSavingNotifications}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">Replies on WorthSprout</span>
                <span className="block text-sm leading-relaxed text-gray-500">
                  Show a notification in your account when someone replies to your comment.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setNotifyEmail(checked);
                  void saveNotificationPrefs({ notifyEmail: checked });
                }}
                disabled={isSavingNotifications}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">Reply emails</span>
                <span className="block text-sm leading-relaxed text-gray-500">
                  Send a copy to your email address as well. You can turn this off and still keep in-site
                  notifications.
                </span>
              </span>
            </label>
          </div>

          {notificationNotice ? (
            <p role="status" aria-live="polite" className="mt-4 text-sm leading-relaxed text-green-700">
              {notificationNotice}
            </p>
          ) : null}
          {notificationError ? (
            <p role="alert" className="mt-4 text-sm leading-relaxed text-red-600">
              {notificationError}
            </p>
          ) : null}

          {profile.canModerate ? (
            <p className="mt-5 border-t border-gray-100 pt-4 text-sm leading-relaxed text-gray-500">
              You can review reported comments in{" "}
              <a
                href={REPORTS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-gray-700 underline underline-offset-2 transition-colors hover:text-gray-900"
              >
                WordPress admin
              </a>
              .
            </p>
          ) : null}
        </div>
      );
      break;

    case "danger":
      panel = (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
              <WarningIcon />
            </span>
            <div>
              <h2 className="text-xl font-bold text-red-800">Delete account</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-red-700">
                This permanently deletes your profile and signs you out. Your published comments stay online.
                You will be asked to confirm with your username and current password.
              </p>
              <button
                type="button"
                onClick={openDeleteModal}
                className="mt-5 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
              >
                Delete my account
              </button>
            </div>
          </div>
        </div>
      );
      break;
  }

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-bold leading-tight text-gray-900">My profile</h1>
            <p className="mt-1 text-sm text-gray-500">Signed in as @{profile.username}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/notifications/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 transition-colors hover:text-gray-900"
            >
              Notifications
              {profile.unreadNotifications > 0 ? (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {profile.unreadNotifications > 99 ? "99+" : profile.unreadNotifications}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={logout}
              className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              Log out
            </button>
          </div>
        </div>

        {emailNotice ? (
          <div role="status" className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            {emailNotice}
          </div>
        ) : null}

        {profile.pendingEmail ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            <p>
              Confirm your new email <strong>{profile.pendingEmail}</strong>. Check your inbox for the confirmation
              link.
            </p>
            <button
              type="button"
              onClick={() => void handleResendEmail()}
              disabled={isResendingEmail}
              className="text-sm font-semibold text-amber-900 underline underline-offset-2 transition-colors hover:text-amber-700 disabled:text-amber-400"
            >
              {isResendingEmail ? "Sending…" : "Resend confirmation"}
            </button>
          </div>
        ) : null}

        {profileError ? (
          <div role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
            {profileError}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav
            aria-label="Account sections"
            className="flex gap-1 self-start overflow-x-auto rounded-xl bg-white p-2 shadow-sm lg:sticky lg:top-28 lg:flex-col lg:gap-4 lg:overflow-visible lg:p-3"
          >
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="contents lg:block">
                <p className="hidden px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 lg:block">
                  {group.label}
                </p>
                <div className="flex gap-1 lg:flex-col lg:gap-0.5">
                  {group.items.map((item) => {
                    const isActive = activeTab === item.key;
                    const badge = item.key === "inbox" ? profile.unreadNotifications : 0;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => selectTab(item.key)}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:w-full lg:text-left ${
                          item.danger
                            ? isActive
                              ? "bg-red-600 text-white"
                              : "text-red-600 hover:bg-red-50"
                            : isActive
                              ? "bg-gray-900 text-white"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <span>{item.label}</span>
                        {badge > 0 ? (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                              isActive ? "bg-white text-red-600" : "bg-red-600 text-white"
                            }`}
                          >
                            {badge > 99 ? "99+" : badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <section className="min-w-0">
            <div className="rounded-xl bg-white p-5 shadow-sm md:p-6 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto">
              {panel}
            </div>
          </section>
        </div>
      </div>

      {isDeleteModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeleteModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
            className="w-full max-w-md rounded-xl border-t-4 border-red-600 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                <WarningIcon />
              </span>
              <div>
                <h2 id="delete-account-title" className="text-xl font-bold text-gray-900">
                  Delete account permanently?
                </h2>
                <p id="delete-account-description" className="mt-2 text-sm leading-relaxed text-gray-500">
                  This cannot be undone. Your profile, notifications and reactions are removed. Published
                  comments stay online.
                </p>
              </div>
            </div>

            <form onSubmit={handleDeleteAccount} className="mt-5 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="delete-confirm-text" className="text-sm font-medium text-gray-700">
                  Type <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-900">{profile.username}</code>{" "}
                  to confirm
                </label>
                <input
                  id="delete-confirm-text"
                  ref={deleteConfirmRef}
                  type="text"
                  autoComplete="off"
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  disabled={isDeleting}
                  placeholder={profile.username}
                  className="w-full rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600 disabled:text-gray-400"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="delete-password" className="text-sm font-medium text-gray-700">
                  Current password
                </label>
                <input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  disabled={isDeleting}
                  placeholder="Your current password"
                  className="w-full rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600 disabled:text-gray-400"
                />
              </div>

              {deleteError ? (
                <p role="alert" className="text-sm leading-relaxed text-red-600">
                  {deleteError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canDelete}
                  className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {isDeleting ? "Deleting…" : "Permanently delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
