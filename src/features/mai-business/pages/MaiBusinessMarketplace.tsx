import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  ChevronLeft,
  Loader,
  Search,
  Package,
  FileText,
} from 'lucide-react';
import { maiBusinessApi, type MarketplaceListing } from '@/features/mai-business/lib/maiBusinessApi';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';
const cardHover = 'hover:border-cyan-400/30 hover:bg-white/[0.03]';

export default function MaiBusinessMarketplace() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'products' | 'services'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const listingsData = await maiBusinessApi.getMarketplaceListings();
        setListings(listingsData);
      } catch (err) {
        console.error('Error fetching marketplace:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredListings = listings.filter(l => {
    if (filter === 'products' && l.category === 'services') return false;
    if (filter === 'services' && l.category !== 'services') return false;
    if (searchQuery && !l.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
              MAI Business Marketplace
              <span className="block text-zinc-400 text-xl font-medium mt-1">
                Discover products and services for your business
              </span>
            </h1>
            <button
              onClick={() => navigate('/mai-business/marketplace/create')}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all flex items-center gap-2"
            >
              <ShoppingCart size={16} />
              List Your Product
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search products and services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'products', 'services'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-xl text-sm transition-all ${
                  filter === status
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-zinc-700'
                }`}
              >
                {status === 'all' ? 'All' : status === 'products' ? 'Products' : 'Services'}
              </button>
            ))}
          </div>
        </div>

        {filteredListings.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart size={48} className="mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-400 mb-2">No listings found.</p>
            <p className="text-sm text-zinc-500">Try adjusting your search or be the first to list.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing) => (
              <div key={listing.id} className={`p-6 rounded-2xl border transition-all ${glass} ${cardHover}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-zinc-800/50 rounded-xl">
                    {listing.category === 'services' ? (
                      <FileText size={20} className="text-cyan-400" />
                    ) : (
                      <Package size={20} className="text-purple-400" />
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    listing.category === 'services' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-purple-500/10 text-purple-300'
                  }`}>
                    {listing.category || 'general'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{listing.title}</h3>
                <p className="text-sm text-zinc-400 mb-4 line-clamp-3">
                  {listing.description || 'No description available'}
                </p>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-white">
                    ${Number(listing.price).toLocaleString()}
                  </div>
                  <button
                    onClick={() => navigate(`/mai-business/marketplace/${listing.id}`)}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all text-sm"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
