'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Download,
  ShieldAlert,
  Ban,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/ToastContext';

interface UserRecord {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: 'customer' | 'worker' | 'admin' | 'ADMIN';
  verification_status: string;
  primary_city: string;
  is_suspended: boolean;
  suspended_reason?: string | null;
  created_at: string;
}

export default function UsersDirectoryPage() {
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'worker'>('all');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Moderation Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<UserRecord | null>(null);
  const [moderationAction, setModerationAction] = useState<'SUSPEND' | 'REACTIVATE' | 'BAN'>('SUSPEND');
  const [actionLoading, setActionLoading] = useState(false);

  const reloadUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        role: activeTab,
        search,
        page: page.toString(),
        limit: '12',
      });
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setUsers(json.data.users);
        setTotalPages(json.data.pagination.totalPages || 1);
        setTotalCount(json.data.pagination.total || 0);
      }
    } catch {
      error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, page, error]);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const params = new URLSearchParams({
          role: activeTab,
          search,
          page: page.toString(),
          limit: '12',
        });
        const res = await fetch(`/api/admin/users?${params.toString()}`);
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          setUsers(json.data.users);
          setTotalPages(json.data.pagination.totalPages || 1);
          setTotalCount(json.data.pagination.total || 0);
        }
      } catch {
        if (!cancelled) error('Failed to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [activeTab, page, search, error]);

  const openModerationModal = (user: UserRecord, action: 'SUSPEND' | 'REACTIVATE' | 'BAN') => {
    setTargetUser(user);
    setModerationAction(action);
    setModalOpen(true);
  };

  const handleConfirmModeration = async (reason: string) => {
    if (!targetUser) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUser.id,
          action: moderationAction,
          reason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success(`User ${targetUser.full_name} has been updated: ${moderationAction}.`);
        setModalOpen(false);
        reloadUsers();
      } else {
        error(json.error?.message || 'Moderation action failed.');
      }
    } catch {
      error('Network error executing user moderation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = () => {
    const link = document.createElement('a');
    link.href = `/api/admin/users?role=${activeTab}&search=${encodeURIComponent(search)}&format=csv`;
    link.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#0D4A52]">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">User & Partner Directory</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Browse, inspect, suspend or reactivate customer and service partner accounts.
          </p>
        </div>

        <Button
          onClick={handleExportCsv}
          variant="secondary"
          className="rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 self-start"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Role Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-[#E5DFD2] shadow-2xs self-start">
          {(['all', 'customer', 'worker'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-[#0D4A52] text-white shadow-xs'
                  : 'text-[#576563] hover:text-[#152220] hover:bg-[#FAF9F5]'
              }`}
            >
              {tab === 'all' ? `All (${totalCount})` : `${tab}s`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#576563]" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, phone or email..."
            className="w-full text-xs md:text-sm pl-10 pr-4 py-2 rounded-xl bg-white border border-[#E5DFD2] focus:outline-none focus:ring-2 focus:ring-[#0D4A52] shadow-2xs"
          />
        </div>
      </div>

      {/* Users Table Card */}
      <Card className="p-0 overflow-hidden rounded-2xl border-[#E5DFD2] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F5] text-[#576563] font-semibold border-b border-[#E5DFD2]">
              <tr>
                <th className="px-4 py-3">User Profile</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD2]/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#576563]">
                    Loading user directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#576563]">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#FAF9F5]/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#0D4A52]/10 text-[#0D4A52] flex items-center justify-center font-bold">
                          {u.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="font-bold text-[#152220] hover:text-[#0D4A52] hover:underline block"
                          >
                            {u.full_name}
                          </Link>
                          <span className="text-[10px] text-[#576563]">ID: {u.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                          u.role === 'worker'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : u.role === 'ADMIN'
                            ? 'bg-purple-50 text-purple-800 border border-purple-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#152220] block">{u.phone}</span>
                      <span className="text-[11px] text-[#576563]">{u.email || 'No email provided'}</span>
                    </td>
                    <td className="px-4 py-3 text-[#576563]">{u.primary_city}</td>
                    <td className="px-4 py-3">
                      {u.is_suspended ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Ban className="w-3 h-3" />
                          Suspended
                        </span>
                      ) : (
                        <StatusBadge status={u.verification_status} type="verification" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1.5">
                      <Link href={`/admin/users/${u.id}`}>
                        <Button size="sm" variant="ghost" className="rounded-lg text-xs py-1">
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Passport
                        </Button>
                      </Link>

                      {u.is_suspended ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openModerationModal(u, 'REACTIVATE')}
                          className="rounded-lg text-xs py-1 text-emerald-700 hover:text-emerald-800"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Reactivate
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openModerationModal(u, 'SUSPEND')}
                            className="rounded-lg text-xs py-1 text-amber-700 hover:text-amber-800"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                            Suspend
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openModerationModal(u, 'BAN')}
                            className="rounded-lg text-xs py-1"
                          >
                            <Ban className="w-3.5 h-3.5 mr-1" />
                            Ban
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-[#E5DFD2] flex items-center justify-between text-xs text-[#576563]">
          <span>
            Showing Page {page} of {totalPages} ({totalCount} total users)
          </span>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg text-xs px-2.5 py-1"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg text-xs px-2.5 py-1"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Moderation Confirmation Modal */}
      <ConfirmModal
        isOpen={modalOpen}
        title={`${moderationAction} User: ${targetUser?.full_name}`}
        description={`This action will be logged in the immutable audit log and take effect across the marketplace immediately.`}
        confirmLabel={`Confirm ${moderationAction}`}
        variant={moderationAction === 'REACTIVATE' ? 'primary' : 'danger'}
        requireReason={true}
        reasonPlaceholder={`Enter detailed reason for ${moderationAction} (e.g. Terms violation, chronic cancellation, fraudulent profile)...`}
        isLoading={actionLoading}
        onConfirm={handleConfirmModeration}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

