import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { BackgroundCubesGrid } from '@/components/ui/background-cubes-grid';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

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

        <Navbar />
        <div className="flex-1 relative z-0">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
