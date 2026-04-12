'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/lib/toast';
import type { AuthSessionUserPayload } from '@/lib/auth/session-user';

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: AuthSessionUserPayload) => void;
  onOpenRegister?: () => void;
}

export function LoginDialog({
  open,
  onOpenChange,
  onSuccess,
  onOpenRegister,
}: LoginDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        user?: AuthSessionUserPayload;
      };

      if (!response.ok || !data.success) {
        const msg = data.error || '登录失败';
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      if (!data.user?.id) {
        const msg = '登录响应缺少用户信息，请稍后重试';
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      toast.success('登录成功');
      setUsername('');
      setPassword('');
      onSuccess(data.user);
    } catch {
      const msg = '网络错误，请稍后重试';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>登录</DialogTitle>
          <DialogDescription>登录后即可使用对话与相关功能</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="login-dialog-username">用户名</Label>
            <Input
              id="login-dialog-username"
              name="username"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-dialog-password">密码</Label>
            <Input
              id="login-dialog-password"
              name="password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中…' : '登录'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              还没有账号？{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => {
                  onOpenChange(false);
                  onOpenRegister?.();
                }}
              >
                立即注册
              </button>
            </p>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
