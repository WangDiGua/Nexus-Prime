'use client';

import { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { useDarkMode } from '@/hooks/use-dark-mode';

export function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);
  const isDark = useDarkMode();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: isDark ? 'dark' : 'default',
      fontFamily: 'inherit',
    });

    const uniqueId = `mermaid-${baseId}-${Math.random().toString(36).slice(2, 11)}`;

    void (async () => {
      try {
        const { svg } = await mermaid.render(uniqueId, chart.trim());
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) {
          setError(msg);
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, baseId, isDark]);

  return (
    <div className="my-4 w-full overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 dark:bg-muted/20">
      {error ? (
        <p className="mb-2 font-mono text-xs text-destructive">{error}</p>
      ) : null}
      <div
        ref={containerRef}
        className="flex min-h-[2rem] justify-center [&_svg]:h-auto [&_svg]:max-w-full"
      />
    </div>
  );
}
