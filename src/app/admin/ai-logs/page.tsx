'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Mic,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/admin/ToastContext';

interface AiLogItem {
  id: string;
  jobId?: string | null;
  inputType: 'text' | 'voice' | 'image';
  rawInput: string;
  generatedScope: {
    title?: string;
    category?: string;
    suggestedBudgetInr?: number;
    durationEstimate?: string;
    materialsRequired?: string[];
    [key: string]: unknown;
  };
  feedback: 'up' | 'down' | null;
  createdAt: string;
}

export default function AiJobLogsPage() {
  const { success, error } = useToast();
  const [logs, setLogs] = useState<AiLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadLogs() {
      try {
        const res = await fetch('/api/admin/ai/logs');
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          setLogs(json.data);
        }
      } catch {
        if (!cancelled) error('Failed to load AI job logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLogs();
    return () => {
      cancelled = true;
    };
  }, [error]);

  const handleFeedback = async (logId: string, feedback: 'up' | 'down') => {
    try {
      const res = await fetch('/api/admin/ai/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, feedback }),
      });

      const json = await res.json();
      if (json.success) {
        success(`Feedback recorded: ${feedback === 'up' ? 'Helpful' : 'Needs tuning'}.`);
        setLogs((prev) =>
          prev.map((l) => (l.id === logId ? { ...l, feedback } : l))
        );
      } else {
        error('Failed to record feedback.');
      }
    } catch {
      error('Error saving feedback.');
    }
  };

  const getInputIcon = (type: string) => {
    switch (type) {
      case 'voice':
        return <Mic className="w-4 h-4 text-emerald-600" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-purple-600" />;
      default:
        return <FileText className="w-4 h-4 text-[#0D4A52]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#0D4A52]">
              <Bot className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">AI Voice & Scope Generation Logs</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Audit customer raw inputs (Hindi/Marathi voice audio transcripts, text prompts) alongside Gemini-generated job scopes.
          </p>
        </div>
      </div>

      {/* Integration Notice / Hook */}
      <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs text-[#0D4A52] flex items-start gap-3">
        <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[#217E66]" />
        <div>
          <strong className="block font-semibold">Live AI Scoping Telemetry Hook</strong>
          <span>
            Every multimodal customer query submitted on <code>/post-job</code> automatically logs into <code>ai_job_logs</code>. Admins can grade each output with thumbs up/down to continuously evaluate prompt precision.
          </span>
        </div>
      </div>

      {/* Logs Stream */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-xs text-[#576563]">Loading AI logs...</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-[#576563] space-y-2 bg-white rounded-2xl border border-[#E5DFD2]">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-[#152220]">No AI Job Logs Recorded</p>
            <p className="text-xs">Post a job using voice or text to populate this monitor.</p>
          </div>
        ) : (
          logs.map((log) => (
            <Card key={log.id} className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]/60">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#FAF9F5] border border-[#E5DFD2]">
                    {getInputIcon(log.inputType)}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#152220] uppercase tracking-wider">
                      Input Modality: {log.inputType}
                    </span>
                    <span className="text-[11px] text-[#576563] block">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Feedback Controls */}
                <div className="flex items-center gap-1.5 bg-[#FAF9F5] p-1 rounded-xl border border-[#E5DFD2]">
                  <button
                    onClick={() => handleFeedback(log.id, 'up')}
                    className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${log.feedback === 'up'
                        ? 'bg-emerald-600 text-white'
                        : 'text-[#576563] hover:text-emerald-700 hover:bg-emerald-50'
                      }`}
                    title="Good AI Output"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Accurate</span>
                  </button>

                  <button
                    onClick={() => handleFeedback(log.id, 'down')}
                    className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${log.feedback === 'down'
                        ? 'bg-rose-600 text-white'
                        : 'text-[#576563] hover:text-rose-700 hover:bg-rose-50'
                      }`}
                    title="Bad AI Output"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Inaccurate</span>
                  </button>
                </div>
              </div>

              {/* Input vs Output Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Raw User Input */}
                <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2] space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#576563]">
                    Raw Customer Input (Voice Transcript / Text)
                  </span>
                  <p className="text-[#152220] font-medium leading-relaxed italic">
                    &ldquo;{log.rawInput}&rdquo;
                  </p>
                </div>

                {/* AI Generated Structured Scope */}
                <div className="p-4 rounded-xl bg-white border border-[#E5DFD2] space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D4A52]">
                    Gemini Parsed Scope
                  </span>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-[#152220]">
                      {log.generatedScope.title || 'Untitled Request'}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                      {log.generatedScope.category && (
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#0D4A52] border border-teal-200 capitalize font-medium">
                          {log.generatedScope.category}
                        </span>
                      )}
                      {log.generatedScope.suggestedBudgetInr && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                          Est: ₹{log.generatedScope.suggestedBudgetInr}
                        </span>
                      )}
                      {log.generatedScope.durationEstimate && (
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          <span>{log.generatedScope.durationEstimate}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
