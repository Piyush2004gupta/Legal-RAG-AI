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
  { label: 'Arguments', path: '/arguments', icon: GitBranch },
  { label: 'Similar Judgments', path: '/judgments', icon: Scale },
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
    <div className="flex h-screen bg-legal-bg overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-navy-600 bg-navy-800/60 backdrop-blur-sm flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-navy-600">
          <Link
            href="/workspace"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            All Cases
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-navy-900" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">LegalDesk AI</p>
            </div>
          </div>
        </div>

        {/* Case Info */}
        <div className="p-4 border-b border-navy-600 bg-navy-700/30">
          <h2 className="text-sm font-bold text-white leading-tight mb-1 line-clamp-2">
            {case_.title}
          </h2>
          {case_.case_number && (
            <p className="text-xs text-slate-400">#{case_.case_number}</p>
          )}
          {case_.court && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{case_.court}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`badge text-xs ${
                case_.status === 'active' ? 'badge-green' : 'badge-gray'
              }`}
            >
              {case_.status}
            </span>
            {case_.case_type && (
              <span className="badge badge-blue">{case_.case_type}</span>
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
                className={isActive ? 'nav-item-active' : 'nav-item'}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-navy-600">
          <div className="disclaimer">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>AI analysis requires lawyer review</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
