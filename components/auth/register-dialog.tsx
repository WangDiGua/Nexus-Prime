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

interface RegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 注册成功时传入接口返回的 user，避免依赖紧随其后的 /api/auth/me 竞态 */
  onSuccess: (user: AuthSessionUserPayload) => void;
  onOpenLogin?: () => void;
}

export function RegisterDialog({
  open,
  onOpenChange,
  onSuccess,
  onOpenLogin,
}: RegisterDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setEmail('');
    setDisplayName('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, displayName }),
        credentials: 'include',
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        user?: AuthSessionUserPayload;
      };

      if (!response.ok || !data.success) {
        const msg = data.error || '注册失败';
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      if (!data.user?.id) {
        const msg = '注册响应缺少用户信息，请稍后重试';
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      toast.success('注册成功');
      resetForm();
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[min(90vh,640px)] overflow-y-auto scrollbar-none">
        <DialogHeader>
          <DialogTitle>注册</DialogTitle>
          <DialogDescription>创建 AI 门户账号</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="register-dialog-username">用户名</Label>
            <Input
              id="register-dialog-username"
              name="username"
              type="text"
              placeholder="3–50 个字符"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={50}
              disabled={loading}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-dialog-password">密码</Label>
            <Input
              id="register-dialog-password"
              name="password"
              type="password"
              placeholder="至少 6 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-dialog-confirm">确认密码</Label>
            <Input
              id="register-dialog-confirm"
              name="confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-dialog-email">邮箱（可选）</Label>
            <Input
              id="register-dialog-email"
              name="email"
              type="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-dialog-display">显示名称（可选）</Label>
            <Input
              id="register-dialog-display"
              name="displayName"
              type="text"
              placeholder="请输入显示名称"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
              autoComplete="nickname"
            />
          </div>
          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '注册中…' : '注册'}
            </Button>
            {onOpenLogin ? (
              <p className="text-center text-sm text-muted-foreground">
                已有账号？{' '}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenLogin();
                  }}
                >
                  立即登录
                </button>
              </p>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
