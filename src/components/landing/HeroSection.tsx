'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  Camera,
  FileText,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  IndianRupee,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button';

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
  const [pincode] = useState('110001');
  const [jobText, setJobText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Voice note speech recognition state
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Photo upload state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <section className="relative overflow-hidden min-h-[calc(100vh-5rem)] flex items-center py-12 lg:py-20">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#EBF4F3] rounded-full blur-3xl -z-10 opacity-70 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Side: Headline, Description, and Trust Indicators (fills the big left area, reduced by 5%) */}
          <div className="lg:col-span-8 text-left space-y-7 xl:space-y-9">
            {/* Main Headline */}
            <h1 className="text-[2.85rem] sm:text-[3.55rem] md:text-[4.25rem] lg:text-[4.18rem] xl:text-[4.6rem] font-black text-[#152220] tracking-tight leading-[1.08]">
              Your Home. Your People.{' '}
              <span className="block text-[#0D4A52]">
                Your Peace of Mind.
              </span>
            </h1>

            {/* Value Prop Description */}
            <p className="text-[0.95rem] sm:text-[1.07rem] lg:text-[1.28rem] text-[#4A5855] leading-relaxed max-w-2xl font-normal">
              From quick fixes to routine maintenance, get fair offers and book trusted local pros with confidence.
            </p>

            {/* Trust Indicators in a Straight Line on the Left with comfortable padding and substance */}
            <div className="pt-2 flex flex-wrap items-center justify-start gap-3 sm:gap-4 text-sm sm:text-base font-semibold text-[#152220]">
              <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/70 backdrop-blur-sm border border-[#E5DFD2] shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-[#217E66] shrink-0" />
                <span>Verified Professionals</span>
              </span>
              <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/70 backdrop-blur-sm border border-[#E5DFD2] shadow-xs">
                <IndianRupee className="w-5 h-5 text-[#217E66] shrink-0" />
                <span>Fair &amp; Transparent Pricing</span>
              </span>
              <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/70 backdrop-blur-sm border border-[#E5DFD2] shadow-xs">
                <ShieldCheck className="w-5 h-5 text-[#217E66] shrink-0" />
                <span>Safety at Every Step</span>
              </span>
            </div>
          </div>

          {/* Right Side: Hero Action Button (moved ~5% above) */}
          <div className="lg:col-span-4 flex items-center justify-center lg:justify-center py-6 lg:py-0 lg:-translate-y-8 xl:-translate-y-10">
            <LiquidMetalButton
              href="/post-job"
              label="Post a Job with AI"
              width={200}
            />
          </div>
        </div>
      </div>

      {/* Bottom-Right Trigger Button - scrolls up with page rather than stuck/fixed */}
      <div className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 z-20">
        <LiquidMetalButton
          onClick={() => setIsModalOpen(true)}
          label="Describe Your Job"
          width={165}
        />
      </div>

      {/* Popup Modal in the Middle of the Screen */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-2xl bg-white rounded-2xl border border-[#E5DFD2] p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E5DFD2] pb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0D4A52]">
                  Describe the problem using text, voice note, or photo upload
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#576563] hover:text-[#152220] hover:bg-[#FAF9F5] transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
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
                  placeholder="E.g., Need an electrician to install 2 ceiling fans and repair a sparking switchboard in Andheri West, Mumbai..."
                  className="w-full p-3 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] focus:border-transparent outline-none resize-none bg-[#FAF9F5]"
                />
                <div className="flex items-center justify-between text-[11px] text-[#576563]">
                  <span>Characters: {jobText.length}</span>
                  {jobText.trim() && (
                    <button
                      type="button"
                      onClick={() => setJobText('')}
                      className="text-red-500 hover:text-red-700 font-medium"
                    >
                      Clear text
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Voice Note Recording */}
            {activeTab === 'voice' && (
              <div className="p-4 bg-[#FAF9F5] rounded-xl border border-[#E5DFD2] text-center space-y-3">
                <div
                  onClick={toggleRecording}
                  className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center cursor-pointer transition-all ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                      : 'bg-[#EDF7F4] text-[#217E66] hover:bg-[#D5EFE7]'
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

            {/* Tab 3: Photo Upload Mode */}
            {activeTab === 'photo' && (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                {!photoPreview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#BCE5DA] hover:border-[#217E66] rounded-xl p-6 text-center cursor-pointer transition-colors bg-[#FAF9F5]"
                  >
                    <Camera className="w-8 h-8 mx-auto text-[#217E66] mb-1.5" />
                    <p className="text-xs font-semibold text-[#152220]">Tap to Upload or Take Photo</p>
                    <p className="text-[11px] text-[#576563]">JPG, PNG, WebP up to 5MB</p>
                  </div>
                ) : (
                  <div className="relative rounded-xl border border-[#E5DFD2] overflow-hidden bg-black/5 p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-[#E5DFD2]"
                      />
                      <span className="text-xs font-medium text-[#152220] truncate max-w-[180px]">
                        {photoFileName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="p-1 rounded bg-white shadow hover:bg-red-50 text-red-500"
                      title="Remove photo"
                    >
                      <X className="w-3.5 h-3.5" />
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

            {/* Action Buttons: Continue to Job Creator */}
            <div className="pt-2 flex items-center justify-end border-t border-[#E5DFD2]">
              <LiquidMetalButton
                label="Continue to Job Creator"
                width={200}
                onClick={() => {
                  setIsModalOpen(false);
                  handleProceedToJobPosting();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
