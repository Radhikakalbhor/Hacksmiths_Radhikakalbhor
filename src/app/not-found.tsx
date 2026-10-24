import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FAF9F5] px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0D4A52]/10 text-[#0D4A52] font-bold text-2xl">
          404
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#142624]">Page Not Found</h1>
          <p className="text-sm text-[#4E615D]">
            The service or page you are looking for does not exist or has been moved.
          </p>
        </div>
        <div>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#0D4A52] text-white font-medium text-sm hover:bg-[#08343A] transition-colors"
          >
            Return to Sahayak Home
          </Link>
        </div>
      </div>
    </main>
  );
}
