'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { BookOpen, Zap, Loader2, RefreshCw, Scale, Shield, AlertTriangle, Gavel } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AnalysisPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  const queryClient = useQueryClient();

  const { data: analyses = [], isLoading } = useQuery<any[]>({
    queryKey: ['analyses', caseId],
    queryFn: () => analysisApi.list(caseId),
  });

  const generateMutation = useMutation({
    mutationFn: () => analysisApi.generate(caseId, 'full'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses', caseId] });
      toast.success('Legal analysis generated!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const current = analyses.find(a => a.is_current) || analyses[0];
  const content = current?.content;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Legal Analysis</h1>
          <p className="text-[#64748B] text-sm mt-1">AI-generated structured case analysis grounded in documents</p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="btn-primary"
        >
          {generateMutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin text-white" /> Analysing…</>
            : content
              ? <><RefreshCw className="w-4 h-4 text-white" /> Re-generate</>
              : <><Zap className="w-4 h-4 text-white" /> Generate Analysis</>}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="glass-card h-32 shimmer" />)}</div>
      ) : !content ? (
        <div className="empty-state glass-card p-12">
          <BookOpen className="w-16 h-16 text-[#94A3B8] mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-[#0F172A] mb-2">No analysis yet</h3>
          <p className="text-[#64748B] text-sm max-w-sm mb-4">
            Upload and process documents first, then click <strong className="text-[#0284C7]">Generate Analysis</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          {content.summary && (
            <div className="glass-card p-6">
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2 mb-3 pb-2 border-b border-[#E2E8F0]">
                <Scale className="w-4 h-4 text-[#0284C7]" /> Case Summary
              </h2>
              <p className="text-[#334155] text-sm leading-relaxed">{content.summary}</p>
            </div>
          )}

          {/* Key Facts */}
          {content.key_facts?.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2 mb-3 pb-2 border-b border-[#E2E8F0]">
                <BookOpen className="w-4 h-4 text-[#0284C7]" /> Key Established Facts
              </h2>
              <div className="space-y-2.5">
                {content.key_facts.map((f: any, i: number) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="w-5 h-5 rounded-full bg-[#E0F2FE] text-[#0284C7] font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">{i+1}</span>
                    <div className="text-[#334155] leading-relaxed">
                      <span>{f.fact}</span>
                      {f.citation && <span className="citation-ref text-xs ml-2">{f.citation}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applicable Sections */}
          {content.applicable_sections?.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2 mb-3 pb-2 border-b border-[#E2E8F0]">
                <Gavel className="w-4 h-4 text-[#0284C7]" /> Applicable Laws & Sections
              </h2>
              <div className="space-y-3">
                {content.applicable_sections.map((s: any, i: number) => (
                  <div key={i} className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0]">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="badge-blue text-xs font-bold">{s.section}</span>
                      <span className="text-[#64748B] text-xs font-medium">{s.act}</span>
                      {s.citation && <span className="citation-ref text-xs ml-auto">{s.citation}</span>}
                    </div>
                    <p className="text-[#334155] text-sm leading-relaxed">{s.relevance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            {/* Strong Arguments */}
            {content.strong_arguments?.length > 0 && (
              <div className="glass-card p-6">
                <h2 className="text-base font-bold text-emerald-700 flex items-center gap-2 mb-3 pb-2 border-b border-[#E2E8F0]">
                  <Shield className="w-4 h-4 text-emerald-600" /> Strong Arguments
                </h2>
                <div className="space-y-3">
                  {content.strong_arguments.map((a: any, i: number) => (
                    <div key={i} className="text-sm">
                      <p className="text-[#1E293B] font-medium mb-1">✓ {a.point}</p>
                      {a.supporting_evidence && <p className="text-[#64748B] text-xs italic bg-[#F0FDF4] p-2 rounded border border-[#DCFCE7]">{a.supporting_evidence}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weak Arguments */}
            {content.weak_arguments?.length > 0 && (
              <div className="glass-card p-6">
                <h2 className="text-base font-bold text-red-700 flex items-center gap-2 mb-3 pb-2 border-b border-[#E2E8F0]">
                  <AlertTriangle className="w-4 h-4 text-red-600" /> Vulnerabilities & Risks
                </h2>
                <div className="space-y-3">
                  {content.weak_arguments.map((a: any, i: number) => (
                    <div key={i} className="text-sm">
                      <p className="text-[#1E293B] font-medium mb-1">⚠ {a.point}</p>
                      {a.mitigation && <p className="text-[#64748B] text-xs italic bg-[#FEF2F2] p-2 rounded border border-[#FEE2E2]">→ Mitigation: {a.mitigation}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Precedents */}
          {content.similar_judgments?.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2 mb-3 pb-2 border-b border-[#E2E8F0]">
                <Gavel className="w-4 h-4 text-[#0284C7]" /> Relevant Judicial Precedents
              </h2>
              <div className="space-y-3">
                {content.similar_judgments.map((j: any, i: number) => (
                  <div key={i} className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0]">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[#0F172A] text-sm font-bold">{j.case_name}</span>
                      {j.citation && <span className="badge-blue text-xs">{j.citation}</span>}
                    </div>
                    <p className="text-[#334155] text-sm leading-relaxed">{j.principle}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="disclaimer">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>AI-assisted legal analysis. Verification by a qualified advocate is required. This output does not constitute formal legal representation.</span>
          </div>
        </div>
      )}
    </div>
  );
}
