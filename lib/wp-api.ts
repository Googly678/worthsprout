/**
 * WordPress 认证 / 用户 / 评论 API 封装。
 *
 * 浏览器直连 CMS，受站点 CORS 白名单约束：
 *   Access-Control-Allow-Origin: https://worthsprout.com（固定值）
 * 生产域名可用；localhost / *.pages.dev 会被浏览器拦截。
 */

const API_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_BASE_URL ?? "https://cms.worthsprout.com/wp-json").replace(
  /\/+$/,
  "",
);

export const AUTH_ENDPOINT = `${API_BASE}/simple-jwt-login/v1/auth`;
export const COMMENTS_ENDPOINT = `${API_BASE}/wp/v2/comments`;
export const USERS_ME_ENDPOINT = `${API_BASE}/wp/v2/users/me`;
/** WorthSprout plugin endpoint: works even when /wp/v2/users is blocked. */
export const PROFILE_ENDPOINT = `${API_BASE}/worthsprout/v1/me`;

export const REGISTER_AUTH_CODE = process.env.NEXT_PUBLIC_WP_REGISTER_AUTH_CODE ?? "WorthSprout_Reg_2026_Secret";
/**
 * 注册走 Simple JWT Login 自带的 `/users` 接口：
 * - `wp/v2/users/register` 不是 WordPress 核心路由，本站也没有插件提供，调用必然 403
 * - 插件只强制要求 `email` + `password`，用户名用 `user_login` 字段（省略时回退成邮箱）
 * - 若后台开了「Register Requires Auth Code」，需额外带 `AUTH_KEY` 查询参数
 */
const REGISTER_AUTH_QUERY = REGISTER_AUTH_CODE ? `?AUTH_KEY=${encodeURIComponent(REGISTER_AUTH_CODE)}` : "";
export const REGISTER_ENDPOINT = `${API_BASE}/simple-jwt-login/v1/users${REGISTER_AUTH_QUERY}`;

export const TOKEN_STORAGE_KEY = "worthsprout.auth";

/** WordPress 常用错误码 → 可读提示 */
const ERROR_HINTS: Record<string, string> = {
  rest_forbidden: "The site has disabled this endpoint. Please contact the site owner.",
  rest_not_logged_in: "We couldn't verify your login. Please log out and log in again.",
  simple_jwt_login_middleware_error: "Your session has expired. Please log in again.",
  rest_cannot_edit: "You are not allowed to change this profile.",
  rest_cannot_create: "You must be logged in to post a comment.",
  rest_comment_login_required: "Your login was not accepted. Please log out and log in again.",
  rest_comment_closed: "Comments are closed on this article.",
  rest_comment_forbidden: "You can only edit or delete your own comments.",
  rest_comment_delete_failed: "Your comment could not be deleted.",
  rest_comment_empty: "Comment cannot be empty.",
  rest_comment_too_long: "Comment is too long (maximum 5000 characters).",
  rest_comment_update_failed: "Your comment could not be updated.",
  rest_comment_not_found: "Comment not found.",
  rest_report_exists: "You already reported this comment.",
  rest_report_own_comment: "You cannot report your own comment.",
  rest_report_failed: "Your report could not be submitted. Please try again.",
  rest_post_invalid_id: "This article is no longer available.",
  rest_reaction_failed: "Your reaction could not be saved. Please try again.",
  rest_share_failed: "Your share could not be recorded.",
  rest_too_many_requests: "Too many requests. Please try again later.",
  rest_avatar_missing: "Choose an image to upload.",
  rest_avatar_too_large: "Image must be 2 MB or smaller.",
  rest_avatar_type: "Please upload a JPG, PNG, WebP or GIF image.",
  rest_avatar_upload_failed: "Your photo could not be uploaded.",
  rest_email_token_invalid: "This confirmation link is invalid or has expired.",
  rest_email_token_expired: "This confirmation link has expired. Please request a new one.",
  rest_email_none_pending: "There is no pending email change.",
  rest_reset_invalid: "This reset link is invalid or has expired.",
  rest_invalid_param: "Some of the fields are invalid.",
  rest_user_missing_current_password: "Enter your current password to set a new one.",
  rest_user_missing_password: "Enter your password to continue.",
  rest_user_last_admin: "You are the only administrator. Transfer ownership before deleting this account.",
  rest_user_delete_failed: "Your account could not be deleted. Please contact the site owner.",
  // Simple JWT Login error code for a token whose WordPress user no longer exists.
  "54": "Your account no longer exists. Please log in again.",
  existing_user_email: "That email address is already registered.",
  existing_user_login: "That username is already taken.",
  empty_username: "Please enter your username.",
  empty_password: "Please enter your password.",
  invalid_username: "Unknown username.",
  incorrect_password: "Incorrect password.",
  rest_user_invalid_email: "Please enter a valid email address.",
  rest_user_invalid_password: "Password must be at least 8 characters.",
};

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  /** true 表示这是站点策略/权限问题，不是用户操作失误 */
  readonly isPolicy?: boolean;

  constructor(message: string, status?: number, code?: string, isPolicy = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.isPolicy = isPolicy;
  }
}

interface WPErrorPayload {
  success?: boolean;
  code?: string;
  message?: string;
  errorCode?: number | string;
  error_code?: number | string;
  data?: {
    message?: string;
    errorCode?: number | string;
    error_code?: number | string;
    status?: number;
  };
}

function extractError(payload: unknown, fallback: string): { message: string; code?: string; isPolicy: boolean } {
  const body = payload as WPErrorPayload | null;
  const rawCode =
    body?.code ??
    body?.data?.errorCode ??
    body?.data?.error_code ??
    body?.errorCode ??
    body?.error_code;
  const code = rawCode !== undefined && rawCode !== "" ? String(rawCode) : undefined;

  const rawMessage =
    (typeof body?.data?.message === "string" && body.data.message) ||
    (typeof body?.message === "string" && body.message) ||
    "";

  const hint = code ? ERROR_HINTS[code] : undefined;
  const isPolicy = rawMessage.toLowerCase().includes("user enumeration is disabled");

  const message = isPolicy
    ? "This site has disabled its user API, so accounts and profiles cannot be managed here. Please contact the site owner."
    : hint || rawMessage || fallback;

  return { message, code, isPolicy };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError("The request timed out. Please try again.");
  }

  return new ApiError(
    "Unable to reach the server. This is usually a CORS restriction — make sure the site is served from an allowed domain.",
  );
}

async function request(url: string, init: RequestInit = {}): Promise<{ response: Response; body: unknown }> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
  } catch (error) {
    throw toApiError(error);
  }

  return { response, body: await readJson(response) };
}

/* ------------------------------------------------------------------ 认证 */

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  username: string;
  email?: string;
}

interface JWTAuthPayload {
  success?: boolean;
  data?: { jwt?: string; user?: { id?: number; username?: string; email?: string } };
}

/** POST /simple-jwt-login/v1/auth */
export async function loginRequest({ username, password }: LoginPayload): Promise<AuthResult> {
  const { response, body } = await request(AUTH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const payload = body as JWTAuthPayload | null;
  const jwt = payload?.data?.jwt;

  if (!response.ok || payload?.success !== true || typeof jwt !== "string" || jwt.length === 0) {
    const { message } = extractError(body, "Login failed. Please check your credentials.");
    throw new ApiError(message, response.status, String((body as WPErrorPayload | null)?.data?.errorCode ?? ""));
  }

  return {
    token: jwt,
    username: payload.data?.user?.username ?? username,
    email: payload.data?.user?.email,
  };
}

/**
 * POST /simple-jwt-login/v1/users
 * 成功返回 `{ success: true, data: { id, login, email, jwt? } }`；
 * 插件设置里「Register → 允许注册」必须开启，否则返回 errorCode 31。
 */
export async function registerRequest({ username, email, password }: RegisterPayload): Promise<void> {
  const { response, body } = await request(REGISTER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, user_login: username }),
  });

  const payload = body as WPErrorPayload | null;
  if (!response.ok || payload?.success === false) {
    const { message, code, isPolicy } = extractError(body, "Registration failed. Please try again.");
    throw new ApiError(message, response.status, code, isPolicy);
  }
}

/* -------------------------------------------------------------- 用户资料 */

export interface UserProfile {
  id: number;
  username: string;
  name: string;
  email: string;
  description: string;
  avatarUrl: string | null;
  hasCustomAvatar: boolean;
  pendingEmail: string | null;
  notifyReplies: boolean;
  notifyEmail: boolean;
  unreadNotifications: number;
  canModerate: boolean;
}

interface WPUserPayload {
  id?: number;
  username?: string;
  name?: string;
  email?: string;
  description?: string;
  avatar_urls?: Record<string, string>;
  hasCustomAvatar?: boolean;
  pendingEmail?: string | null;
  notifications?: {
    replies?: boolean;
    email?: boolean;
  };
  unreadNotifications?: number;
  canModerate?: boolean;
}

/** 从 avatar_urls 里挑一个够用的尺寸 */
function pickAvatar(avatarUrls: Record<string, string> | undefined): string | null {
  if (!avatarUrls) return null;
  return avatarUrls["96"] ?? avatarUrls["48"] ?? Object.values(avatarUrls)[0] ?? null;
}

function toUserProfile(payload: WPUserPayload | null, fallbackUsername: string): UserProfile {
  return {
    id: typeof payload?.id === "number" ? payload.id : 0,
    username: payload?.username ?? fallbackUsername,
    name: payload?.name?.trim() || payload?.username || fallbackUsername,
    email: payload?.email ?? "",
    description: payload?.description ?? "",
    avatarUrl: pickAvatar(payload?.avatar_urls),
    hasCustomAvatar: Boolean(payload?.hasCustomAvatar),
    pendingEmail: payload?.pendingEmail?.trim() || null,
    // Older plugin versions omit the notification block; keep the defaults on.
    notifyReplies: payload?.notifications?.replies !== false,
    notifyEmail: payload?.notifications?.email !== false,
    unreadNotifications:
      typeof payload?.unreadNotifications === "number" && payload.unreadNotifications > 0
        ? payload.unreadNotifications
        : 0,
    canModerate: Boolean(payload?.canModerate),
  };
}

async function fetchProfileFromPlugin(token: string, fallbackUsername: string): Promise<UserProfile | null> {
  const { response, body } = await request(`${PROFILE_ENDPOINT}?_=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  // Older plugin versions do not expose /worthsprout/v1/me yet.
  if (response.status === 404) return null;

  if (!response.ok) {
    const { message, code, isPolicy } = extractError(body, "Unable to load your profile.");
    throw new ApiError(message, response.status, code, isPolicy);
  }

  return toUserProfile(body as WPUserPayload | null, fallbackUsername);
}

/** GET /worthsprout/v1/me（旧插件回退到 /wp/v2/users/me） */
export async function fetchCurrentUser(token: string, fallbackUsername = ""): Promise<UserProfile> {
  const profile = await fetchProfileFromPlugin(token, fallbackUsername);
  if (profile) return profile;

  const { response, body } = await request(
    `${USERS_ME_ENDPOINT}?context=edit&_fields=id,username,name,email,description,avatar_urls`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    const { message, code, isPolicy } = extractError(body, "Unable to load your profile.");
    throw new ApiError(message, response.status, code, isPolicy);
  }

  return toUserProfile(body as WPUserPayload | null, fallbackUsername);
}

export interface ProfileUpdatePayload {
  name?: string;
  email?: string;
  description?: string;
  /** 留空表示不修改密码 */
  password?: string;
  /** 修改密码时必须提供，由服务端校验 */
  currentPassword?: string;
  /** 站内回复通知 */
  notifyReplies?: boolean;
  /** 回复邮件通知 */
  notifyEmail?: boolean;
}

function toProfileBody(patch: ProfileUpdatePayload): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.password) payload.password = patch.password;
  if (patch.currentPassword) payload.currentPassword = patch.currentPassword;
  if (patch.notifyReplies !== undefined) payload.notifyReplies = patch.notifyReplies;
  if (patch.notifyEmail !== undefined) payload.notifyEmail = patch.notifyEmail;

  return payload;
}

/** POST /worthsprout/v1/me（旧插件回退到 /wp/v2/users/me） */
export async function updateCurrentUser(
  token: string,
  patch: ProfileUpdatePayload,
  fallbackUsername = "",
): Promise<UserProfile> {
  const payload = toProfileBody(patch);
  const { response, body } = await request(PROFILE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  if (response.status === 404) {
    const legacyPayload = { ...payload };
    delete legacyPayload.currentPassword;
    delete legacyPayload.notifyReplies;
    delete legacyPayload.notifyEmail;

    const legacy = await request(`${USERS_ME_ENDPOINT}?context=edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(legacyPayload),
    });

    if (!legacy.response.ok) {
      const { message, code, isPolicy } = extractError(legacy.body, "Your profile could not be saved.");
      throw new ApiError(message, legacy.response.status, code, isPolicy);
    }

    return toUserProfile(legacy.body as WPUserPayload | null, fallbackUsername);
  }

  if (!response.ok) {
    const { message, code, isPolicy } = extractError(body, "Your profile could not be saved.");
    throw new ApiError(message, response.status, code, isPolicy);
  }

  return toUserProfile(body as WPUserPayload | null, fallbackUsername);
}

/**
 * DELETE /worthsprout/v1/me —— 密码确认后删除自己的账号。
 * 旧插件回退到 /wp/v2/users/me（WordPress 默认会拒绝普通用户）。
 */
export async function deleteCurrentUser(token: string, password: string): Promise<void> {
  const { response, body } = await request(PROFILE_ENDPOINT, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  });

  if (response.status === 404) {
    const legacy = await request(`${USERS_ME_ENDPOINT}?reassign=1&force=true`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!legacy.response.ok) {
      const { message, code, isPolicy } = extractError(
        legacy.body,
        "Your account could not be deleted automatically. Please contact the site owner.",
      );
      throw new ApiError(message, legacy.response.status, code, isPolicy);
    }

    return;
  }

  if (!response.ok) {
    const { message, code, isPolicy } = extractError(
      body,
      "Your account could not be deleted automatically. Please contact the site owner.",
    );
    throw new ApiError(message, response.status, code, isPolicy);
  }
}

/* ------------------------------------------------- 头像 / 邮箱 / 重置密码 */

/** POST /worthsprout/v1/me/avatar (multipart) */
export async function uploadAvatar(file: File, token: string): Promise<UserProfile> {
  const form = new FormData();
  form.append("avatar", file);

  const { response, body } = await request(`${PROFILE_ENDPOINT}/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) {
    const { message, code, isPolicy } = extractError(body, "Your photo could not be uploaded.");
    throw new ApiError(message, response.status, code, isPolicy);
  }

  return toUserProfile(body as WPUserPayload | null, "");
}

/** DELETE /worthsprout/v1/me/avatar */
export async function removeAvatar(token: string): Promise<UserProfile> {
  const { response, body } = await request(`${PROFILE_ENDPOINT}/avatar`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const { message, code, isPolicy } = extractError(body, "Your photo could not be removed.");
    throw new ApiError(message, response.status, code, isPolicy);
  }

  return toUserProfile(body as WPUserPayload | null, "");
}

/** POST /worthsprout/v1/me/email/confirm */
export async function confirmEmailChange(token: string): Promise<{ email: string }> {
  const { response, body } = await request(`${PROFILE_ENDPOINT}/email/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "This confirmation link is invalid or has expired.");
    throw new ApiError(message, response.status, code);
  }

  const payload = body as { email?: string } | null;

  return { email: typeof payload?.email === "string" ? payload.email : "" };
}

/** POST /worthsprout/v1/me/email/resend */
export async function resendEmailVerification(token: string): Promise<void> {
  const { response, body } = await request(`${PROFILE_ENDPOINT}/email/resend`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "The confirmation email could not be sent.");
    throw new ApiError(message, response.status, code);
  }
}

/** POST /worthsprout/v1/auth/forgot-password */
export async function requestPasswordReset(email: string): Promise<void> {
  const { response, body } = await request(`${API_BASE}/worthsprout/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "The reset email could not be sent.");
    throw new ApiError(message, response.status, code);
  }
}

/** POST /worthsprout/v1/auth/reset-password */
export async function resetPassword(login: string, key: string, password: string): Promise<void> {
  const { response, body } = await request(`${API_BASE}/worthsprout/v1/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, key, password }),
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Your password could not be reset.");
    throw new ApiError(message, response.status, code);
  }
}

/* ---------------------------------------------------------------- 评论 */

export interface WPComment {
  id: number;
  post: number;
  parent: number;
  /** WordPress user ID; 0 for anonymous commenters. */
  author?: number;
  author_name: string;
  date: string;
  content: { rendered: string };
  author_avatar_urls?: Record<string, string>;
  /** Only present when the current user can moderate; "hold" means pending review. */
  status?: string;
}

export interface CommentsPage {
  comments: WPComment[];
  total: number;
  totalPages: number;
}

/** GET /wp/v2/comments?post={id}&page={page} */
export async function fetchComments(postId: number, page = 1, perPage = 50): Promise<CommentsPage> {
  const { response, body } = await request(
    `${COMMENTS_ENDPOINT}?post=${postId}&order=asc&per_page=${perPage}&page=${page}&_fields=id,post,parent,author,author_name,date,content,author_avatar_urls`,
  );

  if (!response.ok) {
    const { message, code } = extractError(body, "Unable to load comments.");
    throw new ApiError(message, response.status, code);
  }

  const total = Number.parseInt(response.headers.get("x-wp-total") ?? "0", 10);
  const totalPages = Number.parseInt(response.headers.get("x-wp-totalpages") ?? "1", 10);

  return {
    comments: Array.isArray(body) ? (body as WPComment[]) : [],
    total: Number.isFinite(total) ? total : 0,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
  };
}

/** POST /wp/v2/comments —— 必须携带 Authorization: Bearer <token> */
export async function createComment(
  postId: number,
  content: string,
  token: string,
  parent = 0,
): Promise<WPComment> {
  const { response, body } = await request(COMMENTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(parent > 0 ? { post: postId, content, parent } : { post: postId, content }),
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Your comment could not be posted.");
    throw new ApiError(message, response.status, code);
  }

  return body as WPComment;
}

/** POST /worthsprout/v1/comments/{id} —— 只能编辑自己的评论 */
export async function updateComment(commentId: number, content: string, token: string): Promise<WPComment> {
  const { response, body } = await request(`${API_BASE}/worthsprout/v1/comments/${commentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Your comment could not be updated.");
    throw new ApiError(message, response.status, code);
  }

  return body as WPComment;
}

/** DELETE /worthsprout/v1/comments/{id} —— 只能删除自己的评论 */
export async function deleteComment(commentId: number, token: string): Promise<void> {
  const { response, body } = await request(`${API_BASE}/worthsprout/v1/comments/${commentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Your comment could not be deleted.");
    throw new ApiError(message, response.status, code);
  }
}

/* ------------------------------------------------------------ 转评赞 */

export interface PostStats {
  postId: number;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
  liked: boolean;
  saved: boolean;
}

/** GET /worthsprout/v1/posts/{id}/stats */
export async function fetchPostStats(postId: number, token?: string | null): Promise<PostStats> {
  const { response, body } = await request(`${API_BASE}/worthsprout/v1/posts/${postId}/stats`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Unable to load reactions.");
    throw new ApiError(message, response.status, code);
  }

  return body as PostStats;
}

/** POST /worthsprout/v1/posts/{id}/like | /save */
export async function togglePostReaction(
  postId: number,
  kind: "like" | "save",
  token: string,
): Promise<PostStats> {
  const { response, body } = await request(`${API_BASE}/worthsprout/v1/posts/${postId}/${kind}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Your reaction could not be saved.");
    throw new ApiError(message, response.status, code);
  }

  return body as PostStats;
}

/** POST /worthsprout/v1/posts/{id}/share */
export async function recordPostShare(
  postId: number,
  channel: string,
  token?: string | null,
): Promise<PostStats> {
  const { response, body } = await request(`${API_BASE}/worthsprout/v1/posts/${postId}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ channel }),
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Your share could not be recorded.");
    throw new ApiError(message, response.status, code);
  }

  return body as PostStats;
}

export interface ActivityItem {
  postId: number;
  postSlug: string;
  postTitle: string;
  postType: string;
  createdAt: string;
}

export interface CommentActivityItem extends ActivityItem {
  id: number;
  excerpt: string;
  status: string;
}

export interface ShareActivityItem extends ActivityItem {
  channel: string;
}

export interface MyActivity {
  comments: CommentActivityItem[];
  likes: ActivityItem[];
  saves: ActivityItem[];
  shares: ShareActivityItem[];
  totals: {
    comments: number;
    likes: number;
    saves: number;
    shares: number;
  };
}

/** GET /worthsprout/v1/me/activity */
export async function fetchMyActivity(token: string): Promise<MyActivity> {
  const { response, body } = await request(`${API_BASE}/worthsprout/v1/me/activity`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Unable to load your activity.");
    throw new ApiError(message, response.status, code);
  }

  return body as MyActivity;
}

/* ------------------------------------------------------- 通知与举报 */

export interface NotificationActor {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface NotificationPost {
  id: number;
  slug: string;
  type: string;
  title: string;
}

export interface NotificationItem {
  id: number;
  type: string;
  isRead: boolean;
  createdAt: string;
  actor: NotificationActor | null;
  post: NotificationPost | null;
  commentId: number;
  excerpt: string;
  message: string;
  href: string;
}

export interface NotificationsPage {
  items: NotificationItem[];
  total: number;
  unread: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/** GET /worthsprout/v1/me/notifications */
export async function fetchNotifications(
  token: string,
  page = 1,
  perPage = 20,
): Promise<NotificationsPage> {
  const { response, body } = await request(
    `${PROFILE_ENDPOINT}/notifications?page=${page}&per_page=${perPage}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );

  if (!response.ok) {
    const { message, code } = extractError(body, "Unable to load your notifications.");
    throw new ApiError(message, response.status, code);
  }

  return body as NotificationsPage;
}

/** GET /worthsprout/v1/me/notifications/summary */
export async function fetchNotificationSummary(token: string): Promise<number> {
  const { response, body } = await request(`${PROFILE_ENDPOINT}/notifications/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Unable to load your notifications.");
    throw new ApiError(message, response.status, code);
  }

  const payload = body as { unread?: number } | null;
  return typeof payload?.unread === "number" && payload.unread > 0 ? payload.unread : 0;
}

/** POST /worthsprout/v1/me/notifications/read */
export async function markNotificationsRead(
  token: string,
  options: { ids?: number[]; all?: boolean } = {},
): Promise<number> {
  const { response, body } = await request(`${PROFILE_ENDPOINT}/notifications/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      ...(options.all ? { all: true } : {}),
      ...(options.ids && options.ids.length > 0 ? { ids: options.ids } : {}),
    }),
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Your notifications could not be updated.");
    throw new ApiError(message, response.status, code);
  }

  const payload = body as { unread?: number } | null;
  return typeof payload?.unread === "number" && payload.unread > 0 ? payload.unread : 0;
}

/** DELETE /worthsprout/v1/me/notifications */
export async function clearNotifications(
  token: string,
  all = false,
): Promise<{ deleted: number; unread: number }> {
  const { response, body } = await request(`${PROFILE_ENDPOINT}/notifications`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(all ? { all: true } : {}),
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Your notifications could not be cleared.");
    throw new ApiError(message, response.status, code);
  }

  const payload = body as { deleted?: number; unread?: number } | null;
  return {
    deleted: typeof payload?.deleted === "number" ? payload.deleted : 0,
    unread: typeof payload?.unread === "number" && payload.unread > 0 ? payload.unread : 0,
  };
}

/** POST /worthsprout/v1/comments/{id}/report */
export async function reportComment(
  commentId: number,
  reason: string,
  details: string,
  token: string,
): Promise<void> {
  const { response, body } = await request(`${API_BASE}/worthsprout/v1/comments/${commentId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason, details }),
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Your report could not be submitted.");
    throw new ApiError(message, response.status, code);
  }
}

/* ---------------------------------------------------------------- 工具 */

/** 读取 JWT 的 exp，用于在前端丢弃过期 token（不验证签名，仅本地兜底） */
export function getTokenExpiry(token: string): number | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;

    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number };

    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
