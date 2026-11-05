'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { CustomerNavbar } from '@/components/layout/CustomerNavbar';
import { WorkerNavbar } from '@/components/layout/WorkerNavbar';

function NavbarContent() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'worker' | 'admin' | null>(null);
  const pathname = usePathname();

  // Floating navbar animation (reveals on scroll up, hides on scroll down)
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(true);

  useMotionValueEvent(scrollY, 'change', (current) => {
    if (typeof current === 'number') {
      const prev = scrollY.getPrevious() ?? 0;
      const direction = current - prev;

      // Always visible near top of page
      if (current < 50) {
        setVisible(true);
      } else {
        // Scrolling UP reveals navbar; scrolling DOWN hides it
        if (direction < 0) {
          setVisible(true);
        } else if (direction > 5) {
          setVisible(false);
        }
      }
    }
  });

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const resolveUserInfo = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (json.success && json.data?.authenticated && json.data?.user) {
          setUserEmail(json.data.user.email || null);
          setDisplayName(json.data.user.fullName || json.data.user.email?.split('@')[0] || '');
          setUserRole(json.data.role as 'worker' | 'customer' | 'admin');
          return;
        }
      } catch {
        // Fallback
      }

      setUserEmail(null);
      setDisplayName(null);
      setUserRole(null);
    };

    resolveUserInfo();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        resolveUserInfo();
      } else {
        setUserEmail(null);
        setDisplayName(null);
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
      setUserEmail(null);
      setDisplayName(null);
      setUserRole(null);
      window.location.href = '/login';
    }
  };

  const isAuthPage = pathname === '/login' || pathname.startsWith('/login');
  const isWorkerPortal =
    pathname.startsWith('/worker') ||
    pathname === '/dashboard' ||
    (userRole === 'worker' && (pathname === '/dashboard' || pathname.startsWith('/worker')));

  return (
    <AnimatePresence mode="wait">
      <motion.header
        initial={{ y: 0, opacity: 1 }}
        animate={{
          y: visible ? 0 : -100,
          opacity: visible ? 1 : 0,
        }}
        transition={{
          duration: 0.25,
          ease: 'easeInOut',
        }}
        className="sticky top-0 z-50 w-full bg-transparent"
      >
        {isAuthPage ? (
          /* Minimal Auth Header */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex flex-col group">
                <span className="font-extrabold text-2xl text-[#0D4A52] tracking-tight group-hover:text-[#072F35] transition-colors">
                  Sahayak
                </span>
                <p className="text-[11px] text-[#576563] hidden sm:block">Trusted help. Fair work.</p>
              </Link>
            </div>
          </div>
        ) : isWorkerPortal ? (
          /* Dedicated Worker Navigation */
          <WorkerNavbar
            userEmail={userEmail}
            displayName={displayName}
            onSignOut={handleSignOut}
          />
        ) : (
          /* Dedicated Customer Navigation */
          <CustomerNavbar
            userEmail={userEmail}
            displayName={displayName}
            onSignOut={handleSignOut}
          />
        )}
      </motion.header>
    </AnimatePresence>
  );
}

export function NavbarFallback() {
  return (
    <header className="sticky top-0 z-50 w-full bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          <Link href="/" className="flex flex-col">
            <span className="font-extrabold text-2xl text-[#0D4A52] tracking-tight">Sahayak</span>
            <p className="text-[11px] text-[#576563] hidden sm:block">Trusted help. Fair work.</p>
          </Link>
          <div className="h-9 w-24 bg-gray-200 animate-pulse rounded-full" />
        </div>
      </div>
    </header>
  );
}

export function Navbar() {
  return (
    <React.Suspense fallback={<NavbarFallback />}>
      <NavbarContent />
    </React.Suspense>
  );
}
