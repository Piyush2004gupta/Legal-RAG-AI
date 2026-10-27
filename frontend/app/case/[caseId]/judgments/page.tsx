'use client';
import { useParams } from 'next/navigation';
import { Scale, Search, Gavel, BookOpen, ExternalLink, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function JudgmentsPage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const RESOURCES = [
    { label: 'Indian Kanoon', url: 'https://indiankanoon.org', desc: 'Free legal database for Indian judgments' },
    { label: 'SCC Online', url: 'https://www.scconline.com', desc: 'Supreme Court Cases online database' },
    { label: 'Manupatra', url: 'https://www.manupatrafast.com', desc: 'Indian legal research platform' },
    { label: 'LexisNexis India', url: 'https://www.lexisnexis.in', desc: 'Global legal research' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Scale className="w-6 h-6 text-gold-400" /> Similar Judgments
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Find similar Indian court judgments and legal precedents
        </p>
      </div>

      {/* AI-powered search via chat */}
      <div className="glass-card p-5 mb-6 border-gold-500/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center shrink-0">
            <Gavel className="w-5 h-5 text-gold-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white mb-1">AI Precedent Search</h2>
            <p className="text-slate-400 text-sm mb-3">
              Ask the AI to find similar judgments from your uploaded documents. It will identify relevant
              Supreme Court and High Court precedents mentioned in your case files.
            </p>
            <Link href={`/case/${caseId}/chat`} className="btn-primary text-sm">
              <MessageSquare className="w-4 h-4" />
              Ask AI for Similar Judgments
            </Link>
          </div>
        </div>
      </div>

      {/* Analysis Precedents */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white mb-1">From Legal Analysis</h2>
            <p className="text-slate-400 text-sm mb-3">
              Generate a Legal Analysis to automatically extract similar judgments and precedents
              cited in or relevant to your case documents.
            </p>
            <Link href={`/case/${caseId}/analysis`} className="btn-secondary text-sm">
              <Scale className="w-4 h-4" />
              View Legal Analysis
            </Link>
          </div>
        </div>
      </div>

      {/* External Resources */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
          <ExternalLink className="w-4 h-4" /> External Legal Databases
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {RESOURCES.map(r => (
            <a
              key={r.label}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card p-4 hover:border-gold-500/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium text-sm group-hover:text-gold-300 transition-colors">
                  {r.label}
                </span>
                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-gold-400" />
              </div>
              <p className="text-slate-500 text-xs">{r.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
