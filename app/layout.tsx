import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/Providers';
import { cn } from "@/lib/utils";
import {
  THEME_BOOT_SCRIPT,
  THEME_STORAGE_KEY,
  themeClassFromClientHint,
  themeClassFromCookie,
} from '@/lib/theme-resolve';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Nexus-Prime',
  description:
    'Nexus-Prime：智能 Agent 对话与远程能力编排，与站内品牌一致。',
  applicationName: 'Nexus-Prime',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const h = await headers();
  const cookieTheme = cookieStore.get(THEME_STORAGE_KEY)?.value;
  let initial: 'light' | 'dark' | null = themeClassFromCookie(cookieTheme);
  if (initial === null) {
    initial = themeClassFromClientHint(
      h.get('sec-ch-prefers-color-scheme'),
    );
  }
  const themeClass = initial ?? undefined;

  return (
    <html
      lang="zh-CN"
      className={cn(jetbrainsMono.variable, inter.variable, themeClass)}
      suppressHydrationWarning
    >
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
