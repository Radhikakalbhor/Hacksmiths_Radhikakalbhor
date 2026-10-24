import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

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
      <body className="min-h-full flex flex-col bg-[#FAF9F5] text-[#152220]">
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
