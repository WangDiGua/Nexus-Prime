'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@/types/user';
import {
  sessionPayloadToUser,
  type AuthSessionUserPayload,
} from '@/lib/auth/session-user';
import { LoginDialog } from '@/components/auth/login-dialog';
import { RegisterDialog } from '@/components/auth/register-dialog';

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isReady: boolean;
  refresh: () => Promise<void>;
  openLogin: () => void;
  closeLogin: () => void;
  loginOpen: boolean;
  openRegister: () => void;
  closeRegister: () => void;
  registerOpen: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  /** 合并并发 refresh，避免后返回的失败请求把已登录状态冲掉 */
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    const p = (async () => {
      try {
        const r = await fetch('/api/auth/me', {
          credentials: 'include',
          cache: 'no-store',
        });
        let d: { success?: boolean; user?: User | null } = {};
        try {
          d = (await r.json()) as typeof d;
        } catch {
          // 非 JSON（如网关错误页）：不当作登出
          return;
        }

        if (r.ok && d.success && d.user) {
          setUser(d.user);
          return;
        }

        // 仅当服务端明确表示「未登录」时清空，避免 500/网络抖动导致来回切换
        if (r.status === 401) {
          setUser(null);
          return;
        }
      } catch {
        // 网络错误：保留当前 user，避免已登录界面与登录按钮来回闪
      } finally {
        setReady(true);
      }
    })().finally(() => {
      refreshPromiseRef.current = null;
    });
    refreshPromiseRef.current = p;
    return p;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);
  const openRegister = useCallback(() => setRegisterOpen(true), []);
  const closeRegister = useCallback(() => setRegisterOpen(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isReady: ready,
      refresh,
      openLogin,
      closeLogin,
      loginOpen,
      openRegister,
      closeRegister,
      registerOpen,
    }),
    [
      user,
      ready,
      refresh,
      openLogin,
      closeLogin,
      loginOpen,
      openRegister,
      closeRegister,
      registerOpen,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={(payload: AuthSessionUserPayload) => {
          setUser(sessionPayloadToUser(payload));
          setLoginOpen(false);
          void refresh();
        }}
        onOpenRegister={() => {
          setLoginOpen(false);
          setRegisterOpen(true);
        }}
      />
      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onSuccess={(payload: AuthSessionUserPayload) => {
          setUser(sessionPayloadToUser(payload));
          setRegisterOpen(false);
          void refresh();
        }}
        onOpenLogin={() => {
          setRegisterOpen(false);
          setLoginOpen(true);
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
