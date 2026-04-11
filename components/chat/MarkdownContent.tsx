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

/** 不依赖 tailwind typography 插件，保证助手消息有清晰标题/列表/段落层次 */
function mdText(isUser: boolean) {
  return isUser ? 'text-primary-foreground/95' : 'text-foreground/95';
}

function mdHeading(isUser: boolean) {
  return isUser ? 'text-primary-foreground' : 'text-foreground';
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
      h1({ children, ...props }) {
        return (
          <h1
            className={cn(
              'mb-3 mt-6 text-xl font-semibold tracking-tight first:mt-0',
              mdHeading(isUser),
            )}
            {...props}
          >
            {children}
          </h1>
        );
      },
      h2({ children, ...props }) {
        return (
          <h2
            className={cn(
              'mb-2.5 mt-5 text-lg font-semibold tracking-tight',
              mdHeading(isUser),
            )}
            {...props}
          >
            {children}
          </h2>
        );
      },
      h3({ children, ...props }) {
        return (
          <h3
            className={cn(
              'mb-2 mt-4 text-base font-semibold',
              mdHeading(isUser),
            )}
            {...props}
          >
            {children}
          </h3>
        );
      },
      h4({ children, ...props }) {
        return (
          <h4
            className={cn(
              'mb-1.5 mt-3 text-[15px] font-semibold',
              mdHeading(isUser),
            )}
            {...props}
          >
            {children}
          </h4>
        );
      },
      h5({ children, ...props }) {
        return (
          <h5
            className={cn(
              'mb-1.5 mt-3 text-sm font-semibold',
              mdHeading(isUser),
            )}
            {...props}
          >
            {children}
          </h5>
        );
      },
      h6({ children, ...props }) {
        return (
          <h6
            className={cn(
              'mb-1.5 mt-3 text-sm font-medium text-muted-foreground',
              isUser && 'text-primary-foreground/90',
            )}
            {...props}
          >
            {children}
          </h6>
        );
      },
      p({ children, ...props }) {
        return (
          <p
            className={cn(
              'my-2.5 leading-[1.65] first:mt-0 last:mb-0',
              mdText(isUser),
              // 常见「整行只有 **小标题**」：抬成伪标题层次
              '[&:has(>strong:only-child)]:mb-2 [&:has(>strong:only-child)]:mt-4 first:[&:has(>strong:only-child)]:mt-0',
              '[&:has(>strong:only-child)>strong]:text-base [&:has(>strong:only-child)>strong]:font-semibold',
              '[&:has(>strong:only-child)>strong]:tracking-tight',
              !isUser &&
                '[&:has(>strong:only-child)>strong]:text-foreground [&:has(>strong:only-child)>strong]:block',
            )}
            {...props}
          >
            {children}
          </p>
        );
      },
      ul({ children, ...props }) {
        return (
          <ul
            className={cn(
              'my-3 list-outside list-disc space-y-1.5 pl-5 marker:text-muted-foreground',
              mdText(isUser),
              '[&_ul]:my-2 [&_ul]:list-[circle]',
            )}
            {...props}
          >
            {children}
          </ul>
        );
      },
      ol({ children, ...props }) {
        return (
          <ol
            className={cn(
              'my-3 list-outside list-decimal space-y-1.5 pl-5 marker:font-medium marker:text-muted-foreground',
              mdText(isUser),
              '[&_ol]:my-2',
            )}
            {...props}
          >
            {children}
          </ol>
        );
      },
      li({ children, ...props }) {
        return (
          <li
            className={cn('leading-relaxed [&>p]:my-1 [&>p:first-child]:mt-0', mdText(isUser))}
            {...props}
          >
            {children}
          </li>
        );
      },
      hr({ ...props }) {
        return (
          <hr
            className="my-6 border-0 border-t border-border/80"
            {...props}
          />
        );
      },
      strong({ children, ...props }) {
        return (
          <strong
            className={cn('font-semibold', mdHeading(isUser))}
            {...props}
          >
            {children}
          </strong>
        );
      },
      em({ children, ...props }) {
        return (
          <em className="italic opacity-95" {...props}>
            {children}
          </em>
        );
      },
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
