import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Loader } from '../../components/ui/loader';
import { EmptyState } from '../../components/ui/empty-state';
import { Table } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { AgencyAgencyCard } from './components/AgencyAgencyCard';

export default function AdminAgenciesPage() {
  const { user } = useAuth();
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at_desc');

  useEffect(() => {
    if (!user || !isAdminOrStaff(user)) {
      // Redirect or show error if not admin
      return;
    }
    fetchAgencies();
  }, [user, searchTerm, statusFilter, sortBy]);

  const isAdminOrStaff = (user) => {
    return user.is_admin || 
           user.role === 'admin' || 
           user.role === 'ceo' || 
           user.role === 'president' || 
           user.role === 'vice_president' ||
           user.role === 'secretary' ||
           user.role === 'executive_secretary' ||
           user.role === 'troll_city_secretary' ||
           user.role === 'troll_city_treasurer' ||
           user.role === 'hr_admin' ||
           user.role === 'lead_troll_officer' ||
           user.role === 'troll_officer' ||
           user.role === 'temp_city_admin' ||
           user.role === 'temp_admin';
  };

  const fetchAgencies = async () => {
    try {
      setLoading(true);
      
      let query = supabase.from('agencies').select(`
        *,
        owner:user_profiles (username),
        members_count:agency_members (count),
        creators_count:agency_members (count, eq(role,creator))
      `);
      
      // Apply search filter
      if (searchTerm.trim()) {
        const search = `%${searchTerm.trim()}%`;
        query = query.or(
          `name.ilike.${search},slug.ilike.${search},owner.username.ilike.${search}`
        );
      }
      
      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      // Apply sorting
      switch (sortBy) {
        case 'created_at_desc':
          query = query.order('created_at', { ascending: false });
          break;
        case 'created_at_asc':
          query = query.order('created_at', { ascending: true });
          break;
        case 'name_asc':
          query = query.order('name', { ascending: true });
          break;
        case 'name_desc':
          query = query.order('name', { ascending: false });
          break;
        case 'members_desc':
          query = query.order('members_count', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Process data to add computed fields
      const processedData = data.map(agency => ({
        ...agency,
        members_count: agency.members_count?.length || 0,
        creators_count: agency.creators_count?.filter(m => m.role === 'creator').length || 0
      }));
      
      setAgencies(processedData);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching agencies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (agencyId, newStatus) => {
    try {
      const { error } = await supabase
        .from('agencies')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', agencyId);

      if (error) throw error;
      
      // Log activity
      await supabase.rpc('log_agency_activity', {
        p_agency_id: agencyId,
        p_actor_id: user.id,
        p_action: `status_changed_to_${newStatus}`,
        p_metadata: { new_status: newStatus }
      });
      
      await fetchAgencies();
    } catch (err) {
      setError(err.message);
      console.error('Error updating agency status:', err);
    }
  };

  const handleRemoveCreator = async (agencyId, creatorId) => {
    try {
      // Remove creator from agency
      const { error } = await supabase
        .from('agency_members')
        .update({ status: 'removed', removed_at: new Date().toISOString() })
        .eq('agency_id', agencyId)
        .eq('user_id', creatorId)
        .eq('role', 'creator')
        .eq('status', 'active');

      if (error) throw error;
      
      // Log activity
      await supabase.rpc('log_agency_activity', {
        p_agency_id: agencyId,
        p_actor_id: user.id,
        p_action: 'creator_removed',
        p_metadata: { removed_creator_id: creatorId }
      });
      
      await fetchAgencies();
    } catch (err) {
      setError(err.message);
      console.error('Error removing creator:', err);
    }
  };

  if (loading) return <Loader />;
  if (error) return <div className="text-red-400 p-4">{error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">
            Agency Management
          </h1>
          <p className="text-slate-400">
            Manage all Talent Offices in Mai Troll
          </p>
        </header>

        {/* Filters */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div>
            <Input
              placeholder="Search agencies by name, owner, or slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              className="w-full"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="suspended">Suspended</option>
              <option value="denied">Denied</option>
            </Select>
          </div>
          <div>
            <Select
              value={sortBy}
              onValueChange={setSortBy}
              className="w-full"
            >
              <option value="created_at_desc">Newest First</option>
              <option value="created_at_asc">Oldest First</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="members_desc">Most Members</option>
            </Select>
          </div>
        </div>

        {/* Agencies List */}
        <div className="space-y-4">
          {agencies.length === 0 ? (
            <EmptyState 
              icon="🏢"
              title="No Agencies Found"
              description="No agencies match your current filters."
            />
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Agencies ({agencies.length})</h2>
                <div className="flex space-x-3">
                  {/* Bulk actions would go here */}
                </div>
              </div>
              
              <div className="space-y-4">
                {agencies.map(agency => (
                  <AgencyAgencyCard
                    key={agency.id}
                    agency={agency}
                    onStatusChange={handleStatusChange}
                    onRemoveCreator={handleRemoveCreator}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}