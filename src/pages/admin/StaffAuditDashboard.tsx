import React, { useState } from 'react';
import { useStaffAudit, StaffAuditFilters } from '../../hooks/useStaffAudit';
import { StaffActionType, StaffActionCategory } from '../../lib/logStaffAction';
import { Shield, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, Lock, Unlock, Trash2, Plus, Activity, Clock, User, FileText } from 'lucide-react';
import { toast } from 'sonner';

type TabId = 'audit_log' | 'summary' | 'permissions' | 'gaps';

const ACTION_TYPES = Object.values(StaffActionType);
const ACTION_CATEGORIES = Object.values(StaffActionCategory);
const RESULTS = ['success', 'denied', 'error'];

const STAFF_ROLES = [
  'admin', 'superadmin', 'ceo', 'owner', 'staff',
  'lead_troll_officer', 'troll_officer', 'officer',
  'secretary', 'executive_secretary', 'troll_city_secretary',
  'prosecutor', 'attorney', 'judge', 'auctioneer',
  'pastor', 'journalist', 'tcnn_news_caster', 'tcnn_chief_news_caster',
  'ceo_assistant', 'noah_assistant',
  'president', 'vice_president',
  'hr_admin', 'hr_manager', 'agency_hr', 'agency_hr_manager', 'agency_leader',
  'marketing_agent', 'notary', 'broadofficer',
  'academy_teacher', 'academy_director', 'admissions_officer',
  'temp_city_admin', 'temp_admin', 'moderator',
];

// Known unprotected routes from audit
const UNPROTECTED_ROUTES = [
  { route: '/inmates', component: 'InmatesPage', risk: 'HIGH', recommended: 'TROLL_OFFICER, ADMIN, LEAD_TROLL_OFFICER' },
  { route: '/tromail/office', component: 'TroMailOfficePage', risk: 'HIGH', recommended: 'SECRETARY, ADMIN' },
  { route: '/live/command-center/:streamId', component: 'LiveCommandCenter', risk: 'HIGH', recommended: 'BROADCASTER, ADMIN' },
  { route: '/live/overlay/:streamId', component: 'LiveStreamOverlay', risk: 'MEDIUM', recommended: 'BROADCASTER, ADMIN' },
  { route: '/government/streams', component: 'GovernmentStreams', risk: 'MEDIUM', recommended: 'OFFICER, ADMIN, SECRETARY' },
  { route: '/court/:courtId', component: 'CourtRoom', risk: 'MEDIUM', recommended: 'JUDGE, ATTORNEY, PROSECUTOR, ADMIN' },
  { route: '/tromail', component: 'TromailPage', risk: 'MEDIUM', recommended: 'Role-based (internal mail)' },
];

export default function StaffAuditDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('audit_log');
  const [filters, setFilters] = useState<StaffAuditFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [newPermRole, setNewPermRole] = useState('');
  const [newPermResource, setNewPermResource] = useState('');
  const [newPermAccess, setNewPermAccess] = useState<'allow' | 'deny'>('allow');

  const {
    entries, summary, permissions, permissionError, loading, error,
    totalCount, page, pageSize, setPage,
    refresh, refreshSummary, refreshPermissions,
    updatePermission, addPermission, removePermission,
  } = useStaffAudit(filters);

  const totalPages = Math.ceil(totalCount / pageSize);

  const riskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      HIGH: 'bg-red-500/20 text-red-400 border-red-500/30',
      MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      LOW: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    return colors[risk] || colors.LOW;
  };

  const resultBadge = (result: string) => {
    const colors: Record<string, string> = {
      success: 'bg-green-500/20 text-green-400',
      denied: 'bg-red-500/20 text-red-400',
      error: 'bg-yellow-500/20 text-yellow-400',
    };
    return colors[result] || '';
  };

  const handleAddPermission = async () => {
    if (!newPermRole || !newPermResource) {
      toast.error('Role and resource are required');
      return;
    }
    const ok = await addPermission(newPermRole, newPermResource, newPermAccess);
    if (ok) {
      toast.success('Permission added');
      setNewPermRole('');
      setNewPermResource('');
      setNewPermAccess('allow');
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'audit_log', label: 'Audit Log', icon: <FileText size={16} /> },
    { id: 'summary', label: 'Summary', icon: <Activity size={16} /> },
    { id: 'permissions', label: 'Permissions', icon: <Lock size={16} /> },
    { id: 'gaps', label: 'Security Gaps', icon: <AlertTriangle size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold">Staff Audit Dashboard</h1>
            <p className="text-sm text-gray-400">Monitor staff actions, permissions & security gaps</p>
          </div>
        </div>
        <button
          onClick={() => { refresh(); refreshSummary(); refreshPermissions(); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon} {tab.label}
            {tab.id === 'gaps' && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {UNPROTECTED_ROUTES.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ─── AUDIT LOG TAB ─── */}
      {activeTab === 'audit_log' && (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm"
            >
              <Filter size={14} /> Filters
            </button>
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search by target, email, or action..."
                value={filters.search || ''}
                onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-9 pr-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-4 bg-white/5 rounded-lg">
              <select
                value={filters.staffRole || ''}
                onChange={e => setFilters(prev => ({ ...prev, staffRole: e.target.value || undefined }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">All Roles</option>
                {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={filters.actionType || ''}
                onChange={e => setFilters(prev => ({ ...prev, actionType: e.target.value || undefined }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">All Actions</option>
                {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select
                value={filters.actionCategory || ''}
                onChange={e => setFilters(prev => ({ ...prev, actionCategory: e.target.value || undefined }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">All Categories</option>
                {ACTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={filters.result || ''}
                onChange={e => setFilters(prev => ({ ...prev, result: e.target.value || undefined }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">All Results</option>
                {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value || undefined }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Time</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Staff</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Action</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Target</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Route</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-500">Loading...</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-500">No audit entries found</td></tr>
                ) : (
                  entries.map(entry => (
                    <tr key={entry.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={12} className="text-gray-500" />
                          <span className="truncate max-w-[150px]">{entry.staff_email || entry.staff_user_id.slice(0,8)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{entry.staff_role}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{entry.action_type}</td>
                      <td className="px-4 py-3 text-gray-400">{entry.action_category}</td>
                      <td className="px-4 py-3">
                        {entry.target_name && <span>{entry.target_name}</span>}
                        {entry.target_id && <span className="text-gray-500 text-xs ml-1">({entry.target_id.slice(0,8)})</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{entry.route_path}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${resultBadge(entry.result)}`}>
                          {entry.result}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-400">
              {totalCount} entries • Page {page + 1} of {totalPages || 1}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUMMARY TAB ─── */}
      {activeTab === 'summary' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {summary.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">No summary data yet</div>
            ) : (
              summary.map((row, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{row.staff_role}</span>
                    <span className="text-xs text-gray-500">{row.action_type}</span>
                  </div>
                  <div className="text-2xl font-bold">{row.action_count.toLocaleString()}</div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(row.last_action).toLocaleDateString()}</span>
                    {row.denied_count > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertTriangle size={10} /> {row.denied_count} denied
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── PERMISSIONS TAB ─── */}
      {activeTab === 'permissions' && (
        <div>
          {permissionError && (
            <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              Permission matrix unavailable: {permissionError}
            </div>
          )}
          {/* Add Permission */}
          <div className="flex items-center gap-3 mb-4 p-4 bg-white/5 rounded-lg">
            <select
              value={newPermRole}
              onChange={e => setNewPermRole(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm flex-1"
            >
              <option value="">Select Role</option>
              {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              type="text"
              placeholder="Resource (e.g. page:/admin/grant-coins)"
              value={newPermResource}
              onChange={e => setNewPermResource(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm flex-1"
            />
            <select
              value={newPermAccess}
              onChange={e => setNewPermAccess(e.target.value as 'allow' | 'deny')}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
            <button
              onClick={handleAddPermission}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {/* Permissions Table */}
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Resource</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Permission</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {permissions.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-500">No permissions configured</td></tr>
                ) : (
                  permissions.map(perm => (
                    <tr key={perm.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{perm.role_name}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{perm.resource}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          perm.permission === 'allow'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {perm.permission}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updatePermission(perm.id, perm.permission === 'allow' ? 'deny' : 'allow')}
                            className="p-1 hover:bg-white/10 rounded"
                            title={perm.permission === 'allow' ? 'Deny' : 'Allow'}
                          >
                            {perm.permission === 'allow' ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>
                          <button
                            onClick={() => { removePermission(perm.id); toast.success('Permission removed'); }}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SECURITY GAPS TAB ─── */}
      {activeTab === 'gaps' && (
        <div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-red-400" size={20} />
              <h3 className="font-bold text-red-400">Unprotected Staff Routes</h3>
            </div>
            <p className="text-sm text-gray-400">
              These routes are inside <code className="bg-white/10 px-1 rounded">RequireAuth</code> but have{' '}
              <strong>no RequireRole guard</strong>, meaning any authenticated user can access them.
            </p>
          </div>

          <div className="space-y-3">
            {UNPROTECTED_ROUTES.map((gap, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <code className="text-blue-400 font-mono text-sm">{gap.route}</code>
                  <span className={`px-2 py-0.5 rounded text-xs border ${riskBadge(gap.risk)}`}>
                    {gap.risk} RISK
                  </span>
                </div>
                <div className="text-sm text-gray-400 mb-1">Component: <span className="text-white">{gap.component}</span></div>
                <div className="text-sm text-gray-400">
                  Recommended guard: <span className="text-green-400">{gap.recommended}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <h4 className="font-bold text-yellow-400 mb-2">Additional Security Findings</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <span><strong>user_role_grants table has no RLS</strong> — any authenticated user can read/modify role grants. Fix applied in migration.</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <span><strong>Hardcoded admin email</strong> in <code className="bg-white/10 px-1 rounded">handleSearchChange.tsx</code> — bypasses normal role checks.</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                <span><strong>STAFF_ROLES set incomplete</strong> — missing 18 roles from UserRole enum (pastor, auctioneer, judge, president, etc.).</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                <span><strong>Dual role system</strong> — both <code className="bg-white/10 px-1 rounded">role</code> and <code className="bg-white/10 px-1 rounded">troll_role</code> plus boolean flags create inconsistency.</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                <span><strong>is_admin() has 6+ conflicting definitions</strong> across migrations. New <code className="bg-white/10 px-1 rounded">is_admin_consolidated()</code> function created but original left untouched.</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
