'use client';

import { useEffect, useState } from 'react';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';

type PrismComponent = typeof import('react-syntax-highlighter')['Prism'];
type PrismStylesModule = typeof import('react-syntax-highlighter/dist/esm/styles/prism');

type LazySyntaxCodeBlockProps = {
  codeText: string;
  language: string;
  isUser: boolean;
  isDark: boolean;
};

export function LazySyntaxCodeBlock({
  codeText,
  language,
  isUser,
  isDark,
}: LazySyntaxCodeBlockProps) {
  const [prismComponent, setPrismComponent] = useState<PrismComponent | null>(null);
  const [styles, setStyles] = useState<PrismStylesModule | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      import('react-syntax-highlighter'),
      import('react-syntax-highlighter/dist/esm/styles/prism'),
    ]).then(([prismModule, prismStyles]) => {
      if (cancelled) return;
      setPrismComponent(() => prismModule.Prism);
      setStyles(prismStyles);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!prismComponent || !styles) {
    return (
      <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-[0.8125rem] leading-[1.55] text-foreground">
        <code>{codeText}</code>
      </pre>
    );
  }

  const SyntaxHighlighter = prismComponent;
  const style: SyntaxHighlighterProps['style'] =
    isUser ? styles.oneDark : isDark ? styles.oneDark : styles.oneLight;

  return (
    <SyntaxHighlighter
      language={language}
      style={style}
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
}
