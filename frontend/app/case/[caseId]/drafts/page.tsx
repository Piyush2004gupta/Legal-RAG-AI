'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { draftsApi } from '@/lib/api';
import {
  PenTool, Plus, Trash2, Download, Loader2, X,
  FileText, Edit3, Save, AlertTriangle, FileCode, Check, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const DRAFT_TYPES = ['LegalNotice', 'Petition', 'BailApplication', 'WrittenStatement', 'Reply', 'Affidavit', 'Plaint', 'Appeal'];

export default function DraftsPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [editContent, setEditContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    draft_type: 'LegalNotice',
    title: '',
    court_name: '',
    petitioner_name: '',
    respondent_name: '',
    specific_instructions: '',
    prayer_details: '',
  });

  const { data: drafts = [], isLoading } = useQuery<any[]>({
    queryKey: ['drafts', caseId],
    queryFn: () => draftsApi.list(caseId),
  });

  const generateMutation = useMutation({
    mutationFn: () => draftsApi.generate(caseId, form),
    onSuccess: (draft) => {
      queryClient.invalidateQueries({ queryKey: ['drafts', caseId] });
      setShowCreate(false);
      setSelectedDraft(draft);
      setEditContent(cleanMarkdownBackticks(draft.content));
      toast.success('Draft generated successfully!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => draftsApi.update(caseId, selectedDraft.id, { content: editContent }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['drafts', caseId] });
      setSelectedDraft(updated);
      setEditing(false);
      toast.success('Draft changes saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => draftsApi.delete(caseId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts', caseId] });
      if (selectedDraft) setSelectedDraft(null);
      toast.success('Draft deleted');
    },
  });

  const cleanMarkdownBackticks = (text: string) => {
    if (!text) return '';
    return text
      .replace(/^```[a-zA-Z]*\n?/gm, '')
      .replace(/```$/gm, '')
      .trim();
  };

  const copyText = () => {
    if (!selectedDraft) return;
    const textToCopy = editing ? editContent : cleanMarkdownBackticks(selectedDraft.content);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Draft copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full bg-[#F8FAFC]">
      {/* Left Sidebar List */}
      <div className="w-80 bg-white border-r border-[#E2E8F0] flex flex-col shrink-0 shadow-sm">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-white">
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">Pleadings & Drafts</h1>
            <p className="text-xs text-[#64748B]">Court-ready templates</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-xs px-3 py-1.5 shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New Draft
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="space-y-2.5 p-1">{[1, 2, 3].map(i => <div key={i} className="h-16 glass-card shimmer" />)}</div>
          ) : drafts.length === 0 ? (
            <div className="p-8 text-center text-[#64748B] text-sm">
              <PenTool className="w-10 h-10 mx-auto mb-2 text-[#94A3B8] opacity-60" />
              <p className="font-semibold text-[#0F172A] mb-1">No drafts generated</p>
              <p className="text-xs text-[#94A3B8]">Click New Draft to generate legal notices, petitions, or bail applications</p>
            </div>
          ) : (
            drafts.map(d => {
              const isSelected = selectedDraft?.id === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    setSelectedDraft(d);
                    setEditContent(cleanMarkdownBackticks(d.content));
                    setEditing(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl transition-all border ${
                    isSelected
                      ? 'bg-[#F0F9FF] border-[#0284C7] shadow-sm'
                      : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className={`text-sm font-bold truncate mb-1 ${isSelected ? 'text-[#0284C7]' : 'text-[#0F172A]'}`}>
                    {d.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge-blue text-[11px] font-semibold">{d.draft_type}</span>
                    <span className="text-[11px] text-[#64748B] font-medium">{format(new Date(d.created_at), 'dd MMM yyyy')}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Drafting Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F1F5F9]">
        {!selectedDraft ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mx-auto mb-4 shadow-sm">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-1">Select or Create a Draft</h3>
              <p className="text-sm text-[#64748B] mb-4">
                Generate court-ready legal drafts formatted according to Indian high courts and district court practices.
              </p>
              <button onClick={() => setShowCreate(true)} className="btn-primary text-xs px-4 py-2 mx-auto">
                <Plus className="w-4 h-4 mr-1.5 inline" /> Create New Draft
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Document Header Bar */}
            <div className="p-4 bg-white border-b border-[#E2E8F0] flex items-center justify-between shrink-0 shadow-sm z-10">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">{selectedDraft.title}</h2>
                <div className="flex items-center gap-2 text-xs text-[#64748B] mt-0.5">
                  <span className="font-semibold text-[#0284C7]">{selectedDraft.draft_type}</span>
                  <span>•</span>
                  <span>Version {selectedDraft.version}</span>
                  {selectedDraft.court_name && (
                    <>
                      <span>•</span>
                      <span>{selectedDraft.court_name}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions & Download Options */}
              <div className="flex items-center gap-2">
                <button
                  onClick={copyText}
                  className="btn-secondary text-xs inline-flex items-center gap-1.5"
                  title="Copy text to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#64748B]" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                {editing ? (
                  <>
                    <button onClick={() => setEditing(false)} className="btn-secondary text-xs">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                    <button
                      onClick={() => updateMutation.mutate()}
                      disabled={updateMutation.isPending}
                      className="btn-primary text-xs inline-flex items-center gap-1.5"
                    >
                      {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditing(true)}
                      className="btn-secondary text-xs inline-flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#64748B]" /> Edit
                    </button>

                    {/* PDF Download Button */}
                    <a
                      href={draftsApi.exportPdf(caseId, selectedDraft.id)}
                      download
                      className="px-3 py-1.5 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all"
                      title="Download as formal Court PDF"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </a>

                    {/* DOCX Download Button */}
                    <a
                      href={draftsApi.exportDocx(caseId, selectedDraft.id)}
                      download
                      className="px-3 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all"
                      title="Download editable Microsoft Word document"
                    >
                      <Download className="w-3.5 h-3.5" /> .DOCX
                    </a>

                    <button
                      onClick={() => {
                        if (confirm(`Delete draft "${selectedDraft.title}"?`)) deleteMutation.mutate(selectedDraft.id);
                      }}
                      className="btn-ghost p-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg ml-1"
                      title="Delete draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Document Editor / Legal Paper Presentation */}
            <div className="flex-1 overflow-auto p-6 flex justify-center">
              <div className="w-full max-w-4xl bg-white border border-[#E2E8F0] shadow-md rounded-2xl p-8 sm:p-12 min-h-[800px] flex flex-col">
                {editing ? (
                  <textarea
                    className="w-full flex-1 p-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl font-mono text-[13.5px] leading-relaxed text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0284C7] resize-none"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    placeholder="Enter or edit legal draft content..."
                  />
                ) : (
                  <div className="prose-legal text-[13.5px] font-sans leading-relaxed text-[#1E293B] whitespace-pre-wrap select-text">
                    {cleanMarkdownBackticks(selectedDraft.content)}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Draft Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Generate Legal Draft</h3>
                <p className="text-xs text-[#64748B]">Auto-drafted with case citations & statutory format</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="btn-ghost p-1 text-[#64748B] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1 block">Draft Type *</label>
                  <select
                    className="input w-full"
                    value={form.draft_type}
                    onChange={e => setForm({ ...form, draft_type: e.target.value })}
                  >
                    {DRAFT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1 block">Title</label>
                  <input
                    className="input w-full"
                    placeholder="Auto-generated if empty"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1 block">Court / Forum</label>
                <input
                  className="input w-full"
                  placeholder="e.g. In the High Court of Delhi at New Delhi"
                  value={form.court_name}
                  onChange={e => setForm({ ...form, court_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1 block">Petitioner / Client</label>
                  <input
                    className="input w-full"
                    placeholder="Petitioner name"
                    value={form.petitioner_name}
                    onChange={e => setForm({ ...form, petitioner_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1 block">Respondent</label>
                  <input
                    className="input w-full"
                    placeholder="Respondent name"
                    value={form.respondent_name}
                    onChange={e => setForm({ ...form, respondent_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1 block">Specific Instructions</label>
                <textarea
                  className="input w-full resize-none text-xs"
                  rows={2}
                  placeholder="e.g. emphasize medical grounds, dispute FIR timeline..."
                  value={form.specific_instructions}
                  onChange={e => setForm({ ...form, specific_instructions: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1 block">Prayer / Relief Sought</label>
                <textarea
                  className="input w-full resize-none text-xs"
                  rows={2}
                  placeholder="Specific relief or prayer required..."
                  value={form.prayer_details}
                  onChange={e => setForm({ ...form, prayer_details: e.target.value })}
                />
              </div>

              <div className="disclaimer">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>AI-generated draft. Requires review and verification by an advocate before filing in court.</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-[#E2E8F0]">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="btn-primary"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1.5 inline" /> Generating Draft…</>
                ) : (
                  <><PenTool className="w-4 h-4 mr-1.5 inline" /> Generate Draft</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
