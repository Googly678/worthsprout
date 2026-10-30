"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  TOKEN_STORAGE_KEY,
  deleteCurrentUser,
  fetchCurrentUser,
  getTokenExpiry,
  loginRequest,
  registerRequest,
  updateCurrentUser,
  type ProfileUpdatePayload,
  type UserProfile,
} from "@/lib/wp-api";

export type AuthMode = "login" | "register";

export interface AuthContextValue {
  /** 已登录用户资料；未登录为 null */
  profile: UserProfile | null;
  /** JWT，供评论 / 资料接口拼 `Authorization: Bearer` */
  token: string | null;
  /** localStorage 是否已读取完毕（避免服务端渲染与客户端首帧不一致） */
  isReady: boolean;
  /** 正在读取用户资料 */
  isLoadingProfile: boolean;
  isSubmitting: boolean;
  error: string | null;
  /** 资料接口不可用时的说明（例如站点关闭了用户 API） */
  profileError: string | null;
  mode: AuthMode;
  isModalOpen: boolean;
  openModal: (mode?: AuthMode) => void;
  closeModal: () => void;
  switchMode: (mode: AuthMode) => void;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: ProfileUpdatePayload) => Promise<boolean>;
  deleteAccount: () => Promise<boolean>;
}

interface StoredSession {
  token: string;
  username: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredSession> | null;
    if (!parsed?.token || !parsed.username) return null;

    // 本地兜底：token 过期就直接丢掉，避免带着废 token 发请求
    const expiry = getTokenExpiry(parsed.token);
    if (expiry !== null && expiry <= Date.now()) {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }

    return { token: parsed.token, username: parsed.username };
  } catch {
    return null;
  }
}

/** 资料接口不可用时，用登录返回的 username 造一个最小可用资料，保证页头不空 */
function fallbackProfile(username: string): UserProfile {
  return { id: 0, username, name: username, email: "", description: "", avatarUrl: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadProfile = useCallback(async (jwt: string, username: string) => {
    setIsLoadingProfile(true);
    setProfileError(null);

    try {
      setProfile(await fetchCurrentUser(jwt, username));
    } catch (cause) {
      // 站点可能关闭了用户 API —— 降级成最小资料，不阻断浏览与评论
      setProfile(fallbackProfile(username));
      setProfileError(cause instanceof ApiError ? cause.message : "Your profile could not be loaded.");
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    const session = readSession();

    if (session) {
      setToken(session.token);
      setProfile(fallbackProfile(session.username));
      setIsReady(true);
      void loadProfile(session.token, session.username);
      return;
    }

    setIsReady(true);
  }, [loadProfile]);

  // 多标签页同步：另一个标签登录/登出后，这里跟着变
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_STORAGE_KEY) return;

      const session = readSession();
      if (session) {
        setToken(session.token);
        setProfile(fallbackProfile(session.username));
        void loadProfile(session.token, session.username);
      } else {
        setToken(null);
        setProfile(null);
        setProfileError(null);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadProfile]);

  const persist = useCallback(
    (jwt: string, username: string) => {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token: jwt, username }));

      setToken(jwt);
      setProfile(fallbackProfile(username));
      setError(null);
      void loadProfile(jwt, username);
    },
    [loadProfile],
  );

  const clear = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  const openModal = useCallback((nextMode: AuthMode = "login") => {
    setMode(nextMode);
    setError(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setIsSubmitting(false);
  }, []);

  const switchMode = useCallback((nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const result = await loginRequest({ username, password });
        persist(result.token, result.username);
        setIsModalOpen(false);
        return true;
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Something went wrong. Please try again.");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [persist],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      setIsSubmitting(true);
      setError(null);

      try {
        await registerRequest({ username, email, password });

        // 注册成功后直接登录，省掉一次手动操作
        const result = await loginRequest({ username, password });
        persist(result.token, result.username);
        setIsModalOpen(false);
        return true;
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Something went wrong. Please try again.");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [persist],
  );

  const logout = useCallback(() => {
    clear();
    setError(null);
  }, [clear]);

  const refreshProfile = useCallback(async () => {
    if (!token || !profile) return;
    await loadProfile(token, profile.username);
  }, [token, profile, loadProfile]);

  const updateProfile = useCallback(
    async (patch: ProfileUpdatePayload) => {
      if (!token) return false;

      setProfileError(null);

      try {
        setProfile(await updateCurrentUser(token, patch, profile?.username ?? ""));
        return true;
      } catch (cause) {
        setProfileError(cause instanceof ApiError ? cause.message : "Your profile could not be saved.");
        return false;
      }
    },
    [token, profile],
  );

  const deleteAccount = useCallback(async () => {
    if (!token) return false;

    setProfileError(null);

    try {
      await deleteCurrentUser(token);
      clear();
      return true;
    } catch (cause) {
      setProfileError(cause instanceof ApiError ? cause.message : "Your account could not be deleted.");
      return false;
    }
  }, [token, clear]);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      token,
      isReady,
      isLoadingProfile,
      isSubmitting,
      error,
      profileError,
      mode,
      isModalOpen,
      openModal,
      closeModal,
      switchMode,
      login,
      register,
      logout,
      refreshProfile,
      updateProfile,
      deleteAccount,
    }),
    [
      profile,
      token,
      isReady,
      isLoadingProfile,
      isSubmitting,
      error,
      profileError,
      mode,
      isModalOpen,
      openModal,
      closeModal,
      switchMode,
      login,
      register,
      logout,
      refreshProfile,
      updateProfile,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}
