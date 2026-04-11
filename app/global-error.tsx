'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * 根布局或全局壳层崩溃时使用（替换整棵 root layout）。
 * 必须自带 html/body；单独引入 globals 以保持主题色与排版。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
          <div className="max-w-md space-y-2 text-center">
            <h1 className="text-lg font-semibold tracking-tight">应用加载失败</h1>
            <p className="text-sm text-muted-foreground">
              {process.env.NODE_ENV === 'development'
                ? error.message || '根组件出错，请查看终端日志。'
                : '请尝试刷新页面，若持续出现请联系管理员。'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            重试
          </button>
          <a
            href="/chat"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            返回对话页
          </a>
        </div>
      </body>
    </html>
  );
}
