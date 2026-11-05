'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Search,
  Download,
  Eye,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/ToastContext';

interface JobRecord {
  id: string;
  title: string;
  category: string;
  status: string;
  urgency: string;
  city: string;
  pincode: string;
  address_line: string;
  final_price_inr?: number;
  customerName?: string;
  customerPhone?: string;
  created_at: string;
}

export default function JobsManagerPage() {
  const { success, error } = useToast();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [targetJob, setTargetJob] = useState<JobRecord | null>(null);
  const [jobAction, setJobAction] = useState<'FORCE_CANCEL' | 'FLAG'>('FORCE_CANCEL');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const params = new URLSearchParams({
          status: statusFilter,
          category: categoryFilter,
          search,
          page: page.toString(),
          limit: '12',
        });
        const res = await fetch(`/api/admin/jobs?${params.toString()}`);
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          setJobs(json.data.jobs);
          setTotalPages(json.data.pagination.totalPages || 1);
          setTotalCount(json.data.pagination.total || 0);
        }
      } catch {
        if (isMounted) error('Failed to load marketplace jobs');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [statusFilter, categoryFilter, search, page, error]);

  const refreshJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        category: categoryFilter,
        search,
        page: page.toString(),
        limit: '12',
      });
      const res = await fetch(`/api/admin/jobs?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setJobs(json.data.jobs);
        setTotalPages(json.data.pagination.totalPages || 1);
        setTotalCount(json.data.pagination.total || 0);
      }
    } catch {
      error('Failed to load marketplace jobs');
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (job: JobRecord, action: 'FORCE_CANCEL' | 'FLAG') => {
    setTargetJob(job);
    setJobAction(action);
    setModalOpen(true);
  };

  const handleConfirmAction = async (reason: string) => {
    if (!targetJob) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: targetJob.id,
          action: jobAction,
          reason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success(`Job ${targetJob.title.slice(0, 20)}... updated: ${jobAction}.`);
        setModalOpen(false);
        refreshJobs();
      } else {
        error(json.error?.message || 'Job action failed.');
      }
    } catch {
      error('Network error executing job action.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = () => {
    window.open(
      `/api/admin/jobs?status=${statusFilter}&category=${categoryFilter}&search=${encodeURIComponent(
        search
      )}&format=csv`,
      '_blank'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#0D4A52]">
              <Briefcase className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">Jobs & Service Requests</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Monitor active marketplace bids, OTP milestone verifications, and force-cancel when necessary.
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

      {/* Filters and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-2xl border border-[#E5DFD2] shadow-2xs">
        {/* Search */}
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#576563]" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, pincode, or address..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2] focus:outline-none focus:ring-2 focus:ring-[#0D4A52]"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2] focus:outline-none focus:ring-2 focus:ring-[#0D4A52] text-[#152220]"
          >
            <option value="all">All Statuses</option>
            <option value="POSTED">Posted</option>
            <option value="BIDDING_OPEN">Bidding Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="DISPUTED">Disputed</option>
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2] focus:outline-none focus:ring-2 focus:ring-[#0D4A52] text-[#152220]"
          >
            <option value="all">All Categories</option>
            <option value="plumbing">Plumbing</option>
            <option value="electrical">Electrical</option>
            <option value="cleaning">Cleaning</option>
            <option value="painting">Painting</option>
            <option value="carpentry">Carpentry</option>
            <option value="appliance_repair">Appliance Repair</option>
          </select>
        </div>
      </div>

      {/* Jobs Table */}
      <Card className="p-0 overflow-hidden rounded-2xl border-[#E5DFD2] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F5] text-[#576563] font-semibold border-b border-[#E5DFD2]">
              <tr>
                <th className="px-4 py-3">Job Details</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD2]/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#576563]">
                    Loading marketplace jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#576563]">
                    No jobs found matching selected criteria.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#FAF9F5]/70 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <Link
                        href={`/admin/jobs/${job.id}`}
                        className="font-bold text-[#152220] hover:text-[#0D4A52] hover:underline block truncate"
                      >
                        {job.title}
                      </Link>
                      <span className="text-[10px] text-[#576563]">
                        {new Date(job.created_at).toLocaleDateString()} • {job.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold capitalize text-[#0D4A52] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        {job.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#152220] block truncate">
                        {job.customerName || 'Anonymous Customer'}
                      </span>
                      <span className="text-[10px] text-[#576563]">{job.customerPhone}</span>
                    </td>
                    <td className="px-4 py-3 text-[#576563]">
                      <span className="block truncate">{job.address_line}</span>
                      <span className="text-[10px] text-[#576563]/80">PIN: {job.pincode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} type="job" />
                    </td>
                    <td className="px-4 py-3 font-bold text-[#0D4A52]">
                      {job.final_price_inr ? `₹${job.final_price_inr}` : 'Pending Bid'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                      <Link href={`/admin/jobs/${job.id}`}>
                        <Button size="sm" variant="ghost" className="rounded-lg text-xs py-1">
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Inspect
                        </Button>
                      </Link>

                      {job.status !== 'CANCELLED' && job.status !== 'COMPLETED' && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => openActionModal(job, 'FORCE_CANCEL')}
                          className="rounded-lg text-xs py-1"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-[#E5DFD2] flex items-center justify-between text-xs text-[#576563]">
          <span>
            Showing Page {page} of {totalPages} ({totalCount} total jobs)
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

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalOpen}
        title={`${jobAction === 'FORCE_CANCEL' ? 'Force Cancel' : 'Flag'} Job Request`}
        description={`This action will override normal marketplace state and record an immutable audit log entry.`}
        confirmLabel={jobAction === 'FORCE_CANCEL' ? 'Cancel Job Request' : 'Flag Job'}
        variant="danger"
        requireReason={true}
        reasonPlaceholder="Specify reason (e.g. Fraudulent service request, terms violation, customer request)..."
        isLoading={actionLoading}
        onConfirm={handleConfirmAction}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
