import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/Providers';
import { cn } from "@/lib/utils";
import { THEME_BOOT_SCRIPT } from '@/lib/theme-resolve';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'AI Portal Nexus',
  description: 'Production-grade AI Agent testing and orchestration portal.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={cn(jetbrainsMono.variable, inter.variable)} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Script
          id="nexus-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
