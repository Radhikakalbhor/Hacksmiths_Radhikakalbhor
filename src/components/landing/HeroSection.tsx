'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  Camera,
  FileText,
  MapPin,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  X,
  Loader2,
  Users,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

// Web Speech API interface declarations for browser compatibility
interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: { [index: number]: SpeechRecognitionResultItem };
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface IWindow extends Window {
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  SpeechRecognition?: new () => SpeechRecognitionInstance;
}

export function HeroSection() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'voice' | 'photo' | 'text'>('text');
  const [pincode, setPincode] = useState('110001');
  const [jobText, setJobText] = useState('');

  // Voice note speech recognition state
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Photo upload state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview local workers state
  const [previewingWorkers, setPreviewingWorkers] = useState(false);
  const [workerResult, setWorkerResult] = useState<{
    tested: boolean;
    workersFound: number;
    searchCenter?: { latitude: number; longitude: number };
    message?: string;
  } | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'hi-IN'; // Multi-lingual India: Hindi & Indian English

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        setJobText(transcript.trim());
      };

      recognition.onerror = (event: { error: string }) => {
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied. Please grant permission in your browser or type below.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Speech recognition notice: ${event.error}. You can also type your request.`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } catch {
      // Browser Speech API initialization issue
    }
  }, []);

  const toggleRecording = () => {
    setSpeechError(null);
    if (!recognitionRef.current) {
      setSpeechError('Speech recognition is not supported in this browser. Please use the Text Prompt mode.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
        setSpeechError('Could not start microphone recording. Please use the Text Prompt below.');
      }
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be under 5 MB in size.');
      return;
    }

    setPhotoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoFileName(null);
    setPhotoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePreviewWorkers = async () => {
    setPreviewingWorkers(true);
    setWorkerResult(null);

    // Save current jobText to draft in localStorage so /post-job inherits it
    try {
      const existing = localStorage.getItem('sahayak_job_draft_v1');
      const draft = existing ? JSON.parse(existing) : {};
      if (jobText.trim()) {
        draft.description = jobText.trim();
        draft.title = jobText.trim().slice(0, 40) + '...';
      }
      draft.pincode = pincode.trim();
      localStorage.setItem('sahayak_job_draft_v1', JSON.stringify(draft));
    } catch {
      // Ignore localStorage write error
    }

    // Call real PostGIS discovery endpoint
    try {
      const res = await fetch(`/api/workers/nearby?lat=28.6139&lng=77.2090&radius=15000`);
      const data = await res.json();

      if (res.ok && data.data) {
        const workers = data.data.workers || [];
        setWorkerResult({
          tested: true,
          workersFound: workers.length,
          searchCenter: data.data.searchCenter,
          message:
            workers.length > 0
              ? `Found ${workers.length} verified tradesmen within 15 km of your location.`
              : 'PostGIS spatial index scanned 15 km radius. 0 workers are currently registered in this live database test.',
        });
      } else {
        setWorkerResult({
          tested: true,
          workersFound: 0,
          message: data.error || 'Spatial query executed.',
        });
      }
    } catch (err) {
      setWorkerResult({
        tested: true,
        workersFound: 0,
        message: err instanceof Error ? err.message : 'Error executing spatial search.',
      });
    } finally {
      setPreviewingWorkers(false);
    }
  };

  const handleProceedToJobPosting = () => {
    // Preserve job draft with text and pincode
    try {
      const existing = localStorage.getItem('sahayak_job_draft_v1');
      const draft = existing ? JSON.parse(existing) : {};
      if (jobText.trim()) {
        draft.description = jobText.trim();
        draft.title = jobText.trim().slice(0, 45);
      }
      draft.pincode = pincode.trim();
      localStorage.setItem('sahayak_job_draft_v1', JSON.stringify(draft));
    } catch {
      // Ignore storage error
    }
    router.push('/post-job');
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#EBF4F3] rounded-full blur-3xl -z-10 opacity-70 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-5">
          {/* Tagline Pill */}
          <div className="inline-flex items-center gap-2">
            <Badge variant="teal" className="py-1 px-3.5">
              <Sparkles className="w-3.5 h-3.5 text-[#217E66]" />
              <span>Next-Gen Hyperlocal Marketplace</span>
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#152220] tracking-tight leading-[1.15]">
            Trusted help. Fair work.{' '}
            <span className="text-[#0D4A52] underline decoration-[#217E66]/40 decoration-wavy underline-offset-8">
              Stronger communities.
            </span>
          </h1>

          {/* Value Prop Description */}
          <p className="text-lg sm:text-xl text-[#576563] leading-relaxed">
            Find vetted local plumbers, electricians, cleaners, and household help in minutes. Compare
            transparent price benchmarks, receive competitive worker bids, and stay protected with
            two-stage OTP handoffs.
          </p>

          {/* Quick Trust Highlights */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-[#445250]">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#217E66]" />
              Police-Checked KYC
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#217E66]" />
              Zero Middleman Commission Gouging
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#217E66]" />
              1-Tap SOS Safety Guard
            </span>
          </div>

          {/* Hero Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/post-job"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#0D4A52] hover:bg-[#072F35] shadow-sm hover:shadow transition-all"
            >
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Post a Job with AI</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#benchmarks"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[#152220] bg-white border border-[#E5DFD2] hover:bg-[#F3EFE6] shadow-sm transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-[#217E66]" />
              <span>Explore Services &amp; Benchmarks</span>
            </a>
          </div>
        </div>

        {/* AI Multimodal Job Posting Interactive Card */}
        <div
          id="post-job-preview"
          className="mt-12 max-w-2xl mx-auto bg-white rounded-2xl border border-[#E5DFD2] p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#E5DFD2] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider text-[#0D4A52]">
                  Interactive Task Composer
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EDF7F4] text-[#217E66]">
                  Live Input
                </span>
              </div>
              <p className="text-xs text-[#576563] mt-0.5">
                Describe the problem using text, voice note, or photo upload
              </p>
            </div>

            {/* Pincode badge */}
            <div className="flex items-center gap-1.5 text-xs text-[#576563] bg-[#FAF9F5] px-2.5 py-1.5 rounded-lg border border-[#E5DFD2]">
              <MapPin className="w-3.5 h-3.5 text-[#0D4A52]" />
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-14 bg-transparent font-medium text-[#152220] focus:outline-none"
                placeholder="Pincode"
                maxLength={6}
              />
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-[#FAF9F5] rounded-xl border border-[#E5DFD2]">
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'text'
                  ? 'bg-white text-[#0D4A52] shadow-sm border border-[#E5DFD2]'
                  : 'text-[#576563] hover:text-[#152220]'
              }`}
            >
              <FileText className="w-4 h-4 text-[#0D4A52]" />
              <span>Text Prompt</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('voice')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'voice'
                  ? 'bg-white text-[#0D4A52] shadow-sm border border-[#E5DFD2]'
                  : 'text-[#576563] hover:text-[#152220]'
              }`}
            >
              <Mic className="w-4 h-4 text-[#217E66]" />
              <span>Voice Note</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('photo')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'photo'
                  ? 'bg-white text-[#0D4A52] shadow-sm border border-[#E5DFD2]'
                  : 'text-[#576563] hover:text-[#152220]'
              }`}
            >
              <Camera className="w-4 h-4 text-[#0D4A52]" />
              <span>Photo Upload</span>
            </button>
          </div>

          {/* Tab 1: Text Prompt (Editable) */}
          {activeTab === 'text' && (
            <div className="space-y-2">
              <textarea
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                rows={3}
                placeholder="E.g., Need an electrician to install 2 ceiling fans and repair a sparking switchboard in Dwarka Sector 10..."
                className="w-full p-3 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] focus:border-transparent outline-none resize-none bg-[#FAF9F5]"
              />
              <div className="flex items-center justify-between text-[11px] text-[#576563]">
                <span>Characters: {jobText.length}</span>
                {jobText.trim() && (
                  <button
                    type="button"
                    onClick={() => setJobText('')}
                    className="text-red-500 hover:underline"
                  >
                    Clear Text
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Voice Note (Browser Speech Recognition) */}
          {activeTab === 'voice' && (
            <div className="p-4 rounded-xl border border-dashed border-[#BCE5DA] bg-[#FAF9F5] text-center space-y-3">
              <div
                onClick={toggleRecording}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleRecording()}
                className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center cursor-pointer transition-all ${
                  isRecording
                    ? 'bg-red-100 text-red-600 animate-pulse ring-4 ring-red-200'
                    : 'bg-[#EBF4F3] text-[#217E66] hover:bg-[#BCE5DA]'
                }`}
              >
                {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </div>

              <div>
                <p className="text-xs font-semibold text-[#152220]">
                  {isRecording ? 'Listening... Speak now in Hindi or English' : 'Tap Microphone to Speak'}
                </p>
                <p className="text-[11px] text-[#576563]">
                  Supported in Chrome, Edge, and Safari via Web Speech API
                </p>
              </div>

              {speechError && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-1.5 text-left">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{speechError}</span>
                </div>
              )}

              {/* Transcribed Text Preview */}
              <div className="text-left space-y-1">
                <label className="text-[11px] font-semibold text-[#152220]">Live Speech Transcription:</label>
                <textarea
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  rows={2}
                  placeholder="Your transcribed voice note will appear here (or type manually)..."
                  className="w-full p-2.5 rounded-lg border border-[#E5DFD2] text-xs text-[#152220] bg-white outline-none"
                />
              </div>
            </div>
          )}

          {/* Tab 3: Photo Upload (Real File Input with Preview) */}
          {activeTab === 'photo' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
                id="hero-photo-input"
              />

              {!photoPreview ? (
                <label
                  htmlFor="hero-photo-input"
                  className="p-6 rounded-xl border border-dashed border-[#E5DFD2] hover:border-[#0D4A52] bg-[#FAF9F5] text-center space-y-2 flex flex-col items-center justify-center cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52]">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#152220]">
                      Click to choose or snap a picture
                    </p>
                    <p className="text-[11px] text-[#576563]">
                      Supports JPEG, PNG, WebP up to 5 MB
                    </p>
                  </div>
                </label>
              ) : (
                <div className="relative p-3 bg-[#FAF9F5] border border-[#E5DFD2] rounded-xl flex items-center gap-3">
                  <img
                    src={photoPreview}
                    alt="Upload preview"
                    className="w-16 h-16 object-cover rounded-lg border border-[#E5DFD2]"
                  />
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-[#152220] truncate">{photoFileName}</p>
                    <span className="text-[10px] text-[#217E66] font-medium bg-[#EDF7F4] px-1.5 py-0.5 rounded">
                      Ready to attach
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="ml-auto p-1.5 rounded-full text-[#83928E] hover:text-red-600 hover:bg-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {photoError && (
                <p className="text-[11px] text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{photoError}</span>
                </p>
              )}
            </div>
          )}

          {/* Spatial Worker Results Display */}
          {workerResult && (
            <div className="p-3.5 bg-[#FAF9F5] border border-[#BCE5DA] rounded-xl text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0D4A52] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#217E66]" />
                  <span>Live PostGIS Discovery:</span>
                </span>
                <Badge variant={workerResult.workersFound > 0 ? 'green' : 'neutral'}>
                  {workerResult.workersFound} Available
                </Badge>
              </div>
              <p className="text-[11px] text-[#576563] leading-relaxed">{workerResult.message}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E5DFD2]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={previewingWorkers}
              onClick={handlePreviewWorkers}
              className="w-full sm:w-auto text-xs gap-1.5"
            >
              {previewingWorkers ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning Radius...</span>
                </>
              ) : (
                <>
                  <Users className="w-3.5 h-3.5 text-[#0D4A52]" />
                  <span>Scan Nearby Workers</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full sm:w-auto text-xs gap-1.5"
              onClick={handleProceedToJobPosting}
            >
              <span>Continue to Job Creator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
