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

export const REGISTER_AUTH_CODE = process.env.NEXT_PUBLIC_WP_REGISTER_AUTH_CODE ?? "WorthSprout_Reg_2026_Secret";
export const REGISTER_ENDPOINT = `${API_BASE}/wp/v2/users/register?auth_code=${encodeURIComponent(REGISTER_AUTH_CODE)}`;

export const TOKEN_STORAGE_KEY = "worthsprout.auth";

/** WordPress 常用错误码 → 可读提示 */
const ERROR_HINTS: Record<string, string> = {
  rest_forbidden: "The site has disabled this endpoint. Please contact the site owner.",
  rest_cannot_edit: "You are not allowed to change this profile.",
  rest_cannot_create: "You must be logged in to post a comment.",
  rest_comment_login_required: "You must be logged in to post a comment.",
  rest_invalid_param: "Some of the fields are invalid.",
  existing_user_email: "That email address is already registered.",
  existing_user_login: "That username is already taken.",
  empty_username: "Please enter your username.",
  empty_password: "Please enter your password.",
  invalid_username: "Unknown username.",
  incorrect_password: "Incorrect password.",
  rest_user_invalid_email: "Please enter a valid email address.",
  rest_user_invalid_password: "Password must be at least 6 characters.",
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
  data?: { message?: string; errorCode?: number | string; status?: number };
}

function extractError(payload: unknown, fallback: string): { message: string; code?: string; isPolicy: boolean } {
  const body = payload as WPErrorPayload | null;
  const code = body?.code ?? (body?.data?.errorCode !== undefined ? String(body.data.errorCode) : undefined);

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

/** POST /wp/v2/users/register?auth_code=... */
export async function registerRequest({ username, email, password }: RegisterPayload): Promise<void> {
  const { response, body } = await request(REGISTER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });

  if (!response.ok) {
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
}

interface WPUserPayload {
  id?: number;
  username?: string;
  name?: string;
  email?: string;
  description?: string;
  avatar_urls?: Record<string, string>;
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
  };
}

/** GET /wp/v2/users/me?context=edit —— 需要 Authorization: Bearer */
export async function fetchCurrentUser(token: string, fallbackUsername = ""): Promise<UserProfile> {
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
}

/** POST /wp/v2/users/me —— 更新当前用户资料 / 密码 */
export async function updateCurrentUser(
  token: string,
  patch: ProfileUpdatePayload,
  fallbackUsername = "",
): Promise<UserProfile> {
  const payload: Record<string, string> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.password) payload.password = patch.password;

  const { response, body } = await request(`${USERS_ME_ENDPOINT}?context=edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const { message, code, isPolicy } = extractError(body, "Your profile could not be saved.");
    throw new ApiError(message, response.status, code, isPolicy);
  }

  return toUserProfile(body as WPUserPayload | null, fallbackUsername);
}

/**
 * DELETE /wp/v2/users/me
 * WordPress 默认不允许用户删除自己（需要 delete_users 能力），
 * 普通账号通常会拿到 403，这里把站点返回的原话透传给用户。
 */
export async function deleteCurrentUser(token: string): Promise<void> {
  const { response, body } = await request(`${USERS_ME_ENDPOINT}?reassign=1&force=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const { message, code, isPolicy } = extractError(
      body,
      "Your account could not be deleted automatically. Please contact the site owner.",
    );
    throw new ApiError(message, response.status, code, isPolicy);
  }
}

/* ---------------------------------------------------------------- 评论 */

export interface WPComment {
  id: number;
  post: number;
  parent: number;
  author_name: string;
  date: string;
  content: { rendered: string };
  author_avatar_urls?: Record<string, string>;
}

/** GET /wp/v2/comments?post={id} */
export async function fetchComments(postId: number): Promise<WPComment[]> {
  const { response, body } = await request(
    `${COMMENTS_ENDPOINT}?post=${postId}&order=asc&per_page=100&_fields=id,post,parent,author_name,date,content,author_avatar_urls`,
  );

  if (!response.ok) {
    const { message, code } = extractError(body, "Unable to load comments.");
    throw new ApiError(message, response.status, code);
  }

  return Array.isArray(body) ? (body as WPComment[]) : [];
}

/** POST /wp/v2/comments —— 必须携带 Authorization: Bearer <token> */
export async function createComment(postId: number, content: string, token: string): Promise<WPComment> {
  const { response, body } = await request(COMMENTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ post: postId, content }),
  });

  if (!response.ok) {
    const { message, code } = extractError(body, "Your comment could not be posted.");
    throw new ApiError(message, response.status, code);
  }

  return body as WPComment;
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
