'use client';
import { useParams } from 'next/navigation';
import { GitBranch, Scale, Shield, AlertTriangle, Zap, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function ArgumentsPage() {
  const params = useParams();
  const caseId = params.caseId as string;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-gold-400" /> Arguments Builder
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Build and structure your legal arguments based on case analysis
        </p>
      </div>

      <div className="disclaimer mb-6">
        <Zap className="w-4 h-4 shrink-0 text-gold-400" />
        <span>
          Arguments are automatically derived from your{' '}
          <Link href={`/case/${caseId}/analysis`} className="text-gold-400 underline underline-offset-2 hover:text-gold-300">
            Legal Analysis
          </Link>
          . Generate the analysis first, then return here.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <h2 className="text-base font-bold text-emerald-400 flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4" /> Arguments For Client
          </h2>
          <p className="text-slate-500 text-sm">
            Go to{' '}
            <Link href={`/case/${caseId}/analysis`} className="text-gold-400 hover:text-gold-300">
              Legal Analysis →
            </Link>{' '}
            and generate an analysis to see strong arguments automatically extracted from your documents.
          </p>
        </div>
        <div className="glass-card p-5">
          <h2 className="text-base font-bold text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" /> Counter Arguments
          </h2>
          <p className="text-slate-500 text-sm">
            Vulnerabilities and mitigation strategies from your case documents will appear here after analysis.
          </p>
        </div>
      </div>

      <div className="glass-card p-5 mt-5">
        <h2 className="text-base font-bold text-purple-400 flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4" /> Relevant Precedents
        </h2>
        <p className="text-slate-500 text-sm">
          AI-identified similar judgments and their legal principles will be listed here.
          Use{' '}
          <Link href={`/case/${caseId}/chat`} className="text-gold-400 hover:text-gold-300">
            Ask AI →
          </Link>{' '}
          to search for specific precedents by querying your documents.
        </p>
      </div>

      <div className="mt-6 flex gap-4">
        <Link href={`/case/${caseId}/analysis`} className="btn-primary">
          <Zap className="w-4 h-4" /> Go to Legal Analysis
        </Link>
        <Link href={`/case/${caseId}/chat`} className="btn-secondary">
          <Scale className="w-4 h-4" /> Ask AI About Arguments
        </Link>
      </div>
    </div>
  );
}
