import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ChevronLeft,
  Loader,
  Download,
  Eye,
  Upload,
} from 'lucide-react';
import { maiBusinessApi, type BusinessDocument } from '@/features/mai-business/lib/maiBusinessApi';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const docTypes = [
  { value: 'all', label: 'All Documents' },
  { value: 'business_plan', label: 'Business Plan' },
  { value: 'financial_statement', label: 'Financial Statement' },
  { value: 'pitch_deck', label: 'Pitch Deck' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
];

export default function MaiBusinessDocuments() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [filtered, setFiltered] = useState<BusinessDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await maiBusinessApi.getBusinessDocuments();
        setDocuments(data);
        setFiltered(data);
      } catch (err) {
        console.error('Error fetching documents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (filter === 'all') {
      setFiltered(documents);
    } else {
      setFiltered(documents.filter(d => d.type === filter));
    }
  }, [filter, documents]);

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
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black">
              Business Documents
              <span className="block text-zinc-400 text-xl font-medium mt-1">
                Manage your business documents and files
              </span>
            </h1>
            <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all flex items-center gap-2">
              <Upload size={16} />
              Upload Document
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {docTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setFilter(type.value)}
              className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${
                filter === type.value
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-zinc-700'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={48} className="mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-400 mb-2">No documents found.</p>
            <p className="text-sm text-zinc-500">Upload your first document to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((doc) => (
              <div key={doc.id} className={`p-4 rounded-xl border transition-all ${glass}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-800/50 rounded-xl">
                      <FileText size={24} className="text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{doc.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-zinc-500 mt-1">
                        <span className="px-2 py-0.5 bg-zinc-800/30 rounded-full text-xs">
                          {doc.type}
                        </span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5">
                      <Eye size={16} />
                    </button>
                    <button className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5">
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
