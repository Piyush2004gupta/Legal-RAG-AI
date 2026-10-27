'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi, documentsApi } from '@/lib/api';
import { Document } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Loader2, Sparkles, BookOpen, Scale, AlertTriangle,
  RotateCcw, Copy, Check, FileText, ChevronDown, CheckCircle2,
  ShieldCheck, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  created_at: string;
}

export default function ChatPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [showDocFilter, setShowDocFilter] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ['documents', caseId],
    queryFn: () => documentsApi.list(caseId),
  });

  const completedDocs = documents.filter((d) => d.processing_status === 'completed');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAsking]);

  const handleSend = async (overrideText?: string) => {
    const q = (overrideText ?? input).trim();
    if (!q || isAsking) return;
    setInput('');
    setIsAsking(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: q,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await chatApi.query(
        caseId,
        q,
        sessionId ?? undefined,
        selectedDocs.length > 0 ? selectedDocs : undefined
      );
      if (!sessionId && result.session_id) {
        setSessionId(result.session_id);
      }
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.answer,
        citations: result.citations,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e: any) {
      toast.error(e.message || 'AI query failed');
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(q);
    } finally {
      setIsAsking(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Response copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setInput('');
    toast('Started a new query session', { icon: '✨' });
  };

  const PROMPT_SUGGESTIONS = [
    {
      title: 'Summarize Key Facts',
      desc: 'Chronological timeline & factual background',
      query: 'Summarize the key facts, sequence of events, and allegations in this case.',
      icon: Scale,
    },
    {
      title: 'Applicable Legal Sections',
      desc: 'Statutes & legal ingredients invoked',
      query: 'What sections of law (BNS/IPC, BNSS/CrPC, or special acts) are invoked in this case?',
      icon: BookOpen,
    },
    {
      title: 'Procedural Compliance & Lapses',
      desc: 'Check investigation or notice procedural defects',
      query: 'Are there any procedural lapses, delays, or statutory non-compliances evident in the documents?',
      icon: ShieldCheck,
    },
    {
      title: 'Bail & Interim Relief Analysis',
      desc: 'Grounds & precedents for bail',
      query: 'What grounds exist for seeking bail or interim relief based on the record?',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9] text-[#334155] select-none">
      {/* ================= HEADER ================= */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-3.5 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] font-bold text-[#0F172A] tracking-tight">Ask AI</h1>
            <span className="inline-flex items-center gap-1 bg-[#E0F2FE] text-[#0284C7] text-[10.5px] font-bold px-2 py-0.5 rounded-full border border-[#BAE6FD]">
              <Sparkles className="w-3 h-3" /> RAG Grounded
            </span>
          </div>
          <p className="text-[12px] text-[#64748B] mt-0.5">
            Verified Indian law intelligence grounded strictly in your case documents
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-[#475569] hover:text-[#0F172A] bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg transition-all shadow-sm"
              title="Start a fresh conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          )}

          {/* Document filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDocFilter(!showDocFilter)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-lg border transition-all shadow-sm ${
                selectedDocs.length > 0
                  ? 'bg-[#EFF6FF] border-[#93C5FD] text-[#1D4ED8]'
                  : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>
                {selectedDocs.length > 0
                  ? `${selectedDocs.length} of ${completedDocs.length} docs filtered`
                  : `All ${completedDocs.length} docs active`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            </button>

            {showDocFilter && (
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-[#CBD5E1] rounded-xl p-3 z-30 shadow-xl animate-slide-up">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E2E8F0]">
                  <p className="text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider">
                    Filter Source Documents
                  </p>
                  {selectedDocs.length > 0 && (
                    <button
                      onClick={() => setSelectedDocs([])}
                      className="text-[11px] font-semibold text-[#0284C7] hover:underline"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>

                {completedDocs.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] py-2">No processed documents found in this case.</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {completedDocs.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-center gap-2.5 p-1.5 hover:bg-[#F8FAFC] rounded-lg cursor-pointer text-[12.5px] text-[#334155]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocs.includes(doc.id)}
                          onChange={(e) =>
                            setSelectedDocs((prev) =>
                              e.target.checked
                                ? [...prev, doc.id]
                                : prev.filter((id) => id !== doc.id)
                            )
                          }
                          className="w-4 h-4 accent-[#0284C7] rounded"
                        />
                        <span className="truncate font-medium">{doc.original_filename}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= CHAT MESSAGES BODY ================= */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto py-8 text-center animate-fade-in">
            {/* Center Logo Icon */}
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#E2E8F0] shadow-md flex items-center justify-center mx-auto mb-4 text-[#0284C7]">
              <Scale className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-[#0F172A] mb-1 tracking-tight">
              Case Intelligence & Legal Research
            </h2>
            <p className="text-[13.5px] text-[#64748B] mb-6 max-w-md mx-auto">
              Ask any question about this matter. Every response is grounded in your uploaded documents and Indian statutes with page citations.
            </p>

            {completedDocs.length === 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] rounded-lg text-xs font-semibold mb-6">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>No documents processed yet. Upload case documents to enable citation-backed Q&A.</span>
              </div>
            )}

            {/* Quick Prompt Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {PROMPT_SUGGESTIONS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.query)}
                    className="p-3.5 bg-white border border-[#E2E8F0] hover:border-[#0284C7] hover:bg-[#F0F9FF] rounded-xl transition-all shadow-sm hover:shadow text-left group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-[#0284C7] group-hover:scale-110 transition-transform" />
                      <span className="text-[13px] font-bold text-[#0F172A] group-hover:text-[#0284C7] transition-colors">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-[#64748B] line-clamp-1">
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Render Conversation */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            {msg.role === 'user' ? (
              /* User Bubble */
              <div className="max-w-2xl bg-[#0C1E36] text-white rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-md">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span className="text-[11px] font-bold text-[#94A3B8] tracking-wider uppercase">
                    Counsel
                  </span>
                </div>
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap font-medium">
                  {msg.content}
                </p>
              </div>
            ) : (
              /* Assistant / AI Bubble */
              <div className="max-w-3xl w-full bg-white border border-[#E2E8F0] rounded-2xl rounded-tl-sm p-6 shadow-sm">
                {/* AI Header Bar */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#0C1E36] text-white flex items-center justify-center text-[11px] font-bold font-serif">
                      L
                    </div>
                    <span className="text-[13px] font-bold text-[#0F172A]">
                      LegalDesk AI
                    </span>
                    <span className="text-[11px] text-[#64748B]">• Verified Legal Analysis</span>
                  </div>

                  <button
                    onClick={() => copyToClipboard(msg.content, msg.id)}
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#64748B] hover:text-[#0F172A] px-2 py-1 rounded hover:bg-[#F1F5F9] transition-colors"
                    title="Copy full response"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-green-600 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Markdown Output */}
                <div className="prose-legal text-[13.5px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* Source Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#E2E8F0] bg-[#F8FAFC] -mx-6 -mb-6 p-4 rounded-b-2xl">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider mb-2">
                      <BookOpen className="w-3.5 h-3.5 text-[#0284C7]" />
                      <span>Document Citations & Sources Used ({msg.citations.length})</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {msg.citations.map((c: any, cIdx: number) => (
                        <div
                          key={cIdx}
                          className="inline-flex items-center gap-1.5 bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-[11.5px] font-medium px-2.5 py-1 rounded-md shadow-2xl"
                          title={c.snippet || ''}
                        >
                          <FileText className="w-3 h-3 text-[#0284C7]" />
                          <span className="font-bold">[{c.source_id}]</span>
                          <span className="truncate max-w-[200px]">{c.document_name}</span>
                          <span className="text-[#60A5FA]">|</span>
                          <span className="font-semibold">p. {c.page_number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading Bubble */}
        {isAsking && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-[#0284C7] border-t-transparent rounded-full animate-spin" />
              <div className="flex flex-col">
                <span className="text-[13px] font-bold text-[#0F172A]">
                  Analyzing case record & retrieving legal citations...
                </span>
                <span className="text-[11.5px] text-[#64748B]">
                  Applying hybrid vector search & Indian statutory verification
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ================= INPUT BOX AREA ================= */}
      <div className="bg-white border-t border-[#E2E8F0] p-4 shrink-0 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="relative border border-[#CBD5E1] focus-within:border-[#0284C7] focus-within:ring-2 focus-within:ring-[#0284C7]/15 rounded-xl bg-white shadow-sm transition-all flex items-end gap-2 p-2.5">
            <textarea
              className="w-full bg-transparent border-none outline-none text-[13.5px] text-[#0F172A] placeholder:text-[#94A3B8] resize-none max-h-36 min-h-[48px] px-2 py-1 leading-relaxed"
              rows={2}
              placeholder="Ask a legal question about this case (e.g. grounds for bail, FIR charges, inconsistencies in statements)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isAsking}
              className="bg-[#0C1E36] hover:bg-[#17345C] text-white p-3 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0 active:scale-95"
              title="Send legal question (Enter)"
            >
              {isAsking ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-2 px-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0284C7]" />
              Grounded exclusively in case documents • Indian Legal Intelligence
            </span>
            <span>Press <strong>Enter</strong> to send • <strong>Shift + Enter</strong> for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}
