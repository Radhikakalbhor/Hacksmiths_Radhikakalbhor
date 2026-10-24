import { HeroSection } from '@/components/landing/HeroSection';
import { ServicesGrid } from '@/components/landing/ServicesGrid';
import { BenchmarkPreview } from '@/components/landing/BenchmarkPreview';
import { SafetyFlow } from '@/components/landing/SafetyFlow';
import { WorkerReputationPreview } from '@/components/landing/WorkerReputationPreview';
import { CallToActionBanner } from '@/components/landing/CallToActionBanner';

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* 1. Hero Section with AI Multimodal Posting Preview */}
      <HeroSection />

      {/* 2. Hyperlocal Service Categories */}
      <ServicesGrid />

      {/* 3. Transparent Local Price Benchmarks vs Unorganized Aggregators */}
      <BenchmarkPreview />

      {/* 4. Two-Stage OTP & Emergency SOS Trust Architecture */}
      <SafetyFlow />

      {/* 5. Worker Reputation Passport & Verified KYC Credentials */}
      <WorkerReputationPreview />

      {/* 6. Community Call to Action */}
      <CallToActionBanner />
    </main>
  );
}
