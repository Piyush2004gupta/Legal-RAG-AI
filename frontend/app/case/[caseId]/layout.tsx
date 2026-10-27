'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { casesApi } from '@/lib/api';
import { Case } from '@/lib/types';
import {
  Scale, ArrowLeft, FileText, MessageSquare, BarChart2,
  GitBranch, BookOpen, PenTool, Clock, ChevronDown, Loader2,
  Home, AlertTriangle
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview', path: '', icon: BarChart2 },
  { label: 'Documents', path: '/documents', icon: FileText },
  { label: 'Ask AI', path: '/chat', icon: MessageSquare },
  { label: 'Timeline', path: '/timeline', icon: Clock },
  { label: 'Legal Analysis', path: '/analysis', icon: BookOpen },
  { label: 'Drafts', path: '/drafts', icon: PenTool },
];

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const caseId = params.caseId as string;

  const { data: case_, isLoading, error } = useQuery<Case>({
    queryKey: ['case', caseId],
    queryFn: () => casesApi.get(caseId),
    refetchInterval: 15000,
  });

  const basePath = `/case/${caseId}`;

  const currentPath = pathname.replace(basePath, '') || '';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
      </div>
    );
  }

  if (error || !case_) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center glass-card p-8 max-w-sm">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Case Not Found</h2>
          <p className="text-slate-400 mb-4">
            This case doesn't exist or has been deleted.
          </p>
          <button onClick={() => router.push('/workspace')} className="btn-primary">
            <Home className="w-4 h-4" />
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F1F5F9] text-[#334155] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 min-w-[256px] border-r border-white/[0.07] bg-[#0C1E36] flex flex-col shrink-0 select-none">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.07]">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors mb-4 text-[13px] font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Workspace
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-[34px] h-[34px] bg-white rounded-lg flex items-center justify-center text-[#0C1E36] font-serif font-bold text-[18px] shadow-md shadow-black/20">
              L
            </div>
            <div>
              <p className="text-[15px] font-bold text-white tracking-tight flex items-baseline gap-1">
                LegalDesk<sup className="text-[9px] font-bold text-[#C5A880]">AI</sup>
              </p>
            </div>
          </div>
        </div>

        {/* Case Info */}
        <div className="p-4 border-b border-white/[0.07] bg-white/[0.02]">
          <h2 className="text-[13.5px] font-bold text-white leading-snug line-clamp-2 mb-1">
            {case_.title}
          </h2>
          {case_.case_number && (
            <p className="text-[11.5px] text-[#94A3B8]">#{case_.case_number}</p>
          )}
          {case_.court && (
            <p className="text-[11.5px] text-[#64748B] truncate mt-0.5">{case_.court}</p>
          )}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[10.5px] font-semibold text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded-full border border-[#BBF7D0]">
              {case_.status || 'active'}
            </span>
            {case_.case_type && (
              <span className="text-[10.5px] font-semibold text-[#0284C7] bg-[#E0F2FE] px-2 py-0.5 rounded-full border border-[#BAE6FD]">
                {case_.case_type}
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const fullPath = basePath + item.path;
            const isActive = currentPath === item.path || 
              (item.path === '' && currentPath === '');
            return (
              <Link
                key={item.path}
                href={fullPath}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-[#17345C] text-white font-semibold shadow-sm'
                    : 'text-[#94A3B8] hover:bg-[#132B4C] hover:text-[#E2E8F0]'
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#38BDF8]' : 'text-[#94A3B8]'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3.5 border-t border-white/[0.07] bg-white/[0.01]">
          <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#C5A880]" />
            <span>AI analysis requires lawyer review</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#F1F5F9]">
        {children}
      </main>
    </div>
  );
}
