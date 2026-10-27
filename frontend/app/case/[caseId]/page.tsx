'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { casesApi, documentsApi, analysisApi } from '@/lib/api';
import { Case, Document } from '@/lib/types';
import {
  FileText, MessageSquare, Clock, Scale, User, Building,
  Calendar, Hash, Loader2, AlertTriangle, TrendingUp, CheckCircle,
  XCircle, BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

export default function CaseOverviewPage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const { data: case_ } = useQuery<Case>({
    queryKey: ['case', caseId],
    queryFn: () => casesApi.get(caseId),
  });

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ['documents', caseId],
    queryFn: () => documentsApi.list(caseId),
    refetchInterval: 5000,
  });

  const { data: analyses = [] } = useQuery<any[]>({
    queryKey: ['analyses', caseId],
    queryFn: () => analysisApi.list(caseId),
  });

  const completedDocs = documents.filter((d) => d.processing_status === 'completed');
  const processingDocs = documents.filter((d) =>
    ['pending', 'processing'].includes(d.processing_status)
  );
  const failedDocs = documents.filter((d) => d.processing_status === 'failed');

  const summaryAnalysis = analyses.find((a) => a.analysis_type === 'summary');
  const summary = summaryAnalysis?.content;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Case Header */}
      <div className="mb-6 bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">{case_?.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-[#64748B]">
          {case_?.client_name && (
            <span className="flex items-center gap-1.5 font-medium">
              <User className="w-4 h-4 text-[#0284C7]" /> {case_.client_name}
            </span>
          )}
          {case_?.court && (
            <span className="flex items-center gap-1.5 font-medium">
              <Building className="w-4 h-4 text-[#0284C7]" /> {case_.court}
            </span>
          )}
          {case_?.case_number && (
            <span className="flex items-center gap-1.5 font-medium">
              <Hash className="w-4 h-4 text-[#0284C7]" /> {case_.case_number}
            </span>
          )}
          {case_?.filing_date && (
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-[#0284C7]" />
              {format(new Date(case_.filing_date), 'dd MMM yyyy')}
            </span>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Total Documents',
            value: documents.length,
            icon: FileText,
            color: 'text-[#0284C7]',
            bg: 'bg-[#E0F2FE]',
          },
          {
            label: 'Processed',
            value: completedDocs.length,
            icon: CheckCircle,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            label: 'Processing',
            value: processingDocs.length,
            icon: Loader2,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            label: 'AI Analyses',
            value: analyses.length,
            icon: TrendingUp,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4 hover:border-[#CBD5E1] transition-all">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color} ${stat.label === 'Processing' && processingDocs.length > 0 ? 'animate-spin' : ''}`} />
            </div>
            <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{stat.value}</div>
            <div className="text-xs text-[#64748B] font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-2 space-y-6">
          {/* Case Summary */}
          {summary ? (
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E2E8F0]">
                <BookOpen className="w-5 h-5 text-[#0284C7]" />
                <h2 className="text-base font-bold text-[#0F172A]">AI Case Summary</h2>
                <span className="badge-blue ml-auto text-xs">AI Generated</span>
              </div>
              {summary.raw ? (
                <p className="text-[#334155] text-sm leading-relaxed whitespace-pre-wrap">
                  {summary.raw}
                </p>
              ) : (
                <div className="space-y-3">
                  {summary['Case Background'] && (
                    <Section title="Background" content={summary['Case Background']} />
                  )}
                  {summary['Main Dispute'] && (
                    <Section title="Main Dispute" content={summary['Main Dispute']} />
                  )}
                  {summary['Current Status'] && (
                    <Section title="Current Status" content={summary['Current Status']} />
                  )}
                </div>
              )}
              <div className="mt-4 disclaimer">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{summary.disclaimer}</span>
              </div>
            </div>
          ) : (
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E2E8F0]">
                <BookOpen className="w-5 h-5 text-[#0284C7]" />
                <h2 className="text-base font-bold text-[#0F172A]">Case Summary</h2>
              </div>
              {completedDocs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-[#94A3B8] mx-auto mb-3 opacity-50" />
                  <p className="text-[#64748B] text-sm mb-4">
                    Upload documents to generate an AI case summary
                  </p>
                  <Link href={`/case/${caseId}/documents`} className="btn-secondary text-sm">
                    Upload Documents
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-[#64748B] text-sm mb-4">
                    {completedDocs.length} documents processed. Generate AI analysis?
                  </p>
                  <Link href={`/case/${caseId}/analysis`} className="btn-primary text-sm">
                    Generate Analysis
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Recent Documents */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F0]">
              <h2 className="text-base font-bold text-[#0F172A]">Documents</h2>
              <Link href={`/case/${caseId}/documents`} className="text-xs font-semibold text-[#0284C7] hover:underline">
                View all →
              </Link>
            </div>
            {documents.length === 0 ? (
              <p className="text-[#94A3B8] text-sm text-center py-4">No documents uploaded</p>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {documents.slice(0, 5).map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Case Details */}
          <div className="glass-card p-6">
            <h2 className="text-base font-bold text-[#0F172A] mb-4 pb-3 border-b border-[#E2E8F0]">Case Details</h2>
            <dl className="space-y-3">
              {[
                { label: 'Opposite Party', value: case_?.opposite_party },
                { label: 'Case Type', value: case_?.case_type },
                { label: 'Status', value: case_?.status },
                { label: 'Filing Date', value: case_?.filing_date ? format(new Date(case_.filing_date), 'dd MMM yyyy') : undefined },
              ].map(
                (item) =>
                  item.value && (
                    <div key={item.label}>
                      <dt className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-0.5">{item.label}</dt>
                      <dd className="text-sm font-semibold text-[#0F172A] capitalize">{item.value}</dd>
                    </div>
                  )
              )}
              {case_?.notes && (
                <div>
                  <dt className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-0.5">Notes</dt>
                  <dd className="text-sm text-[#334155] leading-relaxed">{case_.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-6">
            <h2 className="text-base font-bold text-[#0F172A] mb-4 pb-3 border-b border-[#E2E8F0]">Quick Actions</h2>
            <div className="space-y-2">
              <Link href={`/case/${caseId}/documents`} className="btn-secondary w-full justify-start text-sm">
                <FileText className="w-4 h-4 text-[#0284C7]" /> Upload Documents
              </Link>
              <Link href={`/case/${caseId}/chat`} className="btn-secondary w-full justify-start text-sm">
                <MessageSquare className="w-4 h-4 text-[#0284C7]" /> Ask AI
              </Link>
              <Link href={`/case/${caseId}/drafts`} className="btn-secondary w-full justify-start text-sm">
                <Scale className="w-4 h-4 text-[#0284C7]" /> Generate Draft
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, content }: { title: string; content: any }) {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return (
    <div>
      <h4 className="text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">{title}</h4>
      <p className="text-[#334155] text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function DocumentRow({ doc }: { doc: Document }) {
  const statusIcon: Record<string, React.ReactNode> = {
    completed: <CheckCircle className="w-4 h-4 text-emerald-600" />,
    processing: <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />,
    pending: <Clock className="w-4 h-4 text-slate-400" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="shrink-0">{statusIcon[doc.processing_status]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A] truncate">{doc.original_filename}</p>
        {doc.document_type && (
          <p className="text-xs text-[#64748B]">{doc.document_type}</p>
        )}
      </div>
      {doc.page_count && (
        <span className="text-xs text-[#64748B] shrink-0 font-medium">{doc.page_count} pages</span>
      )}
    </div>
  );
}
