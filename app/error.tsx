'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 捕获子路由/页面在渲染时的错误，避免整页只剩纯文本 “Internal Server Error”。
 * 不覆盖 root layout 自身抛错（见 global-error.tsx）。
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-lg font-semibold tracking-tight">页面暂时无法显示</h1>
        <p className="text-sm text-muted-foreground">
          {process.env.NODE_ENV === 'development'
            ? error.message || '渲染出错，请查看终端或控制台日志。'
            : '加载时出现问题，你可以重试或返回对话页。'}
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground/80">digest: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          重试
        </Button>
        <Link href="/chat" className={cn(buttonVariants({ variant: 'outline' }))}>
          返回对话
        </Link>
      </div>
    </div>
  );
}
