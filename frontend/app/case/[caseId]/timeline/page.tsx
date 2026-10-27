'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timelineApi } from '@/lib/api';
import { Clock, Zap, Loader2, Plus, Trash2, Check, X, Calendar, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const EVENT_TYPES = ['hearing', 'filing', 'order', 'incident', 'arrest', 'bail', 'judgment', 'notice', 'other'];

const EVENT_COLORS: Record<string, string> = {
  hearing:  'border-blue-500/60 bg-blue-500/10',
  filing:   'border-purple-500/60 bg-purple-500/10',
  order:    'border-gold-500/60 bg-gold-500/10',
  incident: 'border-red-500/60 bg-red-500/10',
  arrest:   'border-red-600/60 bg-red-600/10',
  bail:     'border-emerald-500/60 bg-emerald-500/10',
  judgment: 'border-gold-400/60 bg-gold-400/10',
  notice:   'border-amber-500/60 bg-amber-500/10',
  other:    'border-slate-500/60 bg-slate-500/10',
};

export default function TimelinePage() {
  const params = useParams();
  const caseId = params.caseId as string;
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ event_date: '', title: '', description: '', event_type: 'other' });

  const { data: events = [], isLoading } = useQuery<any[]>({
    queryKey: ['timeline', caseId],
    queryFn: () => timelineApi.list(caseId),
  });

  const extractMutation = useMutation({
    mutationFn: () => timelineApi.extract(caseId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['timeline', caseId] });
      toast.success(`Timeline extracted: ${Array.isArray(data) ? data.length : '?'} events`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: () => timelineApi.add(caseId, { ...form, case_id: caseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline', caseId] });
      setForm({ event_date: '', title: '', description: '', event_type: 'other' });
      setShowAdd(false);
      toast.success('Event added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => timelineApi.delete(caseId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline', caseId] });
      toast.success('Event removed');
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Case Timeline</h1>
          <p className="text-slate-400 text-sm mt-1">Chronological events extracted from documents</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAdd(true)} className="btn-secondary">
            <Plus className="w-4 h-4" /> Add Event
          </button>
          <button
            onClick={() => extractMutation.mutate()}
            disabled={extractMutation.isPending}
            className="btn-primary"
          >
            {extractMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting…</>
              : <><Zap className="w-4 h-4" /> AI Extract</>}
          </button>
        </div>
      </div>

      {/* Add Event Form */}
      {showAdd && (
        <div className="glass-card p-5 mb-6 animate-fade-in">
          <h3 className="text-base font-semibold text-white mb-4">Add Timeline Event</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})} />
            </div>
            <div>
              <label className="label">Event Type</label>
              <select className="input" value={form.event_type} onChange={e => setForm({...form, event_type: e.target.value})}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="label">Title *</label>
            <input className="input" placeholder="Event title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>
          <div className="mb-4">
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="Details…" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowAdd(false)} className="btn-secondary"><X className="w-4 h-4" />Cancel</button>
            <button onClick={() => addMutation.mutate()} disabled={!form.title || !form.event_date || addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="glass-card h-24 shimmer" />)}</div>
      ) : events.length === 0 ? (
        <div className="empty-state glass-card">
          <Clock className="w-16 h-16 text-navy-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No timeline events yet</h3>
          <p className="text-slate-500 text-sm max-w-sm mb-4">
            Click <strong className="text-gold-400">AI Extract</strong> to automatically pull dates and events from your documents, or add them manually.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7.5rem] top-0 bottom-0 w-px bg-navy-600" />
          <div className="space-y-4">
            {events.map((event, i) => (
              <div key={event.id} className="flex gap-4 group">
                {/* Date */}
                <div className="w-28 shrink-0 text-right pt-3">
                  <div className="text-xs font-medium text-slate-400">{event.event_date || '—'}</div>
                </div>
                {/* Dot */}
                <div className="relative flex items-start pt-3.5 shrink-0">
                  <div className={`w-3 h-3 rounded-full border-2 border-gold-500 bg-navy-800 z-10`} />
                </div>
                {/* Card */}
                <div className={`flex-1 glass-card p-4 border-l-2 ${EVENT_COLORS[event.event_type] || EVENT_COLORS.other} mb-0`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm">{event.title}</span>
                        <span className="badge-blue text-xs">{event.event_type}</span>
                        {event.is_verified && <span className="badge-green text-xs">Verified</span>}
                      </div>
                      {event.description && (
                        <p className="text-slate-400 text-sm">{event.description}</p>
                      )}
                      {event.citation_text && (
                        <p className="text-slate-500 text-xs mt-1 italic">{event.citation_text}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(event.id)}
                      className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
