import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ChevronLeft,
  Save,
  Loader,
} from 'lucide-react';
import { maiBusinessApi, type BusinessPlanSection } from '@/features/mai-business/lib/maiBusinessApi';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const sectionTitles = {
  executive_summary: 'Executive Summary',
  market_analysis: 'Market Analysis',
  product_service: 'Product / Service',
  marketing_strategy: 'Marketing Strategy',
  operations_plan: 'Operations Plan',
  financial_plan: 'Financial Plan',
};

export default function MaiBusinessPlan() {
  const navigate = useNavigate();
  const [sections, setSections] = useState<BusinessPlanSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<BusinessPlanSection | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await maiBusinessApi.getBusinessPlanSections();
        setSections(data);
        if (data.length > 0 && !activeSection) {
          setActiveSection(data[0]);
          setEditingContent(data[0].content || '');
        }
      } catch (err) {
        console.error('Error fetching business plan:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeSection]);

  const handleSectionClick = (section: BusinessPlanSection) => {
    setActiveSection(section);
    setEditingContent(section.content || '');
  };

  const handleSave = async () => {
    if (!activeSection) return;
    setSaving(true);
    try {
      await maiBusinessApi.updateBusinessPlanSection(activeSection.id, {
        content: editingContent,
        status: 'draft' as const,
      });
      toast.success('Section saved!');
      const updated = sections.map(s => s.id === activeSection.id ? { ...activeSection, content: editingContent, status: 'draft' as const } : s);
      setSections(updated);
    } catch {
      toast.error('Failed to save section');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Loader size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-12">
      <div className="container mx-auto px-4 pt-8">
        <div className="mb-8">
          <button onClick={() => navigate('/mai-business/dashboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
            <ChevronLeft size={16} /> Back to Dashboard
          </button>
          <h1 className="text-3xl font-black mb-1">
            <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
              Business Plan Builder
            </span>
          </h1>
          <p className="text-zinc-400 text-lg mt-1">
            Build a comprehensive business plan with AI-assisted guidance.
          </p>
        </div>

        <div className="flex gap-6">
          <div className="w-64 flex-shrink-0">
            <div className={`p-4 rounded-2xl ${glass} h-[calc(100vh-140px)] overflow-y-auto`}>
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <FileText size={16} /> Plan Sections
              </h2>
              <div className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => handleSectionClick(section)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      activeSection?.id === section.id
                        ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-cyan-400/40 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {sectionTitles[section.type as keyof typeof sectionTitles] || section.type}
                    </div>
                    <div className="text-xs opacity-60 mt-1">
                      {section.content?.substring(0, 50) || 'Not started'}
                      {section.content && section.content.length > 50 && '...'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1">
            {activeSection ? (
              <div className={`p-8 rounded-2xl ${glass} min-h-[500px]`}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">
                    {sectionTitles[activeSection.type as keyof typeof sectionTitles] || activeSection.type}
                  </h2>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="w-full h-[400px] px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 resize-y"
                  placeholder="Write your business plan section here..."
                />
              </div>
            ) : (
              <div className={`p-8 rounded-2xl ${glass} text-center min-h-[500px] flex items-center justify-center`}>
                <div>
                  <FileText size={48} className="mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400">Select a section to start writing your business plan.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
