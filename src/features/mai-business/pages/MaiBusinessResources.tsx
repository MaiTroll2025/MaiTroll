import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronLeft,
  Loader,
  ExternalLink,
  Search,
} from 'lucide-react';
import { maiBusinessApi, type Resource } from '@/features/mai-business/lib/maiBusinessApi';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';
const cardHover = 'hover:border-cyan-400/30 hover:bg-white/[0.03]';

export default function MaiBusinessResources() {
  const navigate = useNavigate();
  const [resources, setResources] = useState<Resource[]>([]);
  const [filtered, setFiltered] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await maiBusinessApi.getResources();
        setResources(data);
        setFiltered(data);
      } catch (err) {
        console.error('Error fetching resources:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let result = resources;
    if (category !== 'all') {
      result = result.filter(r => r.category === category);
    }
    if (searchQuery) {
      result = result.filter(r =>
        (r.name || r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFiltered(result);
  }, [category, searchQuery, resources]);

  const categories = ['all', 'guide', 'template', 'video', 'tool', 'article'];

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
          <h1 className="text-3xl font-black">
            MAI Business Resources
            <span className="block text-zinc-400 text-xl font-medium mt-1">
              Guides, templates, and tools for entrepreneurs
            </span>
          </h1>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <div className="relative mb-6">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${
                    category === cat
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-zinc-700'
                  }`}
                >
                  {cat === 'all' ? 'All Resources' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen size={48} className="mx-auto text-zinc-600 mb-4" />
                <p className="text-zinc-400">No resources found matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((resource) => (
                  <div key={resource.id} className={`p-6 rounded-2xl border transition-all ${glass} ${cardHover}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <BookOpen size={20} className="text-purple-400" />
                      <span className={`px-2 py-1 text-xs rounded-full bg-zinc-800/30 text-zinc-300`}>
                        {resource.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{resource.name || resource.title}</h3>
                    {resource.description && (
                      <p className="text-sm text-zinc-400 mb-4 line-clamp-3">
                        {resource.description}
                      </p>
                    )}
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                      >
                        <ExternalLink size={14} />
                        Open Resource
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
