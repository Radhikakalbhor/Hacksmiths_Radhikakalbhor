import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Suspense } from 'react';
import { Navbar, NavbarFallback } from '@/components/layout/Navbar';
import { BackgroundCubesGrid } from '@/components/ui/background-cubes-grid';

// Robust offline-safe font variable fallbacks
const geistSans = { variable: '--font-geist-sans' };
const geistMono = { variable: '--font-geist-mono' };

export const metadata: Metadata = {
  title: 'Sahayak | AI-Powered Hyperlocal Services Marketplace',
  description:
    'Trusted help. Fair work. Stronger communities. Find vetted local plumbers, electricians, cleaners, and household helpers with transparent price benchmarks and OTP-verified safety.',
  keywords: [
    'hyperlocal marketplace',
    'plumber near me',
    'electrician',
    'home cleaner',
    'maid service',
    'fair price benchmark',
    'blue-collar jobs',
    'Sahayak',
  ],
  authors: [{ name: 'Sahayak Technologies' }],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/images/logo.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
  },
  openGraph: {
    title: 'Sahayak | AI-Powered Hyperlocal Services Marketplace',
    description: 'Trusted help. Fair work. Stronger communities.',
    images: [{ url: '/images/logo-full.png', width: 1024, height: 572, alt: 'Sahayak Home Services' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#FAF9F5] text-[#152220] relative">
        {/* Permanent Global 3D Cubes Grid Animation across entire site */}
        <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
          <BackgroundCubesGrid
            className="w-full h-full pointer-events-none"
            cellSize={120}
            topColor="#FAF9F5"
            leftColor="#ECE6DA"
            rightColor="#DFD8CB"
            glowColor="#217E66"
            glow={0.5}
            amplitude={0.65}
            speed={7}
            idleRipples={true}
          />
        </div>

        <Suspense fallback={<NavbarFallback />}>
          <Navbar />
        </Suspense>
        <div className="flex-1 relative">{children}</div>
      </body>
    </html>
  );
}
