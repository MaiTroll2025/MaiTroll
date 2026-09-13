import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  ChevronLeft,
  Loader,
  Search,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { maiBusinessApi, type FAQItem } from '@/features/mai-business/lib/maiBusinessApi';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function MaiBusinessHelp() {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [openItem, setOpenItem] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await maiBusinessApi.getFAQs();
        setFaqs(data);
        if (data.length > 0) setOpenItem(data[0].id);
      } catch (err) {
        console.error('Error fetching FAQs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredFaqs = searchQuery
    ? faqs.filter(f =>
        f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqs;

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
            MAI Business Help Center
            <span className="block text-zinc-400 text-xl font-medium mt-1">
              Find answers and get support
            </span>
          </h1>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative mb-8">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search for help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="text-center py-16">
              <HelpCircle size={48} className="mx-auto text-zinc-600 mb-4" />
              <p className="text-zinc-400 mb-2">No results found for &quot;{searchQuery}&quot;.</p>
              <p className="text-sm text-zinc-500">Try different keywords or contact support.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFaqs.map((faq) => (
                <div key={faq.id} className={`rounded-xl border overflow-hidden ${glass}`}>
                  <button
                    onClick={() => setOpenItem(openItem === faq.id ? null : faq.id)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left"
                  >
                    <span className="font-medium text-white">{faq.question}</span>
                    <ChevronLeft
                      size={16}
                      className={`text-zinc-500 transition-transform ${openItem === faq.id ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {openItem === faq.id && (
                    <div className="px-6 pb-4">
                      <p className="text-zinc-300 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className={`mt-8 p-6 rounded-2xl text-center ${glass}`}>
            <MessageSquare size={32} className="mx-auto text-zinc-600 mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Still need help?</h3>
            <p className="text-zinc-400 mb-4">Contact our support team for personalized assistance.</p>
            <button className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all flex items-center gap-2 mx-auto">
              <Plus size={16} />
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
