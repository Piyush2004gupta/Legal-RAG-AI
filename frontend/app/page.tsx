'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to workspace
    router.replace('/workspace');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-gold-500 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Loading LegalDesk AI...</p>
      </div>
    </div>
  );
}
