import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Geist } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { ThemeScript } from '@/components/ThemeScript';
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'AI Portal Nexus',
  description: 'Production-grade AI Agent testing and orchestration portal.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={cn(jetbrainsMono.variable, inter.variable)} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          <ThemeScript />
          {children}
        </Providers>
      </body>
    </html>
  );
}
