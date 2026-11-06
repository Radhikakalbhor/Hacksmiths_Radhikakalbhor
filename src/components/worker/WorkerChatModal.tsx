'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  X,
  Send,
  MessageSquare,
  Phone,
  User,
  Clock,
  CheckCheck,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { ChatMessage } from '@/types/booking';

interface WorkerChatModalProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  job: any | null;
  onClose: () => void;
  onMessagesRead?: (jobId: string) => void;
}

const WORKER_QUICK_MESSAGES = [
  "I'm on my way.",
  "I'll reach in 10 minutes.",
  "I'm waiting outside.",
  "I have arrived.",
  "Please share the exact location.",
];

export function WorkerChatModal({ job, onClose, onMessagesRead }: WorkerChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isPollingRef = useRef(true);

  const jobId = job?.id;

  // 1. Fetch Messages & Mark as Read
  const fetchMessages = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/messages`);
      const json = await res.json();
      if (res.ok && json.data?.messages) {
        setMessages(json.data.messages);
        // Automatically mark customer messages as read when worker views the conversation
        if (json.data.unreadCountForWorker > 0) {
          fetch(`/api/jobs/${jobId}/messages`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markRead: true }),
          }).catch(() => {});
          if (onMessagesRead) {
            onMessagesRead(jobId);
          }
        }
      }
    } catch {
      // Ignore background polling errors
    } finally {
      setIsLoading(false);
    }
  }, [jobId, onMessagesRead]);

  // Initial load & Polling
  useEffect(() => {
    isPollingRef.current = true;
    fetchMessages();

    const interval = setInterval(() => {
      if (isPollingRef.current) {
        fetchMessages();
      }
    }, 2500);

    return () => {
      isPollingRef.current = false;
      clearInterval(interval);
    };
  }, [fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Escape key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 2. Send Message Handler
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending || !jobId) return;

    setIsSending(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const json = await res.json();
      if (res.ok && json.data?.message) {
        setMessages((prev) => [...prev, json.data.message]);
        setInputText('');
      } else {
        setErrorMsg(json.error || 'Failed to deliver message.');
      }
    } catch {
      setErrorMsg('Network error while delivering message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (!job) return null;

  const customerName = job.customerName || 'Customer';
  const customerPhone = job.customerPhone;
  const category = job.category || 'Service Request';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-w-lg w-full h-[88vh] max-h-[640px] flex flex-col justify-between overflow-hidden shadow-2xl border border-[#E5DFD2] bg-white rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-[#FAF9F5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#0D4A52] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              {customerName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[#152220] truncate">{customerName}</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider shrink-0">
                  {category}
                </span>
              </div>
              <p className="text-xs text-[#576563] flex items-center gap-1.5 mt-0.5">
                <span>{job.city || 'Neighborhood'}</span>
                {customerPhone && (
                  <>
                    <span>•</span>
                    <a
                      href={`tel:${customerPhone}`}
                      className="text-teal-700 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{customerPhone}</span>
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close Chat"
            title="Close Chat"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-full hover:bg-gray-200/60 text-gray-500 hover:text-gray-800 transition cursor-pointer active:scale-95 touch-manipulation"
          >
            <X className="w-5 h-5 pointer-events-none" />
          </button>
        </div>

        {/* Quick Suggestions Chips */}
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#217E66]" />
            Quick:
          </span>
          {WORKER_QUICK_MESSAGES.map((msg, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSending}
              onClick={() => handleSendMessage(msg)}
              className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-[#BCE5DA] text-[#0D4A52] hover:bg-[#EBF4F3] text-xs font-semibold shrink-0 transition disabled:opacity-50"
            >
              {msg}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-3 mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between shrink-0">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="font-bold text-sm ml-2">
              &times;
            </button>
          </div>
        )}

        {/* Messages Stream Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F3]/40">
          {isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-xs text-gray-500 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#0D4A52]" />
              <span>Loading conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#0D4A52] flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6 text-[#217E66]" />
              </div>
              <p className="font-bold text-gray-700 text-sm">No messages yet with {customerName}</p>
              <p className="max-w-xs mx-auto">
                Send a quick message to let the customer know your arrival time or ask for directions.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isWorkerSender = m.senderRole === 'worker';

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isWorkerSender ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-1">
                    <span className="font-bold text-gray-700">
                      {isWorkerSender ? 'You (Partner)' : customerName}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                      isWorkerSender
                        ? 'bg-[#0D4A52] text-white rounded-tr-none'
                        : 'bg-white text-gray-900 border border-[#E5DFD2] rounded-tl-none'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-gray-200 bg-white flex items-center gap-2 shrink-0">
          <input
            type="text"
            placeholder={`Message ${customerName}...`}
            value={inputText}
            disabled={isSending}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4A52] outline-none disabled:bg-gray-50"
          />
          <Button
            variant="primary"
            size="sm"
            disabled={isSending || !inputText.trim()}
            onClick={() => handleSendMessage()}
            className="px-3"
          >
            {isSending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

