'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/admin/ToastContext';

interface AuditLogItem {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export default function AuditLogPage() {
  const { error } = useToast();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Selected Log inspection modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLogs() {
      try {
        const params = new URLSearchParams({
          action: actionFilter,
          entityType: entityFilter,
          page: page.toString(),
          limit: '15',
        });
        const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          setLogs(json.data.logs);
          setTotalPages(json.data.pagination.totalPages || 1);
          setTotalCount(json.data.pagination.total || 0);
        }
      } catch {
        if (!cancelled) error('Failed to load audit logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLogs();
    return () => {
      cancelled = true;
    };
  }, [actionFilter, entityFilter, page, error]);

  const handleExportCsv = () => {
    const link = document.createElement('a');
    link.href = `/api/admin/audit-log?action=${actionFilter}&entityType=${entityFilter}&format=csv`;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#0D4A52]">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">Immutable Admin Audit Trail</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Zero-trust tamper-evident event log recording all administrative modifications.
          </p>
        </div>

        <Button
          onClick={handleExportCsv}
          variant="secondary"
          className="rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 self-start"
        >
          <Download className="w-4 h-4" />
          <span>Export Audit CSV</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-[#E5DFD2] shadow-2xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#576563]" />
          <span className="text-xs font-bold text-[#152220]">Filter Entity:</span>
        </div>

        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="text-xs font-medium px-3 py-1.5 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2] focus:outline-none focus:ring-2 focus:ring-[#0D4A52]"
        >
          <option value="all">All Entities</option>
          <option value="WORKER">Workers</option>
          <option value="USER">Users</option>
          <option value="JOB">Jobs</option>
          <option value="DISPUTE">Disputes</option>
          <option value="SOS_INCIDENT">SOS Emergencies</option>
          <option value="REVIEW">Reviews</option>
          <option value="PRICE_BENCHMARK">Benchmarks</option>
          <option value="ANNOUNCEMENT">Announcements</option>
        </select>

        <div className="flex items-center gap-2 ml-auto sm:ml-2">
          <span className="text-xs font-bold text-[#152220]">Filter Action:</span>
        </div>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="text-xs font-medium px-3 py-1.5 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2] focus:outline-none focus:ring-2 focus:ring-[#0D4A52]"
        >
          <option value="all">All Actions</option>
          <option value="APPROVE">Approve</option>
          <option value="REJECT">Reject</option>
          <option value="SUSPEND">Suspend</option>
          <option value="BAN">Ban</option>
          <option value="RESOLVE">Resolve</option>
          <option value="UPDATE">Update</option>
          <option value="CREATE">Create</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <Card className="p-0 overflow-hidden rounded-2xl border-[#E5DFD2] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F5] text-[#576563] font-semibold border-b border-[#E5DFD2]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Admin Operator</th>
                <th className="px-4 py-3">Action Type</th>
                <th className="px-4 py-3">Entity Target</th>
                <th className="px-4 py-3">Metadata Preview</th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD2]/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#576563]">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#576563]">
                    No audit log records match filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF9F5]/70 transition-colors">
                    <td className="px-4 py-3 text-[#576563] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-[#152220] block">{log.adminName}</span>
                      <span className="text-[10px] text-[#576563]">{log.adminEmail}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#0D4A52]">
                      <span className="bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#152220] block">{log.entityType}</span>
                      <span className="text-[10px] text-[#576563] font-mono">
                        {log.entityId ? `ID: ${log.entityId.slice(0, 10)}...` : 'GLOBAL'}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-[#576563] font-mono text-[11px]">
                      {JSON.stringify(log.metadata)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLog(log)}
                        className="rounded-lg text-xs py-1"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Inspect
                      </Button>
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
            Showing Page {page} of {totalPages} ({totalCount} total audit entries)
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

      {/* Inspect Modal */}
      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#E5DFD2] p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5DFD2]">
              <h3 className="font-bold text-[#152220]">Audit Log Entry #{selectedLog.id.slice(0, 8)}</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-[#576563] hover:text-[#152220] text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p><strong>Action:</strong> {selectedLog.action}</p>
              <p><strong>Administrator:</strong> {selectedLog.adminName} ({selectedLog.adminEmail})</p>
              <p><strong>Target:</strong> {selectedLog.entityType} ({selectedLog.entityId || 'N/A'})</p>
              <p><strong>Timestamp:</strong> {new Date(selectedLog.createdAt).toISOString()}</p>
              <div>
                <strong className="block mb-1">Payload Metadata:</strong>
                <pre className="p-3 bg-[#FAF9F5] rounded-xl border border-[#E5DFD2] text-[11px] overflow-x-auto text-[#152220] font-mono">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
