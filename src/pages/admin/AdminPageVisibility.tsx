// ============================================================
// ADMIN PAGE VISIBILITY / UNDER CONSTRUCTION MANAGER
// ============================================================
// Grid-based admin interface to mark pages as Under Construction
// or disable UC. Only admins can access this page.
// ============================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/store';
import { fetchAllPageVisibility, togglePageUnderConstruction, bulkSetUnderConstruction, addPageVisibility } from '@/services/pageVisibilityService';
import type { PageVisibilityEntry } from '@/services/pageVisibilityService';
import { toast } from 'sonner';
import { Construction, Search, RefreshCw, Shield, Globe, Eye, EyeOff, Loader2, ToggleLeft, ToggleRight, X, Plus, Wrench } from 'lucide-react';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AdminPageVisibility() {
  const { profile } = useAuthStore();
  const [pages, setPages] = useState<PageVisibilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'uc' | 'live'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoute, setNewRoute] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [bulkAction, setBulkAction] = useState(false);

  const isAdmin = profile?.is_admin === true
    || profile?.role === 'admin'
    || profile?.role === 'superadmin'
    || profile?.role === 'ceo';

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllPageVisibility();
      setPages(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handleToggle = async (entry: PageVisibilityEntry) => {
    setTogglingId(entry.id);
    try {
      await togglePageUnderConstruction(entry.id, entry.is_under_construction);
      setPages(prev =>
        prev.map(p =>
          p.id === entry.id
            ? { ...p, is_under_construction: !p.is_under_construction }
            : p
        )
      );
      toast.success(
        entry.is_under_construction
          ? `"${entry.page_name}" is now LIVE`
          : `"${entry.page_name}" is now Under Construction`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle page');
    } finally {
      setTogglingId(null);
    }
  };

  const handleBulkUc = async () => {
    setBulkAction(true);
    try {
      const livePages = filteredPages.filter(p => !p.is_under_construction);
      if (livePages.length === 0) {
        toast.info('All visible pages are already under construction');
        return;
      }
      await bulkSetUnderConstruction(
        livePages.map(p => p.id),
        true
      );
      await loadPages();
      toast.success(`Marked ${livePages.length} pages as Under Construction`);
    } catch (err: any) {
      toast.error(err.message || 'Bulk action failed');
    } finally {
      setBulkAction(false);
    }
  };

  const handleBulkLive = async () => {
    setBulkAction(true);
    try {
      const ucPages = filteredPages.filter(p => p.is_under_construction);
      if (ucPages.length === 0) {
        toast.info('No pages are currently under construction');
        return;
      }
      await bulkSetUnderConstruction(
        ucPages.map(p => p.id),
        false
      );
      await loadPages();
      toast.success(`Marked ${ucPages.length} pages as LIVE`);
    } catch (err: any) {
      toast.error(err.message || 'Bulk action failed');
    } finally {
      setBulkAction(false);
    }
  };

  const handleAddPage = async () => {
    if (!newRoute.trim() || !newName.trim()) {
      toast.error('Please enter both route path and page name');
      return;
    }
    setAdding(true);
    try {
      await addPageVisibility(newRoute.trim(), newName.trim());
      toast.success(`Added "${newName.trim()}" to page visibility`);
      setNewRoute('');
      setNewName('');
      setShowAddModal(false);
      await loadPages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add page');
    } finally {
      setAdding(false);
    }
  };

  const filteredPages = useMemo(() => {
    let result = pages;

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.page_name.toLowerCase().includes(q) ||
          p.route_path.toLowerCase().includes(q)
      );
    }

    // Apply status filter
    if (filterMode === 'uc') {
      result = result.filter(p => p.is_under_construction);
    } else if (filterMode === 'live') {
      result = result.filter(p => !p.is_under_construction);
    }

    return result;
  }, [pages, searchQuery, filterMode]);

  const ucCount = pages.filter(p => p.is_under_construction).length;
  const liveCount = pages.filter(p => !p.is_under_construction).length;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0814] text-white">
        <div className="text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h1 className="text-2xl font-black">Access Denied</h1>
          <p className="mt-2 text-slate-400">Only admins can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10">
              <Construction className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Page Visibility Control</h1>
              <p className="text-sm text-slate-400">
                Mark pages as Under Construction to block public access. Admins can always access all pages.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className={`${glass} rounded-2xl p-4`}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Pages</p>
                <p className="text-2xl font-black text-white">{pages.length}</p>
              </div>
            </div>
          </div>
          <div className={`${glass} rounded-2xl p-4`}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
                <Eye className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Pages</p>
                <p className="text-2xl font-black text-emerald-400">{liveCount}</p>
              </div>
            </div>
          </div>
          <div className={`${glass} rounded-2xl p-4`}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/10">
                <Wrench className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Under Construction</p>
                <p className="text-2xl font-black text-amber-400">{ucCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className={`${glass} mb-6 rounded-2xl p-4`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search pages by name or route..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder-slate-500 focus:border-amber-400/50"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
              {(['all', 'live', 'uc'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    filterMode === mode
                      ? mode === 'uc'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                        : mode === 'live'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                      : 'border border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                  }`}
                >
                  {mode === 'all' ? 'All' : mode === 'live' ? 'Live' : 'UC'}
                  <span className="ml-1.5 opacity-60">
                    ({mode === 'all' ? pages.length : mode === 'live' ? liveCount : ucCount})
                  </span>
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkLive}
                disabled={bulkAction || ucCount === 0}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <Eye className="h-3.5 w-3.5" />
                Enable All
              </button>
              <button
                onClick={handleBulkUc}
                disabled={bulkAction || liveCount === 0}
                className="flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
              >
                <EyeOff className="h-3.5 w-3.5" />
                UC All
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-300 transition hover:bg-blue-500/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Page
              </button>
              <button
                onClick={loadPages}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.1] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Page Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <span className="ml-3 text-slate-400">Loading pages...</span>
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Search className="mb-4 h-12 w-12 opacity-30" />
            <p className="text-lg font-bold">No pages found</p>
            <p className="text-sm">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPages.map(entry => (
              <div
                key={entry.id}
                className={`group relative rounded-2xl border p-4 transition-all hover:scale-[1.02] ${
                  entry.is_under_construction
                    ? 'border-amber-500/30 bg-amber-500/[0.07] hover:border-amber-400/50'
                    : 'border-white/10 bg-white/[0.03] hover:border-emerald-400/30 hover:bg-emerald-500/[0.05]'
                }`}
              >
                {/* Status Badge */}
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      entry.is_under_construction
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {entry.is_under_construction ? (
                      <>
                        <Wrench className="h-2.5 w-2.5" />
                        Under Construction
                      </>
                    ) : (
                      <>
                        <Globe className="h-2.5 w-2.5" />
                        Live
                      </>
                    )}
                  </span>
                </div>

                {/* Page Name */}
                <h3 className="mb-1 truncate text-sm font-bold text-white">
                  {entry.page_name}
                </h3>

                {/* Route Path */}
                <p className="mb-4 truncate font-mono text-xs text-slate-500">
                  {entry.route_path}
                </p>

                {/* Toggle Button */}
                <button
                  onClick={() => handleToggle(entry)}
                  disabled={togglingId === entry.id}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                    entry.is_under_construction
                      ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-400/20'
                      : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-400/20'
                  } disabled:opacity-50`}
                >
                  {togglingId === entry.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : entry.is_under_construction ? (
                    <>
                      <ToggleRight className="h-4 w-4" />
                      Enable Page
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-4 w-4" />
                      Mark UC
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && filteredPages.length > 0 && (
          <div className="mt-6 text-center text-xs text-slate-500">
            Showing {filteredPages.length} of {pages.length} pages
          </div>
        )}
      </div>

      {/* Add Page Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Add New Page</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-400">
                  Route Path
                </label>
                <input
                  type="text"
                  value={newRoute}
                  onChange={e => setNewRoute(e.target.value)}
                  placeholder="/my-new-page"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none placeholder-slate-500 focus:border-blue-400/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-400">
                  Page Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="My New Page"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none placeholder-slate-500 focus:border-blue-400/50"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.1]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPage}
                disabled={adding || !newRoute.trim() || !newName.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
