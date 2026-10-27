'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { casesApi, workspaceApi, documentsApi } from '@/lib/api';
import { Case, CaseCreate, CASE_TYPES } from '@/lib/types';
import {
  LayoutGrid, Briefcase, FileText, Sparkles, FileEdit,
  Settings, Search, Bell, ChevronDown, Plus, MoreHorizontal,
  Calendar, Upload, X, ArrowRight, ShieldCheck, CheckCircle2,
  FolderOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';

export default function WorkspacePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeNav, setActiveNav] = useState<'dashboard' | 'cases' | 'documents' | 'ai-research' | 'drafts' | 'settings'>('dashboard');
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCaseForUpload, setSelectedCaseForUpload] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [form, setForm] = useState<CaseCreate>({
    title: '',
    case_number: '',
    client_name: '',
    court: '',
    case_type: 'Criminal',
    opposite_party: '',
    notes: '',
  });

  // Queries
  const { data: cases = [], isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: ['cases'],
    queryFn: () => casesApi.list(),
    refetchInterval: 10000,
  });

  const { data: stats } = useQuery({
    queryKey: ['workspace-stats'],
    queryFn: () => workspaceApi.getStats(),
    refetchInterval: 10000,
  });

  const { data: activity = [] } = useQuery<any[]>({
    queryKey: ['workspace-activity'],
    queryFn: () => workspaceApi.getActivity(),
    refetchInterval: 10000,
  });

  // Create Case Mutation
  const createMutation = useMutation({
    mutationFn: () => casesApi.create(form),
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-stats'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-activity'] });
      setShowCreate(false);
      setForm({
        title: '',
        case_number: '',
        client_name: '',
        court: '',
        case_type: 'Criminal',
        opposite_party: '',
        notes: '',
      });
      toast.success('Case created successfully');
      router.push(`/case/${newCase.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Handle Quick Document Upload
  const handleUploadSubmit = async () => {
    if (!selectedCaseForUpload) {
      toast.error('Please select a case');
      return;
    }
    if (!uploadFile) {
      toast.error('Please choose a file to upload');
      return;
    }

    try {
      setIsUploading(true);
      await documentsApi.upload(selectedCaseForUpload, uploadFile);
      toast.success('Document uploaded and scheduled for indexing');
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-stats'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-activity'] });
      setShowUpload(false);
      setUploadFile(null);
      router.push(`/case/${selectedCaseForUpload}/documents`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  // Filtered cases
  const filteredCases = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.client_name?.toLowerCase().includes(q) ||
        c.case_number?.toLowerCase().includes(q) ||
        c.court?.toLowerCase().includes(q) ||
        c.case_type?.toLowerCase().includes(q)
    );
  }, [cases, search]);

  // Greeting based on time
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const todayFormatted = format(new Date(), 'EEEE, MMMM d');

  // Stats computation
  const totalCasesCount = stats?.total_cases ?? cases.length;
  const activeCasesCount = cases.filter((c) => c.status === 'active').length;
  const totalDocsCount = stats?.total_documents ?? cases.reduce((acc, c) => acc + (c.document_count || 0), 0);
  const totalDraftsCount = stats?.total_drafts ?? 0;
  const upcomingHearingsCount = stats?.upcoming_hearings ?? 0;
  const storageUsedStr = stats?.storage_used_str ?? '0 B';
  const storagePct = stats?.storage_pct ?? 0;

  // Format activity time
  const formatActivityTime = (timestamp?: string) => {
    if (!timestamp) return 'Just now';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F1F5F9] font-sans antialiased text-[#334155]">
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="w-64 min-w-[256px] bg-[#0C1E36] border-r border-white/[0.07] flex flex-col h-full sticky top-0 z-50 select-none">
        {/* Brand */}
        <div
          onClick={() => setActiveNav('dashboard')}
          className="p-6 pb-4 flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-[38px] h-[38px] bg-white rounded-lg flex items-center justify-center text-[#0C1E36] font-serif font-bold text-[22px] shadow-lg shadow-black/20 group-hover:scale-105 group-hover:shadow-xl transition-all duration-200">
            L
          </div>
          <div>
            <div className="text-[19px] font-bold text-white tracking-tight flex items-baseline gap-1">
              LegalDesk
              <sup className="text-[10px] font-bold text-[#C5A880] tracking-wider">AI</sup>
            </div>
            <div className="text-[10px] text-[#64748B] font-medium tracking-widest uppercase">Legal Intelligence</div>
          </div>
        </div>

        {/* Workspace Selector */}
        <div className="px-4 pb-4">
          <div className="text-[10px] font-bold text-[#64748B] tracking-wider uppercase mb-1.5 pl-1">
            Workspace
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.15] rounded-lg px-3 py-2.5 flex items-center justify-between text-white text-[13.5px] font-semibold cursor-pointer transition-all">
            <span className="truncate">My Legal Practice</span>
            <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
            { id: 'cases', label: 'Cases', icon: Briefcase },
            { id: 'documents', label: 'Documents', icon: FileText },
            { id: 'ai-research', label: 'AI Research', icon: Sparkles },
            { id: 'drafts', label: 'Drafts', icon: FileEdit },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id as any)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-[#17345C] text-white font-semibold shadow-sm'
                    : 'text-[#94A3B8] hover:bg-[#132B4C] hover:text-[#E2E8F0]'
                }`}
              >
                <Icon className={`w-[17px] h-[17px] shrink-0 ${isActive ? 'text-[#38BDF8]' : 'text-[#64748B]'}`} />
                <span>{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />}
              </button>
            );
          })}
        </nav>

        {/* Storage Widget */}
        <div className="p-4 border-t border-white/[0.07] bg-white/[0.01]">
          <div className="flex justify-between text-[11.5px] font-semibold text-[#94A3B8] mb-2">
            <span>Workspace storage</span>
            <span className="text-white font-bold">{storagePct}%</span>
          </div>
          <div className="w-full h-[5px] bg-white/10 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-[#38BDF8] rounded-full transition-all duration-300"
              style={{ width: `${Math.max(storagePct, 0)}%` }}
            />
          </div>
          <div className="text-[11px] text-[#64748B]">
            {storageUsedStr} of 10 GB used
          </div>
        </div>
      </aside>

      {/* ================= MAIN WRAPPER ================= */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-[#E2E8F0] h-16 min-h-[64px] flex items-center justify-between px-8 sticky top-0 z-40">
          {/* Search bar */}
          <div className="flex items-center gap-2.5 bg-[#F8FAFC] border border-[#E2E8F0] focus-within:border-[#0284C7] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0284C7]/15 rounded-lg px-3.5 py-2 w-[440px] transition-all">
            <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
            <input
              type="text"
              className="bg-transparent border-none outline-none text-[13.5px] text-[#0F172A] placeholder:text-[#94A3B8] w-full"
              placeholder="Search cases, documents, citations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-[11px] font-semibold text-[#64748B] tracking-tight shrink-0">
              ⌘ K
            </span>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-4">
            <button
              className="p-2 text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-[19px] h-[19px]" />
            </button>

            <div className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[#F8FAFC] cursor-pointer transition-colors">
              <div className="w-9 h-9 rounded-full bg-[#E0E7FF] text-[#4338CA] flex items-center justify-center font-bold text-xs">
                LP
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[13px] font-bold text-[#0F172A] leading-tight">
                  Legal Counsel
                </span>
                <span className="text-[11.5px] text-[#64748B]">
                  Advocate Workspace
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] ml-1" />
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-8 max-w-[1440px] w-full mx-auto">
          {/* ================= HERO GREETING BANNER ================= */}
          <div className="relative rounded-2xl p-8 text-white mb-6 overflow-hidden shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-[#091D38] via-[#0D2548] to-[#163C70]">
            {/* Ambient glow orbs */}
            <div className="absolute -right-16 -top-20 w-80 h-80 rounded-full bg-[#38BDF8]/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-12 w-48 h-48 rounded-full bg-[#C5A880]/8 blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-[12px] font-semibold text-[#64748B]">
                  {todayFormatted}
                </span>
                <span className="w-1 h-1 rounded-full bg-[#64748B]" />
                <span className="bg-[#C5A880]/15 border border-[#C5A880]/35 text-[#C5A880] text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Private & Secure Workspace
                </span>
              </div>
              <h1 className="font-serif text-[30px] font-bold text-white tracking-tight mb-1.5 leading-tight">
                {greeting}, Counsel
              </h1>
              <p className="text-[13.5px] text-[#94A3B8] max-w-md">
                Your practice, matters, and legal intelligence—all in one private workspace.
              </p>
            </div>

            <div className="flex items-center gap-3 relative z-10 shrink-0">
              <button
                onClick={() => {
                  if (cases.length > 0 && !selectedCaseForUpload) {
                    setSelectedCaseForUpload(cases[0].id);
                  }
                  setShowUpload(true);
                }}
                className="bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.18] hover:border-white/35 text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95"
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="bg-white hover:bg-[#F8FAFC] text-[#0A1E38] text-[13px] font-bold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                <Plus className="w-4 h-4" />
                New Case
              </button>
            </div>
          </div>

          {/* ================= 4 STATS CARDS ROW ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            {/* Card 1: Total Cases */}
            <div className="stat-card animate-fade-in stagger-1">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#0C1E36]/8 text-[#0C1E36] flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <button className="text-[#94A3B8] hover:text-[#475569] p-1 rounded transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[11px] font-bold text-[#64748B] tracking-widest uppercase mb-1">
                Total Cases
              </div>
              <div className="text-[30px] font-extrabold text-[#0F172A] leading-tight mb-1">
                {totalCasesCount}
              </div>
              <div className="text-[12px] font-medium text-[#64748B]">
                {activeCasesCount} active {activeCasesCount === 1 ? 'matter' : 'matters'}
              </div>
            </div>

            {/* Card 2: Documents Processed */}
            <div className="stat-card animate-fade-in stagger-2">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <button className="text-[#94A3B8] hover:text-[#475569] p-1 rounded transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[11px] font-bold text-[#64748B] tracking-widest uppercase mb-1">
                Documents
              </div>
              <div className="text-[30px] font-extrabold text-[#0F172A] leading-tight mb-1">
                {totalDocsCount}
              </div>
              <div className="text-[12px] font-medium text-[#64748B]">
                {totalDocsCount} indexed {totalDocsCount === 1 ? 'file' : 'files'}
              </div>
            </div>

            {/* Card 3: Drafts in Progress */}
            <div className="stat-card animate-fade-in stagger-3">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
                  <FileEdit className="w-5 h-5" />
                </div>
                <button className="text-[#94A3B8] hover:text-[#475569] p-1 rounded transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[11px] font-bold text-[#64748B] tracking-widest uppercase mb-1">
                Drafts
              </div>
              <div className="text-[30px] font-extrabold text-[#0F172A] leading-tight mb-1">
                {totalDraftsCount}
              </div>
              <div className="text-[12px] font-medium text-[#64748B]">
                {totalDraftsCount} legal {totalDraftsCount === 1 ? 'pleading' : 'pleadings'}
              </div>
            </div>

            {/* Card 4: Upcoming Hearings */}
            <div className="stat-card animate-fade-in stagger-4">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <button className="text-[#94A3B8] hover:text-[#475569] p-1 rounded transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[11px] font-bold text-[#64748B] tracking-widest uppercase mb-1">
                Hearings
              </div>
              <div className="text-[30px] font-extrabold text-[#0F172A] leading-tight mb-1">
                {upcomingHearingsCount}
              </div>
              <div className="text-[12px] font-medium text-[#64748B]">
                {upcomingHearingsCount > 0 ? `${upcomingHearingsCount} upcoming dates` : 'No upcoming dates'}
              </div>
            </div>
          </div>

          {/* ================= DASHBOARD CONTENT SPLIT ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Left: Recent Cases Table */}
            <div>
              <div className="flex items-baseline justify-between mb-3.5">
                <div>
                  <h2 className="text-[16px] font-bold text-[#0F172A] tracking-tight">
                    Recent cases
                  </h2>
                  <p className="text-[12.5px] text-[#64748B] mt-0.5">
                    Your most recently accessed matters
                  </p>
                </div>
                <button
                  onClick={() => setSearch('')}
                  className="text-[13px] font-semibold text-[#0284C7] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  View all cases →
                </button>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
                {isLoadingCases ? (
                  <div className="p-8 text-center text-[#94A3B8]">
                    <div className="w-6 h-6 border-2 border-[#0284C7] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading cases...
                  </div>
                ) : filteredCases.length === 0 ? (
                  <div className="p-12 text-center">
                    <Briefcase className="w-12 h-12 text-[#94A3B8] mx-auto mb-3 opacity-60" />
                    <h3 className="text-base font-semibold text-[#0F172A] mb-1">
                      {search ? 'No matching cases' : 'No cases yet'}
                    </h3>
                    <p className="text-xs text-[#64748B] mb-5 max-w-sm mx-auto">
                      {search
                        ? 'Try clearing the search query to see all cases.'
                        : 'Create your first legal matter to start analyzing documents and generating drafts.'}
                    </p>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="bg-[#0C1E36] hover:bg-[#17345C] text-white text-[13px] font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Case
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <th className="py-3 px-4 text-left text-[11.5px] font-bold text-[#64748B] uppercase tracking-wider">
                            Matter / Case
                          </th>
                          <th className="py-3 px-4 text-left text-[11.5px] font-bold text-[#64748B] uppercase tracking-wider">
                            Type
                          </th>
                          <th className="py-3 px-4 text-left text-[11.5px] font-bold text-[#64748B] uppercase tracking-wider">
                            Court
                          </th>
                          <th className="py-3 px-4 text-left text-[11.5px] font-bold text-[#64748B] uppercase tracking-wider">
                            Documents
                          </th>
                          <th className="py-3 px-4 text-left text-[11.5px] font-bold text-[#64748B] uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {filteredCases.map((c) => {
                          const type = c.case_type || 'Civil';
                          let badgeClass = 'bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]';
                          if (type.toLowerCase().includes('crim')) {
                            badgeClass = 'bg-[#FEF2F2] text-[#B91C1C] border-[#FEE2E2]';
                          } else if (type.toLowerCase().includes('bail')) {
                            badgeClass = 'bg-[#FFFBEB] text-[#B45309] border-[#FEF3C7]';
                          } else if (type.toLowerCase().includes('civil')) {
                            badgeClass = 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]';
                          }

                          return (
                            <tr
                              key={c.id}
                              onClick={() => router.push(`/case/${c.id}`)}
                              className="hover:bg-[#F8FAFC] cursor-pointer transition-colors group"
                            >
                              <td className="py-3.5 px-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-[13.5px] text-[#0F172A] group-hover:text-[#0284C7] transition-colors line-clamp-1">
                                    {c.title}
                                  </span>
                                  <span className="text-[12px] text-[#64748B]">
                                    {c.case_number ? `#${c.case_number}` : ''}
                                    {c.client_name ? ` • Client: ${c.client_name}` : ''}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border ${badgeClass}`}>
                                  {type}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-[13px] text-[#475569] whitespace-nowrap">
                                {c.court || '—'}
                              </td>
                              <td className="py-3.5 px-4 text-[13px] text-[#475569] whitespace-nowrap font-medium">
                                {c.document_count ?? 0}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#16A34A] bg-[#DCFCE7] px-2.5 py-0.5 rounded-full border border-[#BBF7D0]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                                  {c.status || 'Active'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Recent Activity Feed */}
            <div>
              <div className="flex items-baseline justify-between mb-3.5">
                <div>
                  <h2 className="text-[16px] font-bold text-[#0F172A] tracking-tight">
                    Recent activity
                  </h2>
                  <p className="text-[12.5px] text-[#64748B] mt-0.5">
                    Live updates across your workspace
                  </p>
                </div>
                <button className="text-[#94A3B8] hover:text-[#475569] p-1 rounded">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-4">
                {activity.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-5 h-5 text-[#94A3B8]" />
                    </div>
                    <p className="text-[13px] font-medium text-[#64748B]">No recent activity</p>
                    <p className="text-[11.5px] text-[#94A3B8] mt-1">Actions appear here as you work.</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {activity.slice(0, 7).map((act, idx) => (
                      <div key={idx} className={`flex items-start gap-3 py-2.5 ${idx < Math.min(activity.length, 7) - 1 ? 'border-b border-[#F8FAFC]' : ''}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          act.icon === 'briefcase' ? 'bg-[#E0F2FE] text-[#0284C7]' :
                          act.icon === 'file-check' || act.icon === 'file' ? 'bg-[#F0FDF4] text-[#16A34A]' :
                          'bg-[#F5F3FF] text-[#7C3AED]'
                        }`}>
                          {act.icon === 'briefcase' ? (
                            <Briefcase className="w-3.5 h-3.5" />
                          ) : act.icon === 'file-check' || act.icon === 'file' ? (
                            <FileText className="w-3.5 h-3.5" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-medium text-[#334155] leading-snug line-clamp-2">
                            {act.title}
                          </p>
                          <span className="text-[11px] text-[#94A3B8] block mt-0.5">
                            {formatActivityTime(act.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ================= MODAL: CREATE NEW CASE ================= */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-xl w-full max-w-lg p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] mb-5">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Create New Case Matter</h3>
                <p className="text-xs text-[#64748B]">Add a new legal file to your private intelligence workspace</p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Matter / Case Title *
                </label>
                <input
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#0284C7] focus:bg-white rounded-lg px-3.5 py-2 text-[13.5px] text-[#0F172A] outline-none transition-all"
                  placeholder="e.g. State vs. Ramesh Kumar & Ors."
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                    Case / FIR Number
                  </label>
                  <input
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#0284C7] focus:bg-white rounded-lg px-3.5 py-2 text-[13.5px] text-[#0F172A] outline-none transition-all"
                    placeholder="FIR/2024/001"
                    value={form.case_number || ''}
                    onChange={(e) => setForm({ ...form, case_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                    Client Name
                  </label>
                  <input
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#0284C7] focus:bg-white rounded-lg px-3.5 py-2 text-[13.5px] text-[#0F172A] outline-none transition-all"
                    placeholder="e.g. Ramesh Kumar"
                    value={form.client_name || ''}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                    Court / Forum
                  </label>
                  <input
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#0284C7] focus:bg-white rounded-lg px-3.5 py-2 text-[13.5px] text-[#0F172A] outline-none transition-all"
                    placeholder="e.g. High Court of Delhi"
                    value={form.court || ''}
                    onChange={(e) => setForm({ ...form, court: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                    Case Type
                  </label>
                  <select
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#0284C7] focus:bg-white rounded-lg px-3.5 py-2 text-[13.5px] text-[#0F172A] outline-none transition-all"
                    value={form.case_type || 'Criminal'}
                    onChange={(e) => setForm({ ...form, case_type: e.target.value })}
                  >
                    {CASE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Opposite Party
                </label>
                <input
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#0284C7] focus:bg-white rounded-lg px-3.5 py-2 text-[13.5px] text-[#0F172A] outline-none transition-all"
                  placeholder="e.g. State of NCT Delhi / Complainant"
                  value={form.opposite_party || ''}
                  onChange={(e) => setForm({ ...form, opposite_party: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Case Brief / Notes
                </label>
                <textarea
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#0284C7] focus:bg-white rounded-lg px-3.5 py-2 text-[13.5px] text-[#0F172A] outline-none resize-none transition-all"
                  rows={2}
                  placeholder="Initial observations, legal issues, or FIR details..."
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setShowCreate(false)}
                className="bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] font-semibold text-[13px] px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.title.trim() || createMutation.isPending}
                className="bg-[#0C1E36] hover:bg-[#17345C] text-white font-bold text-[13px] px-5 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 shadow-md"
              >
                {createMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Case Matter
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: QUICK UPLOAD DOCUMENT ================= */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-xl w-full max-w-lg p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] mb-5">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Upload Legal Document</h3>
                <p className="text-xs text-[#64748B]">Upload FIR, Petition, Evidence or Judgment for AI RAG analysis</p>
              </div>
              <button
                onClick={() => setShowUpload(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Select Case */}
              <div>
                <label className="block text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Select Target Case Matter *
                </label>
                {cases.length === 0 ? (
                  <p className="text-xs text-red-500">Please create a case matter first.</p>
                ) : (
                  <select
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#0284C7] focus:bg-white rounded-lg px-3.5 py-2 text-[13.5px] text-[#0F172A] outline-none transition-all"
                    value={selectedCaseForUpload}
                    onChange={(e) => setSelectedCaseForUpload(e.target.value)}
                  >
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} {c.case_number ? `(${c.case_number})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Drag & Drop File Zone */}
              <div>
                <label className="block text-[11.5px] font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Choose Document File (PDF, DOCX, TXT)
                </label>
                <label className="border-2 border-dashed border-[#CBD5E1] hover:border-[#0284C7] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-[#F8FAFC] hover:bg-[#F0F9FF] transition-all">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                      }
                    }}
                  />
                  <Upload className="w-8 h-8 text-[#0284C7] mb-2" />
                  {uploadFile ? (
                    <div className="text-center">
                      <p className="text-sm font-bold text-[#0F172A]">{uploadFile.name}</p>
                      <p className="text-xs text-[#64748B]">
                        {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-[#0F172A]">
                        Click to select document or drag & drop
                      </p>
                      <p className="text-xs text-[#64748B] mt-1">
                        Supports PDF, Word Documents, and Plain Text files
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setShowUpload(false)}
                className="bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] font-semibold text-[13px] px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={!selectedCaseForUpload || !uploadFile || isUploading}
                className="bg-[#0C1E36] hover:bg-[#17345C] text-white font-bold text-[13px] px-5 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 shadow-md"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload & Index
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
