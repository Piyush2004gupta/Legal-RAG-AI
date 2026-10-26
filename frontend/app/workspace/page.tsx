'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { casesApi } from '@/lib/api';
import { Case, CaseCreate, CASE_TYPES } from '@/lib/types';
import {
  Scale, Plus, Search, FileText, Clock, ChevronRight,
  Briefcase, X, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function WorkspacePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CaseCreate>({ title: '' });

  const { data: cases = [], isLoading } = useQuery<Case[]>({
    queryKey: ['cases'],
    queryFn: () => casesApi.list(),
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: () => casesApi.create(form),
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowCreate(false);
      setForm({ title: '' });
      toast.success('Case created successfully');
      router.push(`/case/${newCase.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = cases.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.case_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-legal-bg">
      {/* Header */}
      <header className="border-b border-navy-600 bg-navy-800/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/30">
              <Scale className="w-5 h-5 text-navy-900" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">LegalDesk AI</h1>
              <p className="text-xs text-slate-400">AI-Powered Legal Workspace</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Case
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Good morning,{' '}
            <span className="gradient-text">Counsellor</span>
          </h2>
          <p className="text-slate-400">
            {cases.length} active case{cases.length !== 1 ? 's' : ''} in your workspace
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            {
              label: 'Total Cases',
              value: cases.length,
              icon: Briefcase,
              color: 'text-gold-400',
            },
            {
              label: 'Active Cases',
              value: cases.filter((c) => c.status === 'active').length,
              icon: Scale,
              color: 'text-blue-400',
            },
            {
              label: 'Documents',
              value: cases.reduce((acc, c) => acc + (c.document_count || 0), 0),
              icon: FileText,
              color: 'text-emerald-400',
            },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm">{stat.label}</span>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input pl-10"
            placeholder="Search cases, clients, case numbers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Cases */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-5 h-24 shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state glass-card">
            <Scale className="w-16 h-16 text-navy-500 mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              {search ? 'No cases found' : 'No cases yet'}
            </h3>
            <p className="text-slate-500 mb-6 max-w-sm">
              {search
                ? 'Try a different search term'
                : 'Create your first case to start uploading documents and getting AI-powered legal analysis'}
            </p>
            {!search && (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Create First Case
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <CaseCard
                key={c.id}
                case_={c}
                onClick={() => router.push(`/case/${c.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Case Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Create New Case</h3>
              <button onClick={() => setShowCreate(false)} className="btn-ghost p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Case Title *</label>
                <input
                  className="input"
                  placeholder="e.g., State vs. Ramesh Kumar"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Case Number</label>
                  <input
                    className="input"
                    placeholder="FIR/2024/001"
                    value={form.case_number || ''}
                    onChange={(e) => setForm({ ...form, case_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Client Name</label>
                  <input
                    className="input"
                    placeholder="Client name"
                    value={form.client_name || ''}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Court</label>
                  <input
                    className="input"
                    placeholder="High Court of Delhi"
                    value={form.court || ''}
                    onChange={(e) => setForm({ ...form, court: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Case Type</label>
                  <select
                    className="input"
                    value={form.case_type || ''}
                    onChange={(e) => setForm({ ...form, case_type: e.target.value })}
                  >
                    <option value="">Select type</option>
                    {CASE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Opposite Party</label>
                <input
                  className="input"
                  placeholder="Opposite party name"
                  value={form.opposite_party || ''}
                  onChange={(e) => setForm({ ...form, opposite_party: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Filing Date</label>
                  <input
                    className="input"
                    type="date"
                    value={form.filing_date || ''}
                    onChange={(e) => setForm({ ...form, filing_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Case notes..."
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.title || createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Case
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CaseCard({ case_, onClick }: { case_: Case; onClick: () => void }) {
  const statusColors: Record<string, string> = {
    active: 'badge-green',
    closed: 'badge-gray',
    archived: 'badge-gray',
  };

  return (
    <div
      onClick={onClick}
      className="glass-card p-5 hover:border-gold-500/30 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-gold-500/5 group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-base font-semibold text-white group-hover:text-gold-300 transition-colors truncate">
              {case_.title}
            </h3>
            <span className={statusColors[case_.status] || 'badge-gray'}>
              {case_.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            {case_.case_number && <span>#{case_.case_number}</span>}
            {case_.client_name && <span>👤 {case_.client_name}</span>}
            {case_.court && <span>🏛 {case_.court}</span>}
            {case_.case_type && <span className="badge-blue">{case_.case_type}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4 ml-4 shrink-0">
          <div className="text-right">
            <div className="text-sm text-white font-medium">{case_.document_count}</div>
            <div className="text-xs text-slate-500">docs</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">
              {format(new Date(case_.created_at), 'dd MMM yyyy')}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-gold-400 transition-colors" />
        </div>
      </div>
    </div>
  );
}
