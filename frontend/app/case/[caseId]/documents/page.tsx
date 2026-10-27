'use client';
import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api';
import { Document } from '@/lib/types';
import { useDropzone } from 'react-dropzone';
import {
  FileText, Upload, Trash2, RefreshCw, CheckCircle2,
  XCircle, Loader2, Clock, Eye, Download, AlertCircle, File,
  ArrowRight, MessageSquare, Scale, Calendar, Zap, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Link from 'next/link';

const DOC_TYPES = [
  'FIR', 'ChargeSheet', 'Judgment', 'Petition', 'Evidence',
  'Contract', 'CourtOrder', 'BailApplication', 'LegalNotice', 'Other'
];

function StatusBadge({ status, progress }: { status: string; progress?: string }) {
  if (status === 'processing') {
    return (
      <span className="badge-yellow flex items-center gap-1.5 font-medium">
        <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
        <span>{progress || 'Indexing 5000+ Pages...'}</span>
      </span>
    );
  }
  const cfg: Record<string, { cls: string; icon: any; label: string }> = {
    completed: { cls: 'badge-green', icon: CheckCircle2, label: 'Indexed & Ready' },
    pending: { cls: 'badge-yellow', icon: Clock, label: 'Queued' },
    failed: { cls: 'badge-red', icon: XCircle, label: 'Failed' },
  };
  const c = cfg[status] || { cls: 'badge-gray', icon: File, label: status };
  const Icon = c.icon;
  return (
    <span className={c.cls}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

export default function DocumentsPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState('');
  const [uploading, setUploading] = useState<string[]>([]);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ['documents', caseId],
    queryFn: () => documentsApi.list(caseId),
    refetchInterval: 3000,
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentsApi.delete(caseId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      toast.success('Document deleted');
    },
    onError: () => toast.error('Failed to delete document'),
  });

  const reprocessMutation = useMutation({
    mutationFn: (docId: string) => documentsApi.reprocess(caseId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', caseId] });
      toast.success('Reprocessing started');
    },
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      setUploading(prev => [...prev, file.name]);
      try {
        await documentsApi.upload(caseId, file, docType || undefined);
        queryClient.invalidateQueries({ queryKey: ['documents', caseId] });
        queryClient.invalidateQueries({ queryKey: ['case', caseId] });
        toast.success(`${file.name} uploaded — AI background indexing started`);
      } catch (e: any) {
        toast.error(`Failed to upload ${file.name}: ${e.message}`);
      } finally {
        setUploading(prev => prev.filter(n => n !== file.name));
      }
    }
  }, [caseId, docType, queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 500 * 1024 * 1024, // 500 MB max for 5000+ page trial bundles
  });

  const isUploading = uploading.length > 0;

  const completed = documents.filter(d => d.processing_status === 'completed').length;
  const processing = documents.filter(d => ['pending', 'processing'].includes(d.processing_status)).length;
  const failed = documents.filter(d => d.processing_status === 'failed').length;
  const totalPages = documents.reduce((sum, d: any) => sum + (d.page_count || d.total_pages || 0), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Documents & Evidence</h1>
          <p className="text-[#64748B] text-sm mt-1">
            Handles large files (5000+ pages, trial bundles, FIR, chargesheets). AI streams page-by-page.
          </p>
        </div>
        <div className="flex gap-2.5 text-sm">
          <span className="badge-green">{completed} indexed ({totalPages} pages)</span>
          {processing > 0 && <span className="badge-yellow">{processing} indexing</span>}
          {failed > 0 && <span className="badge-red">{failed} failed</span>}
        </div>
      </div>

      {/* High-Capacity Notice & Proceed Next Actions Quick Bar */}
      {completed > 0 && (
        <div className="mb-6 bg-gradient-to-r from-[#0C1E36] to-[#1E3A8A] text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-[#38BDF8]" />
              <span className="font-bold text-sm tracking-wide">Documents Ready for Proceeding</span>
            </div>
            <p className="text-xs text-blue-100">
              {totalPages} pages indexed with source citations. Choose your next legal action:
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href={`/case/${caseId}/chat`}
              className="px-3.5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Ask AI
            </Link>
            <Link
              href={`/case/${caseId}/analysis`}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all"
            >
              <Scale className="w-3.5 h-3.5 text-[#38BDF8]" /> Legal Analysis
            </Link>
            <Link
              href={`/case/${caseId}/timeline`}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-[#38BDF8]" /> Timeline
            </Link>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-0">Document Type (optional)</label>
          <select
            className="input w-48 text-sm"
            value={docType}
            onChange={e => setDocType(e.target.value)}
          >
            <option value="">Auto-detect</option>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div
          {...getRootProps()}
          className={`drop-zone text-center ${isDragActive ? 'border-[#0284C7] bg-[#F0F9FF]' : 'border-[#CBD5E1] bg-white'} ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-[#0284C7] animate-spin" />
              <p className="text-[#0F172A] font-semibold">Uploading {uploading.join(', ')}…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-[#0284C7]" />
              <div>
                <p className="text-[#0F172A] font-bold text-base">
                  {isDragActive ? 'Drop files here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-[#64748B] text-xs mt-1">
                  PDF, DOCX, JPG, PNG · Supports massive 5000+ page files (up to 500 MB)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="glass-card h-20 shimmer" />)}
        </div>
      ) : documents.length === 0 ? (
        <div className="empty-state glass-card p-12">
          <FileText className="w-16 h-16 text-[#94A3B8] mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-[#0F172A] mb-2">No documents yet</h3>
          <p className="text-[#64748B] text-sm max-w-sm">
            Upload FIRs, charge sheets, judgments, petitions or multi-thousand page trial records to start AI-powered analysis
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc: any) => (
            <div key={doc.id} className="glass-card p-4 flex items-center gap-4 hover:border-[#CBD5E1] hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <span className="text-[#0F172A] font-bold text-[14px] truncate max-w-md">
                    {doc.original_filename}
                  </span>
                  <StatusBadge status={doc.processing_status} progress={doc.processing_progress} />
                  {doc.document_type && (
                    <span className="badge-blue text-xs">{doc.document_type}</span>
                  )}
                </div>
                <div className="flex gap-4 text-xs text-[#64748B]">
                  <span>{(doc.file_size / (1024 * 1024) > 1 ? (doc.file_size / (1024 * 1024)).toFixed(1) + ' MB' : (doc.file_size / 1024).toFixed(1) + ' KB')}</span>
                  {(doc.page_count || doc.total_pages) ? (
                    <span className="font-semibold text-[#0C1E36]">
                      {doc.page_count || doc.total_pages} pages
                    </span>
                  ) : null}
                  {doc.chunk_count ? <span>{doc.chunk_count} RAG chunks</span> : null}
                  <span>{format(new Date(doc.created_at), 'dd MMM yyyy, HH:mm')}</span>
                  {doc.processing_error && (
                    <span className="text-red-500 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {doc.processing_error.slice(0, 60)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/backend/cases/${caseId}/documents/${doc.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost p-2 text-xs"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                {doc.processing_status === 'failed' && (
                  <button
                    onClick={() => reprocessMutation.mutate(doc.id)}
                    className="btn-ghost p-2 text-xs"
                    title="Retry processing"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Delete "${doc.original_filename}"?`)) deleteMutation.mutate(doc.id);
                  }}
                  className="btn-ghost p-2 text-red-500 hover:text-red-700"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
