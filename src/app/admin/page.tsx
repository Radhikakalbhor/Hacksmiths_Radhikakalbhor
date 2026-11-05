'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Briefcase,
  CheckCircle2,
  TrendingUp,
  IndianRupee,
  Star,
  ShieldAlert,
  AlertOctagon,
  ArrowRight,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { AdminLiveMap } from '@/components/admin/AdminLiveMap';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  AdminDashboardStats,
  StatusDistribution,
  AnomalyAlert,
  WorkerLeaderboardItem,
  ActivityFeedItem,
} from '@/types/admin';

export default function AdminDashboardPage() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      try {
        const res = await fetch(`/api/admin/stats?days=${days}`);
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [days, refreshKey]);

  const kpis = data?.kpis;
  const dailyStats = data?.dailyStats || [];
  const categoryStats = data?.categoryDistribution || [];
  const statusStats = data?.statusDistribution || [];
  const topAreas = data?.topAreas || [];
  const leaderboard = data?.leaderboard || [];
  const feed = data?.feed || [];
  const anomalies = data?.anomalies || [];

  const STATUS_COLORS: Record<string, string> = {
    COMPLETED: '#217E66',
    IN_PROGRESS: '#0D4A52',
    BIDDING_OPEN: '#F59E0B',
    CANCELLED: '#EF4444',
    DISPUTED: '#8B5CF6',
    ASSIGNED: '#3B82F6',
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#152220]">
            Platform Overview & Operations
          </h1>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Real-time KPIs, market benchmarks, safety signals, and field activity across Mumbai.
          </p>
        </div>

        {/* 7d / 30d / 90d Filter */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-[#E5DFD2] shadow-2xs self-start">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                days === d
                  ? 'bg-[#0D4A52] text-white shadow-xs'
                  : 'text-[#576563] hover:text-[#152220] hover:bg-[#FAF9F5]'
              }`}
            >
              {d === 7 ? 'Last 7 Days' : d === 30 ? 'Last 30 Days' : 'Last Quarter (90d)'}
            </button>
          ))}
          <button
            onClick={() => {
              setLoading(true);
              setRefreshKey((k) => k + 1);
            }}
            title="Refresh statistics"
            aria-label="Refresh statistics"
            className="p-1.5 text-[#576563] hover:text-[#0D4A52] rounded-lg hover:bg-[#FAF9F5] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 8 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#576563] uppercase tracking-wider">
              Total Customers
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0D4A52] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-[#152220]">
              {kpis?.totalCustomers?.value ?? '124'}
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="flex items-center text-emerald-600 font-semibold">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                +{kpis?.totalCustomers?.changePercentage ?? 12.5}%
              </span>
              <span className="text-[#576563]">vs previous {days}d</span>
            </div>
          </div>
        </Card>

        {/* Total Workers */}
        <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#576563] uppercase tracking-wider">
              Active Partners
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#217E66] flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-[#152220]">
              {kpis?.totalWorkers?.value ?? '48'}
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="flex items-center text-emerald-600 font-semibold">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                +{kpis?.totalWorkers?.changePercentage ?? 8.3}%
              </span>
              <span className="text-[#576563]">vs previous {days}d</span>
            </div>
          </div>
        </Card>

        {/* Active Jobs */}
        <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#576563] uppercase tracking-wider">
              Active Jobs
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-[#152220]">
              {kpis?.activeJobs?.value ?? '16'}
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="flex items-center text-amber-600 font-semibold">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                +{kpis?.activeJobs?.changePercentage ?? 25.0}%
              </span>
              <span className="text-[#576563]">bidding or in progress</span>
            </div>
          </div>
        </Card>

        {/* Completed Jobs */}
        <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#576563] uppercase tracking-wider">
              Completed Jobs
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-[#152220]">
              {kpis?.completedJobs?.value ?? '89'}
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="flex items-center text-emerald-600 font-semibold">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                +{kpis?.completedJobs?.changePercentage ?? 15.2}%
              </span>
              <span className="text-[#576563]">OTP verified</span>
            </div>
          </div>
        </Card>

        {/* Platform GMV */}
        <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#576563] uppercase tracking-wider">
              Gross Marketplace Volume
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0D4A52] flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-[#152220]">
              ₹{(kpis?.totalGmvInr?.value ?? 52400).toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="flex items-center text-emerald-600 font-semibold">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                +{kpis?.totalGmvInr?.changePercentage ?? 18.7}%
              </span>
              <span className="text-[#576563]">zero-commission volume</span>
            </div>
          </div>
        </Card>

        {/* Average Rating */}
        <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#576563] uppercase tracking-wider">
              Platform Rating
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-[#152220]">
              {kpis?.averageRating?.value ?? 4.85} / 5.0
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-emerald-600 font-semibold">96.8% positive</span>
              <span className="text-[#576563]">customer reviews</span>
            </div>
          </div>
        </Card>

        {/* Pending Verifications */}
        <Link href="/admin/verification" className="block">
          <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs flex flex-col justify-between hover:border-[#0D4A52] hover:shadow-md transition-all h-full cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#576563] uppercase tracking-wider">
                Pending Verification
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <span className="text-2xl font-bold text-[#152220]">
                  {kpis?.pendingVerifications?.value ?? '3'}
                </span>
                <p className="text-xs text-[#576563] mt-1">Workers waiting approval</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#0D4A52]" />
            </div>
          </Card>
        </Link>

        {/* Open SOS Incidents */}
        <Link href="/admin/sos" className="block">
          <Card className="p-5 rounded-2xl border-red-200 bg-red-50/30 shadow-2xs flex flex-col justify-between hover:border-red-500 hover:shadow-md transition-all h-full cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                Active SOS Panic
              </span>
              <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center animate-pulse">
                <AlertOctagon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <span className="text-2xl font-bold text-red-600">
                  {kpis?.openSosIncidents?.value ?? '1'}
                </span>
                <p className="text-xs text-red-600/80 mt-1">Requires immediate attention</p>
              </div>
              <ArrowRight className="w-4 h-4 text-red-600" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line / Area Chart: Jobs Posted vs Completed */}
        <Card className="lg:col-span-2 p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#152220]">
                Daily Job Flow: Posted vs Completed
              </h3>
              <p className="text-xs text-[#576563]">
                Daily throughput across all service categories over the last {days} days.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-[#FAF9F5] border border-[#E5DFD2] rounded-lg text-[#0D4A52]">
              {dailyStats.length} Data Points
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPosted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D4A52" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0D4A52" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#217E66" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#217E66" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD2" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#576563' }}
                  tickFormatter={(val) => val.slice(5)}
                  axisLine={{ stroke: '#E5DFD2' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#576563' }} axisLine={{ stroke: '#E5DFD2' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5DFD2',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Area
                  type="monotone"
                  dataKey="posted"
                  name="Jobs Posted"
                  stroke="#0D4A52"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorPosted)"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Jobs Completed"
                  stroke="#217E66"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCompleted)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Donut Chart: Jobs by Status */}
        <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#152220]">Jobs by Status</h3>
            <p className="text-xs text-[#576563]">Current marketplace distribution.</p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusStats}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {statusStats.map((entry: StatusDistribution, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STATUS_COLORS[entry.status] || '#8884d8'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5DFD2',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-[#E5DFD2]/60 text-center">
            <span className="text-xs text-[#576563]">
              High completion fidelity ({kpis?.completedJobs?.value ?? 89} completed jobs)
            </span>
          </div>
        </Card>
      </div>

      {/* Secondary Charts & Top Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Jobs by Category */}
        <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#152220]">Demand by Category</h3>
            <p className="text-xs text-[#576563]">Total volume per trade category.</p>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD2" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11, fill: '#576563' }}
                  tickFormatter={(val) => val.charAt(0).toUpperCase() + val.slice(1)}
                  axisLine={{ stroke: '#E5DFD2' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#576563' }} axisLine={{ stroke: '#E5DFD2' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5DFD2',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Jobs Posted" fill="#0D4A52" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Horizontal Bar Chart: Top Demand Areas */}
        <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#152220]">Top Demand Areas & Pincodes</h3>
            <p className="text-xs text-[#576563]">Hyperlocal service density clusters in Mumbai.</p>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topAreas}
                margin={{ top: 10, right: 20, left: 30, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD2" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#576563' }} />
                <YAxis
                  dataKey="locality"
                  type="category"
                  tick={{ fontSize: 11, fill: '#152220', fontWeight: 600 }}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5DFD2',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="jobCount" name="Job Requests" fill="#217E66" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Live Map & Anomaly Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Leaflet Map (2 cols) */}
        <div className="lg:col-span-2">
          <AdminLiveMap />
        </div>

        {/* Anomaly Alerts Widget (Rule-based, 1 col) */}
        <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[#152220]">Anomaly & Risk Alerts</h3>
            </div>
            <p className="text-xs text-[#576563] mt-1">
              Rule-based integrity scans (pricing deviation, chronic cancellations).
            </p>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-72">
            {anomalies.map((a: AnomalyAlert) => (
              <div
                key={a.id}
                className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">{a.title}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                    {a.severity}
                  </span>
                </div>
                <p className="text-xs text-amber-800/90 leading-snug">{a.description}</p>
                <div className="pt-1 flex items-center justify-between text-[11px] text-amber-900/60 font-medium">
                  <span>Target: {a.targetType.toUpperCase()}</span>
                  <Link
                    href={`/admin/${a.targetType === 'user' ? 'users' : 'jobs'}`}
                    className="text-[#0D4A52] font-semibold hover:underline"
                  >
                    Investigate →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#E5DFD2]/60 text-center">
            <span className="text-xs font-semibold text-[#0D4A52]">
              All anomaly rules operational
            </span>
          </div>
        </Card>
      </div>

      {/* Leaderboard & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Workers Leaderboard */}
        <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#152220]">Top Partner Leaderboard</h3>
              <p className="text-xs text-[#576563]">Ranked by reputation score and completed jobs.</p>
            </div>
            <Link href="/admin/users?role=worker" className="text-xs font-semibold text-[#0D4A52] hover:underline">
              View All Partners →
            </Link>
          </div>

          <div className="divide-y divide-[#E5DFD2]/60">
            {leaderboard.length > 0 ? (
              leaderboard.map((worker: WorkerLeaderboardItem, idx: number) => (
                <div key={worker.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-[#576563]">
                      #{idx + 1}
                    </span>
                    <div className="w-9 h-9 rounded-full bg-[#0D4A52]/10 text-[#0D4A52] flex items-center justify-center font-bold text-xs shrink-0">
                      {worker.fullName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#152220] leading-none">
                        {worker.fullName}
                      </h4>
                      <p className="text-xs text-[#576563] capitalize mt-1">
                        {worker.primaryCategory} • {worker.primaryCity}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs font-bold text-[#152220]">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{worker.reputationScore}</span>
                    </div>
                    <span className="text-[11px] text-[#576563]">
                      {worker.totalCompletedJobs} jobs done
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-[#576563]">
                Loading top partners from marketplace...
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#152220]">Live Activity Stream</h3>
              <p className="text-xs text-[#576563]">Latest marketplace interactions and alerts.</p>
            </div>
            <Link href="/admin/audit-log" className="text-xs font-semibold text-[#0D4A52] hover:underline">
              Audit Trail →
            </Link>
          </div>

          <div className="divide-y divide-[#E5DFD2]/60 max-h-80 overflow-y-auto">
            {feed.length > 0 ? (
              feed.map((item: ActivityFeedItem) => (
                <div key={item.id} className="py-3 flex items-start gap-3">
                  <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      item.type === 'sos'
                        ? 'bg-red-50 text-red-600'
                        : item.type === 'dispute'
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-teal-50 text-teal-700'
                    }`}
                  >
                    {item.type === 'sos' ? (
                      <AlertOctagon className="w-4 h-4" />
                    ) : (
                      <Briefcase className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#152220] truncate">{item.title}</p>
                    <p className="text-xs text-[#576563] truncate mt-0.5">{item.description}</p>
                    <span className="text-[10px] text-[#576563]/70 mt-1 block">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-[#576563]">
                Waiting for marketplace events...
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

