'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  Compass,
  Wallet,
  Receipt,
  Award,
  User,
  Bell,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { WorkerNotificationsDrawer } from '@/components/worker/WorkerNotificationsDrawer';
import { WorkerNotification } from '@/types/wallet';

interface WorkerNavbarProps {
  userEmail: string | null;
  displayName: string | null;
  userRole?: 'customer' | 'worker' | 'admin' | null;
  onSignOut: () => Promise<void>;
}

export function WorkerNavbar({ userEmail, displayName, userRole, onSignOut }: WorkerNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const pathname = usePathname();

  // Load quick stats for the worker header
  useEffect(() => {
    let isCancelled = false;

    const fetchWorkerStats = async () => {
      try {
        const [walletRes, notifRes] = await Promise.all([
          fetch('/api/worker/wallet'),
          fetch('/api/worker/notifications'),
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
      } catch {
        // Silent fallback
      }
    };

    fetchWorkerStats();
    return () => {
      isCancelled = true;
    };
  }, [pathname]);

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

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Name & Worker Badge */}
          <div className="flex items-center gap-3">
            <Link href="/worker/dashboard" className="flex items-center gap-2 group">
              <span className="font-black text-xl tracking-tight text-[#0D4A52] group-hover:text-[#072F35] transition-colors">
                Sahayak<span className="text-teal-600 font-medium">Worker</span>
              </span>
            </Link>
            <Badge variant="teal" className="hidden sm:inline-flex text-[10px] tracking-wide">
              Partner Portal
            </Badge>
          </div>

          {/* Right Action Area: Live Wallet Balance + Notifications + Sign Out */}
          <div className="flex items-center gap-2 sm:gap-3">
            {userRole === 'admin' && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D4A52] hover:bg-[#072F35] text-white text-xs font-semibold transition shadow-xs whitespace-nowrap"
                title="Open full Admin Operations Console"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Open full Admin Panel</span>
                <span className="sm:hidden">Admin Panel</span>
              </Link>
            )}

            {/* Quick Wallet Pill */}
            <Link
              href="/worker/wallet"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-900 transition shadow-2xs"
              title="View Wallet & Earnings"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                ₹{(walletBalance ?? 0).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </Link>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="relative p-2 rounded-full hover:bg-white text-[#576563] hover:text-[#0D4A52] border border-transparent hover:border-[#E5DFD2] transition cursor-pointer"
              title="Notifications"
              aria-label="Open notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={onSignOut}
              className="hidden sm:flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-700 hover:text-red-600 hover:bg-red-50 border border-gray-200 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6] transition-colors"
              aria-label="Toggle worker navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#E5DFD2] bg-white/98 backdrop-blur-md px-4 pt-2 pb-6 space-y-2">
          {userRole === 'admin' && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-[#0D4A52] text-white hover:bg-[#072F35]"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Open full Admin Panel</span>
            </Link>
          )}
          <Link
            href="/worker/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg text-[#0D4A52] hover:bg-[#EBF4F3]"
          >
            <Briefcase className="w-4 h-4" />
            <span>Work Overview</span>
          </Link>
          <Link
            href="/worker/jobs"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]"
          >
            <Compass className="w-4 h-4" />
            <span>Open Jobs</span>
          </Link>
          <Link
            href="/worker/wallet"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]"
          >
            <Wallet className="w-4 h-4" />
            <span>Wallet & Earnings</span>
          </Link>
          <Link
            href="/worker/transactions"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]"
          >
            <Receipt className="w-4 h-4" />
            <span>Transactions</span>
          </Link>
          <Link
            href="/worker/reputation"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]"
          >
            <Award className="w-4 h-4" />
            <span>Reputation Passport</span>
          </Link>
          <Link
            href="/worker/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]"
          >
            <User className="w-4 h-4" />
            <span>Profile & Skills</span>
          </Link>

          <div className="pt-2 border-t border-[#E5DFD2] flex items-center justify-between">
            <span className="text-xs text-gray-600 font-medium">{displayName || userEmail}</span>
            <button
              onClick={onSignOut}
              className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Worker Notifications Drawer */}
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
