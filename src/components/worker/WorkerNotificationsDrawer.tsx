'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Bell,
  X,
  CheckCheck,
  Briefcase,
  IndianRupee,
  AlertTriangle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { WorkerNotification } from '@/types/wallet';
import Link from 'next/link';

interface NotificationsDrawerProps {
  notifications: WorkerNotification[];
  unreadCount: number;
  isOpen: boolean;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function WorkerNotificationsDrawer({
  notifications,
  unreadCount,
  isOpen,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: NotificationsDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-teal-800" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
              )}
            </div>
            <h3 className="font-bold text-base text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs bg-teal-50 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {notifications.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-2 text-gray-400">
              <Bell className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-semibold text-gray-600">No notifications yet</p>
              <p className="text-xs text-gray-400">
                You will be notified when customers book your services, payments clear, or withdrawals update.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = !n.isRead;
              return (
                <div
                  key={n.id}
                  onClick={() => isUnread && onMarkRead(n.id)}
                  className={`p-4 transition cursor-pointer hover:bg-gray-50 flex items-start gap-3 ${
                    isUnread ? 'bg-teal-50/20' : 'bg-white'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {n.type === 'PAYMENT_CREDITED' ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <IndianRupee className="w-4 h-4" />
                      </div>
                    ) : n.type === 'NEW_OFFER' || n.type === 'OFFER_ACCEPTED' ? (
                      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                        <Briefcase className="w-4 h-4" />
                      </div>
                    ) : n.type === 'BOOKING_CANCELLED' ? (
                      <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4
                        className={`text-xs ${
                          isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'
                        }`}
                      >
                        {n.title}
                      </h4>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{n.message}</p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-gray-400">
                        {new Date(n.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {n.jobId && (
                        <Link
                          href={`/jobs/${n.jobId}`}
                          onClick={onClose}
                          className="text-[11px] text-teal-700 hover:underline font-semibold flex items-center gap-0.5"
                        >
                          <span>View Job</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

