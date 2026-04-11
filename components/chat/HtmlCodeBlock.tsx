'use client';

import { useCallback, useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';
import { AppWindow, PictureInPicture2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

type HtmlCodeBlockProps = {
  codeText: string;
  style: SyntaxHighlighterProps['style'];
  language: string;
  isUser: boolean;
};

/** Blob 内文档不受全局 CSS 影响，注入样式以隐藏滚动条并保留滚动 */
function injectPreviewScrollbarHide(html: string): string {
  const style =
    '<style data-nexus-preview>html,body{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar,body::-webkit-scrollbar{width:0;height:0}</style>';
  const t = html.trim();
  if (/<head[\s>]/i.test(t)) {
    return t.replace(/<head([^>]*)>/i, '<head$1>' + style);
  }
  if (/<html[^>]*>\s*<body/i.test(t)) {
    return t.replace(/<html([^>]*)>/i, '<html$1><head><meta charset="utf-8"/>' + style + '</head>');
  }
  if (/<html[\s>]/i.test(t)) {
    return t.replace(/<html([^>]*)>/i, '<html$1><head><meta charset="utf-8"/>' + style + '</head>');
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${style}</head><body>${t}</body></html>`;
}

/**
 * HTML 代码块：语法高亮 + 新窗口 Blob 预览 + 沙箱 iframe 预览。
 * 沙箱限制部分能力，复杂页面建议用「新窗口预览」。
 */
export function HtmlCodeBlock({
  codeText,
  style,
  language,
  isUser,
}: HtmlCodeBlockProps) {
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const openInNewWindow = useCallback(() => {
    const blob = new Blob([injectPreviewScrollbarHide(codeText)], {
      type: 'text/html;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      URL.revokeObjectURL(url);
      toast.error('无法打开新窗口，请允许本站弹出窗口');
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }, [codeText]);

  const openSandboxPreview = useCallback(() => {
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      const blob = new Blob([injectPreviewScrollbarHide(codeText)], {
        type: 'text/html;charset=utf-8',
      });
      return URL.createObjectURL(blob);
    });
    setSandboxOpen(true);
  }, [codeText]);

  const handleSandboxOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
    setSandboxOpen(open);
  }, []);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return (
    <>
      <div
        className={cn(
          'my-3 overflow-hidden rounded-lg border border-border',
          isUser ? 'border-white/25 bg-black/20' : 'bg-background/50',
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 border-b px-3 py-2',
            isUser
              ? 'border-white/15 bg-black/25'
              : 'border-border/80 bg-muted/30',
          )}
        >
          <span
            className={cn(
              'text-[11px] font-medium uppercase tracking-wide',
              isUser ? 'text-primary-foreground/70' : 'text-muted-foreground',
            )}
          >
            HTML
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className={cn(
                'h-7 gap-1 text-xs',
                isUser && 'text-primary-foreground hover:bg-white/10',
              )}
              onClick={openInNewWindow}
            >
              <AppWindow className="size-3.5 opacity-80" aria-hidden />
              新窗口预览
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className={cn(
                'h-7 gap-1 text-xs',
                isUser && 'text-primary-foreground hover:bg-white/10',
              )}
              onClick={openSandboxPreview}
            >
              <PictureInPicture2 className="size-3.5 opacity-80" aria-hidden />
              沙箱预览
            </Button>
          </div>
        </div>
        <SyntaxHighlighter
          language={language}
          style={style}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '0.8125rem',
            lineHeight: 1.55,
          }}
          codeTagProps={{
            className: 'font-mono',
            style: { fontFamily: 'ui-monospace, monospace' },
          }}
        >
          {codeText}
        </SyntaxHighlighter>
      </div>

      <Dialog open={sandboxOpen} onOpenChange={handleSandboxOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-3 sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>HTML 沙箱预览</DialogTitle>
            <DialogDescription>
              在 iframe 沙箱中运行，部分 API（如部分跨域资源）可能受限；完整效果请使用「新窗口预览」。
            </DialogDescription>
          </DialogHeader>
          {blobUrl ? (
            <iframe
              title="HTML 沙箱预览"
              src={blobUrl}
              className="min-h-[min(70vh,720px)] w-full flex-1 rounded-md border border-border bg-white dark:bg-background"
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
