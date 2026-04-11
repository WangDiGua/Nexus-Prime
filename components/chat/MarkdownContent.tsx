'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';
import { MermaidDiagram } from '@/components/chat/MermaidDiagram';
import { RechartsBlock } from '@/components/chat/RechartsBlock';
import { HtmlCodeBlock } from '@/components/chat/HtmlCodeBlock';

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains('dark'));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

const prismLanguageAlias: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  ts: 'typescript',
  js: 'javascript',
};

function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase();
  return prismLanguageAlias[lower] ?? lower;
}

export function MarkdownContent({
  content,
  variant,
}: {
  content: string;
  variant: 'user' | 'assistant';
}) {
  const isUser = variant === 'user';
  const isDark = useIsDark();
  const codeStyle = isUser ? oneDark : isDark ? oneDark : oneLight;

  const components: Components = useMemo(
    () => ({
      pre({ children }) {
        return <>{children}</>;
      },
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        const lang = match?.[1];
        const codeText = String(children).replace(/\n$/, '');

        if (!lang) {
          return (
            <code
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[0.9em]',
                isUser
                  ? 'bg-white/20 text-primary-foreground'
                  : 'bg-muted text-foreground',
              )}
              {...props}
            >
              {children}
            </code>
          );
        }

        if (lang.toLowerCase() === 'mermaid') {
          return <MermaidDiagram chart={codeText} />;
        }

        if (['chart', 'recharts'].includes(lang.toLowerCase())) {
          return <RechartsBlock code={codeText} isDark={isDark} />;
        }

        const langLower = lang.toLowerCase();
        if (langLower === 'html' || langLower === 'htm') {
          return (
            <HtmlCodeBlock
              codeText={codeText}
              style={codeStyle}
              language="markup"
              isUser={isUser}
            />
          );
        }

        const prismLang = normalizeLanguage(lang);

        return (
          <SyntaxHighlighter
            language={prismLang}
            style={codeStyle}
            PreTag="div"
            customStyle={{
              margin: '0.75rem 0',
              borderRadius: '0.5rem',
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
        );
      },
      table({ children, ...props }) {
        return (
          <div className="my-4 w-full overflow-x-auto">
            <table
              className={cn(
                'w-full border-collapse text-left text-sm',
                'border border-border',
                '[&_th]:border [&_th]:border-border [&_th]:bg-muted/60 [&_th]:px-3 [&_th]:py-2',
                '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2',
              )}
              {...props}
            >
              {children}
            </table>
          </div>
        );
      },
      a({ children, href, ...props }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'font-medium underline underline-offset-2',
              isUser ? 'text-primary-foreground/95' : 'text-primary',
            )}
            {...props}
          >
            {children}
          </a>
        );
      },
      blockquote({ children, ...props }) {
        return (
          <blockquote
            className={cn(
              'my-3 border-l-4 pl-4 italic',
              isUser ? 'border-white/40' : 'border-muted-foreground/40',
            )}
            {...props}
          >
            {children}
          </blockquote>
        );
      },
    }),
    [codeStyle, isDark, isUser],
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
