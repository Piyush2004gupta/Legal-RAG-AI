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
    <div className="p-6 max-w-5xl mx-auto">
      {/* Case Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">{case_?.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
          {case_?.client_name && (
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" /> {case_.client_name}
            </span>
          )}
          {case_?.court && (
            <span className="flex items-center gap-1.5">
              <Building className="w-4 h-4" /> {case_.court}
            </span>
          )}
          {case_?.case_number && (
            <span className="flex items-center gap-1.5">
              <Hash className="w-4 h-4" /> {case_.case_number}
            </span>
          )}
          {case_?.filing_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
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
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
          },
          {
            label: 'Processed',
            value: completedDocs.length,
            icon: CheckCircle,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
          },
          {
            label: 'Processing',
            value: processingDocs.length,
            icon: Loader2,
            color: 'text-gold-400',
            bg: 'bg-gold-500/10',
          },
          {
            label: 'AI Analyses',
            value: analyses.length,
            icon: TrendingUp,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
          },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color} ${stat.label === 'Processing' && processingDocs.length > 0 ? 'animate-spin' : ''}`} />
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">{stat.value}</div>
            <div className="text-xs text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-2 space-y-6">
          {/* Case Summary */}
          {summary ? (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-gold-400" />
                <h2 className="text-base font-semibold text-white">AI Case Summary</h2>
                <span className="badge badge-gold ml-auto">AI Generated</span>
              </div>
              {summary.raw ? (
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
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
              <div className="mt-3 disclaimer">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{summary.disclaimer}</span>
              </div>
            </div>
          ) : (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-gold-400" />
                <h2 className="text-base font-semibold text-white">Case Summary</h2>
              </div>
              {completedDocs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-navy-500 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm mb-3">
                    Upload documents to generate an AI case summary
                  </p>
                  <Link href={`/case/${caseId}/documents`} className="btn-secondary text-sm">
                    Upload Documents
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm mb-3">
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
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Documents</h2>
              <Link href={`/case/${caseId}/documents`} className="text-xs text-gold-400 hover:text-gold-300">
                View all →
              </Link>
            </div>
            {documents.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No documents uploaded</p>
            ) : (
              <div className="space-y-2">
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
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-white mb-4">Case Details</h2>
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
                      <dt className="text-xs text-slate-500 mb-0.5">{item.label}</dt>
                      <dd className="text-sm text-white capitalize">{item.value}</dd>
                    </div>
                  )
              )}
              {case_?.notes && (
                <div>
                  <dt className="text-xs text-slate-500 mb-0.5">Notes</dt>
                  <dd className="text-sm text-slate-300">{case_.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-white mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link href={`/case/${caseId}/documents`} className="btn-secondary w-full justify-start text-sm">
                <FileText className="w-4 h-4" /> Upload Documents
              </Link>
              <Link href={`/case/${caseId}/chat`} className="btn-secondary w-full justify-start text-sm">
                <MessageSquare className="w-4 h-4" /> Ask AI
              </Link>
              <Link href={`/case/${caseId}/drafts`} className="btn-secondary w-full justify-start text-sm">
                <Scale className="w-4 h-4" /> Generate Draft
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
      <h4 className="text-xs font-semibold text-gold-400 uppercase tracking-wider mb-1">{title}</h4>
      <p className="text-slate-300 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function DocumentRow({ doc }: { doc: Document }) {
  const statusIcon: Record<string, React.ReactNode> = {
    completed: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
    processing: <Loader2 className="w-3.5 h-3.5 text-gold-400 animate-spin" />,
    pending: <Clock className="w-3.5 h-3.5 text-slate-400" />,
    failed: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="shrink-0">{statusIcon[doc.processing_status]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300 truncate">{doc.original_filename}</p>
        {doc.document_type && (
          <p className="text-xs text-slate-500">{doc.document_type}</p>
        )}
      </div>
      {doc.page_count && (
        <span className="text-xs text-slate-500 shrink-0">{doc.page_count}p</span>
      )}
    </div>
  );
}
