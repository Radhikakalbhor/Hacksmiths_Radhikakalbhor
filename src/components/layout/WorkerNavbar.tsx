'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  IconBrandTabler,
  IconWallet,
  IconCompass,
  IconStar,
  IconUserBolt,
  IconArrowLeft,
  IconBell,
  IconSettings,
} from '@tabler/icons-react';
import { motion } from 'motion/react';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import { WorkerNotificationsDrawer } from '@/components/worker/WorkerNotificationsDrawer';
import { WorkerNotification } from '@/types/wallet';

interface WorkerNavbarProps {
  userEmail: string | null;
  displayName: string | null;
  onSignOut: () => Promise<void>;
}

export const WorkerLogo = () => {
  return (
    <Link
      href="/worker/dashboard"
      className="relative z-20 flex items-center space-x-2.5 py-1 text-sm font-normal group"
    >
      <div className="h-6 w-6 shrink-0 rounded-lg bg-[#0D4A52] flex items-center justify-center text-white font-black text-xs shadow-xs group-hover:bg-[#072F35] transition">
        W
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col overflow-hidden"
      >
        <span className="font-extrabold text-base text-[#0D4A52] tracking-tight whitespace-pre leading-none group-hover:text-[#072F35] transition">
          Sahayak <span className="text-teal-600 font-semibold">Worker</span>
        </span>
        <span className="text-[9px] text-[#576563] tracking-wide whitespace-pre mt-0.5">
          Partner Portal
        </span>
      </motion.div>
    </Link>
  );
};

export const WorkerLogoIcon = () => {
  return (
    <Link
      href="/worker/dashboard"
      className="relative z-20 flex items-center justify-center py-1 group"
      title="Sahayak Worker"
    >
      <div className="h-6 w-6 shrink-0 rounded-lg bg-[#0D4A52] flex items-center justify-center text-white font-black text-xs shadow-xs group-hover:bg-[#072F35] transition">
        W
      </div>
    </Link>
  );
};

export function WorkerNavbar({ userEmail, displayName, onSignOut }: WorkerNavbarProps) {
  const [open, setOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeJobsCount, setActiveJobsCount] = useState<number>(0);
  const [openJobsCount, setOpenJobsCount] = useState<number>(0);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');

  // Load quick stats for the worker header
  useEffect(() => {
    let isCancelled = false;

    const fetchWorkerStats = async () => {
      try {
        const [walletRes, notifRes, jobsRes] = await Promise.all([
          fetch('/api/worker/wallet'),
          fetch('/api/worker/notifications'),
          fetch('/api/worker/jobs'),
        ]);

        if (isCancelled) return;

        if (walletRes.ok) {
          const wJson = await walletRes.json();
          if (wJson.success && wJson.data?.wallet) {
            setWalletBalance(wJson.data.wallet.availableBalanceInr ?? 0);
          }
        }

        if (notifRes.ok) {
          const nJson = await notifRes.json();
          if (nJson.success && Array.isArray(nJson.data?.notifications)) {
            setNotifications(nJson.data.notifications);
            setUnreadCount(nJson.data.unreadCount ?? 0);
          }
        }

        if (jobsRes.ok) {
          const jJson = await jobsRes.json();
          if (jJson.success && jJson.data) {
            const categorized = jJson.data.categorized || jJson.data;
            const up = Array.isArray(categorized.upcoming) ? categorized.upcoming.length : 0;
            const pe = Array.isArray(categorized.pending) ? categorized.pending.length : 0;
            const ac = Array.isArray(categorized.accepted) ? categorized.accepted.length : 0;
            setActiveJobsCount(up + pe + ac);
            if (Array.isArray(jJson.data.openJobs)) {
              setOpenJobsCount(jJson.data.openJobs.length);
            }
          }
        }
      } catch {
        // Silent fallback
      }
    };

    fetchWorkerStats();
    return () => {
      isCancelled = true;
    };
  }, [pathname, searchParams]);

  const handleMarkRead = async (id: string) => {
    try {
      await fetch('/api/worker/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/worker/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const isOverviewActive =
    (pathname === '/worker/dashboard' && (!currentTab || currentTab === 'overview')) ||
    pathname === '/worker/jobs-overview';

  const isWalletActive =
    pathname === '/worker/wallet' ||
    pathname === '/worker/earnings' ||
    currentTab === 'wallet';

  const isMarketplaceActive =
    pathname === '/worker/jobs' ||
    currentTab === 'marketplace';

  const isReputationActive =
    pathname === '/worker/reputation' ||
    currentTab === 'reputation';

  const isAdminActive = currentTab === 'admin';

  const workerLinks = [
    {
      label: 'Work Overview',
      href: '/worker/dashboard?tab=overview',
      active: isOverviewActive,
      badge: activeJobsCount > 0 ? (
        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-teal-600 text-white">
          {activeJobsCount}
        </span>
      ) : null,
      icon: (
        <IconBrandTabler
          className={`h-5 w-5 shrink-0 transition-colors ${
            isOverviewActive ? 'text-[#0D4A52]' : 'text-neutral-600'
          }`}
        />
      ),
    },
    {
      label: 'Earnings & Wallet',
      href: '/worker/wallet',
      active: isWalletActive,
      badge: walletBalance !== null ? (
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
          ₹{walletBalance.toLocaleString('en-IN')}
        </span>
      ) : null,
      icon: (
        <IconWallet
          className={`h-5 w-5 shrink-0 transition-colors ${
            isWalletActive ? 'text-[#0D4A52]' : 'text-neutral-600'
          }`}
        />
      ),
    },
    {
      label: 'Open Marketplace',
      href: '/worker/jobs',
      active: isMarketplaceActive,
      badge: openJobsCount > 0 ? (
        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-teal-500 text-teal-950">
          {openJobsCount}
        </span>
      ) : null,
      icon: (
        <IconCompass
          className={`h-5 w-5 shrink-0 transition-colors ${
            isMarketplaceActive ? 'text-[#0D4A52]' : 'text-neutral-600'
          }`}
        />
      ),
    },
    {
      label: 'Reputation & Reviews',
      href: '/worker/reputation',
      active: isReputationActive,
      icon: (
        <IconStar
          className={`h-5 w-5 shrink-0 transition-colors ${
            isReputationActive ? 'text-amber-500 fill-amber-400' : 'text-amber-500'
          }`}
        />
      ),
    },
  ];

  return (
    <>
      {/* Desktop Left Collapsible Sidebar */}
      <div className="fixed top-0 left-0 bottom-0 z-50 h-screen hidden md:block">
        <Sidebar open={open} setOpen={setOpen}>
          <SidebarBody className="justify-between gap-10 h-full bg-white/95 backdrop-blur-md border-r border-[#E5DFD2] shadow-xs">
            <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
              {open ? <WorkerLogo /> : <WorkerLogoIcon />}
              <div className="mt-8 flex flex-col gap-1.5">
                {workerLinks.map((link, idx) => (
                  <SidebarLink key={idx} link={link} active={link.active} />
                ))}
              </div>
            </div>
            <div className="border-t border-[#E5DFD2] pt-3 flex flex-col gap-1">
              {/* Notification Item */}
              <SidebarLink
                link={{
                  label: unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications',
                  badge: unreadCount > 0 ? (
                    <span className="w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-black flex items-center justify-center">
                      {unreadCount}
                    </span>
                  ) : null,
                  icon: (
                    <div className="relative">
                      <IconBell className="h-5 w-5 text-neutral-600 shrink-0" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full" />
                      )}
                    </div>
                  ),
                  onClick: () => setNotificationsOpen(true),
                }}
              />

              {/* Profile Item */}
              <SidebarLink
                link={{
                  label: displayName || userEmail?.split('@')[0] || 'Worker Partner',
                  icon: (
                    <div className="h-6 w-6 rounded-full bg-[#0D4A52] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {(displayName || userEmail || 'W')[0]?.toUpperCase()}
                    </div>
                  ),
                  href: '/worker/profile',
                }}
              />

              {/* Sign Out Item */}
              <SidebarLink
                link={{
                  label: 'Sign Out',
                  icon: <IconArrowLeft className="h-5 w-5 text-rose-600 shrink-0" />,
                  onClick: onSignOut,
                }}
              />
            </div>
          </SidebarBody>
        </Sidebar>
      </div>

      {/* Mobile Top Navbar with Drawer */}
      <div className="md:hidden sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-[#E5DFD2]">
        <Sidebar open={open} setOpen={setOpen}>
          <SidebarBody className="justify-between gap-8">
            <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
              <WorkerLogo />
              <div className="mt-8 flex flex-col gap-2">
                {workerLinks.map((link, idx) => (
                  <SidebarLink
                    key={idx}
                    link={link}
                    active={link.active}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>
            </div>
            <div className="border-t border-[#E5DFD2] pt-4 flex flex-col gap-2">
              <SidebarLink
                link={{
                  label: unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications',
                  icon: <IconBell className="h-5 w-5 text-neutral-700 shrink-0" />,
                  onClick: () => {
                    setOpen(false);
                    setNotificationsOpen(true);
                  },
                }}
              />
              <SidebarLink
                link={{
                  label: displayName || userEmail?.split('@')[0] || 'Worker Partner',
                  icon: <IconUserBolt className="h-5 w-5 text-teal-700 shrink-0" />,
                  href: '/worker/profile',
                  onClick: () => setOpen(false),
                }}
              />
              <SidebarLink
                link={{
                  label: 'Sign Out',
                  icon: <IconArrowLeft className="h-5 w-5 text-rose-600 shrink-0" />,
                  onClick: async () => {
                    setOpen(false);
                    await onSignOut();
                  },
                }}
              />
            </div>
          </SidebarBody>
        </Sidebar>
      </div>

      {/* Notifications Drawer */}
      <WorkerNotificationsDrawer
        notifications={notifications}
        unreadCount={unreadCount}
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
      />
    </>
  );
}
