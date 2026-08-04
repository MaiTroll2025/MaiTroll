import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { AgencyCard } from './components/AgencyCard';
import { Loader } from '../../components/ui/loader';
import { EmptyState } from '../../components/ui/empty-state';
import { Pagination } from '../../components/ui/pagination';

export default function AgenciesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchAgencies();
  }, [page]);

  const fetchAgencies = async () => {
    try {
      setLoading(true);
      const { data, count, error } = await supabase
        .from('agencies')
        .select('*', { count: 'exact' })
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;
      setAgencies(data || []);
      setTotal(count || 0);
      setError(null);
    } catch (err) {
      setError(err.message);
      setAgencies([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;
  if (error) return <div className="text-red-400 p-4">{error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">
            Talent Offices
          </h1>
          <p className="text-slate-400">
            Discover and join creator agencies in Mai Troll
          </p>
          {user && (
            <Button 
              type="button"
              onClick={() => navigate('/agencies/create')}
              className="mt-4 px-6 py-2 bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30"
            >
              Create Talent Office
            </Button>
          )}
        </header>

        {agencies.length === 0 ? (
          <EmptyState 
            icon="🏢"
            title="No Talent Offices Found"
            description="Be the first to create a Talent Office and start recruiting creators!"
          />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {agencies.map(agency => (
                <AgencyCard key={agency.id} agency={agency} />
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <Pagination 
                currentPage={page} 
                totalPages={Math.ceil(total / limit)} 
                onPageChange={setPage} 
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}