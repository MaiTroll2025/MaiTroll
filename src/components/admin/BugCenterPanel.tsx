import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clipboard, RefreshCw, Search, Trash2, FileDown, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { reportSupabaseError } from '@/lib/bugReporter';

type BugStatus = 'open' | 'in_progress' | 'fixed' | 'ignored';

interface BugReportRow {
  id: string;
  created_at: string;
  updated_at: string | null;
  status: BugStatus;
  severity: string;
  source: string;
  page_url: string | null;
  route_path: string | null;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  username: string | null;
  stream_id: string | null;
  function_name: string | null;
  table_name: string | null;
  error_code: string | null;
  error_message: string;
  error_details: string | null;
  error_hint: string | null;
  stack_trace: string | null;
  request_payload: any;
  response_payload: any;
  browser_info: any;
  app_context: any;
  fixed_note: string | null;
  fixed_by: string | null;
  fixed_at: string | null;
  occurrence_count: number;
  last_seen_at: string | null;
}

const statuses: BugStatus[] = ['open', 'in_progress', 'fixed', 'ignored'];
const severities = ['all', 'critical', 'high', 'medium', 'low'];

function formatJson(value: any): string {
  if (!value) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function makeDebugReport(bug: BugReportRow): string {
  return [
    'MaiTroll BUG REPORT',
    `Status: ${bug.status}`,
    `Severity: ${bug.severity}`,
    `Source: ${bug.source}`,
    `Route: ${bug.route_path || ''}`,
    `Page URL: ${bug.page_url || ''}`,
    `User ID: ${bug.user_id || ''}`,
    `Stream ID: ${bug.stream_id || ''}`,
    `Table: ${bug.table_name || ''}`,
    `Function: ${bug.function_name || ''}`,
    `Error Code: ${bug.error_code || ''}`,
    `Error Message: ${bug.error_message || ''}`,
    `Details: ${bug.error_details || ''}`,
    `Hint: ${bug.error_hint || ''}`,
    `Stack: ${bug.stack_trace || ''}`,
    `Request Payload: ${formatJson(bug.request_payload)}`,
    `Response Payload: ${formatJson(bug.response_payload)}`,
    `Created At: ${bug.created_at}`,
  ].join('\n');
}

export default function BugCenterPanel() {
  const { profile, user } = useAuthStore();
  const isAdminOrCeo = profile?.is_admin || ['admin', 'superadmin', 'ceo'].includes(profile?.role || '');
  const [bugs, setBugs] = useState<BugReportRow[]>([]);
  const [selectedBug, setSelectedBug] = useState<BugReportRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BugStatus>('open');
  const [source, setSource] = useState('all');
  const [severity, setSeverity] = useState('all');
   const [search, setSearch] = useState('');
   const [routeFilter, setRouteFilter] = useState('');
   const [streamFilter, setStreamFilter] = useState('');
   const [loadingAllReports, setLoadingAllReports] = useState(false);

  const sources = useMemo(() => {
    const unique = Array.from(new Set(bugs.map((bug) => bug.source).filter(Boolean))).sort();
    return ['all', ...unique];
  }, [bugs]);

  const fetchBugs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('app_bug_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (status) query = query.eq('status', status);
      if (source !== 'all') query = query.eq('source', source);
      if (severity !== 'all') query = query.eq('severity', severity);
      if (routeFilter.trim()) query = query.ilike('route_path', `%${routeFilter.trim()}%`);
      if (streamFilter.trim()) query = query.eq('stream_id', streamFilter.trim());
      if (search.trim()) {
        const term = search.trim().replace(/[,()]/g, ' ');
        query = query.or(`error_message.ilike.%${term}%,error_code.ilike.%${term}%,table_name.ilike.%${term}%,function_name.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) {
        reportSupabaseError(error, { table: 'app_bug_reports', action: 'select', source: 'admin', functionName: 'BugCenterPanel.fetchBugs' });
        throw error;
      }

      const rows = (data || []) as BugReportRow[];
      setBugs(rows);
      setSelectedBug((prev) => prev ? rows.find((bug) => bug.id === prev.id) || rows[0] || null : rows[0] || null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load Bug Center');
    } finally {
      setLoading(false);
    }
  }, [routeFilter, search, severity, source, status, streamFilter]);

  useEffect(() => {
    fetchBugs();
  }, [fetchBugs]);

  const updateBug = async (bug: BugReportRow, nextStatus: BugStatus, fixedNote?: string) => {
    if (!isAdminOrCeo) return toast.error('Only admin/CEO can update bug reports');

    const patch: Record<string, any> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    if (nextStatus === 'fixed') {
      patch.fixed_note = fixedNote ?? window.prompt('Fixed note?') ?? '';
      patch.fixed_by = user?.id || null;
      patch.fixed_at = new Date().toISOString();
    }

    const { error } = await supabase.from('app_bug_reports').update(patch).eq('id', bug.id);
    if (error) {
      reportSupabaseError(error, { table: 'app_bug_reports', action: 'update', source: 'admin', functionName: 'BugCenterPanel.updateBug' });
      toast.error(error.message);
      return;
    }
    toast.success(`Bug marked ${nextStatus.replace('_', ' ')}`);
    fetchBugs();
  };

  const deleteBug = async (bug: BugReportRow) => {
    if (!isAdminOrCeo) return toast.error('Only admin/CEO can remove bug reports');
    if (!window.confirm('Remove this bug report?')) return;
    const { error } = await supabase.from('app_bug_reports').delete().eq('id', bug.id);
    if (error) {
      reportSupabaseError(error, { table: 'app_bug_reports', action: 'delete', source: 'admin', functionName: 'BugCenterPanel.deleteBug' });
      toast.error(error.message);
      return;
    }
    toast.success('Bug report removed');
    fetchBugs();
   };

   const deleteAllBugs = async () => {
    if (!isAdminOrCeo) return toast.error('Only admin/CEO can remove bug reports');
    if (!window.confirm(`DELETE ALL bug reports matching current filters? This cannot be undone.`)) return;
    setLoadingAllReports(true);
    try {
      let query = supabase.from('app_bug_reports').delete();
      if (status) query = query.eq('status', status);
      if (source !== 'all') query = query.eq('source', source);
      if (severity !== 'all') query = query.eq('severity', severity);
      if (routeFilter.trim()) query = query.ilike('route_path', `%${routeFilter.trim()}%`);
      if (streamFilter.trim()) query = query.eq('stream_id', streamFilter.trim());
      if (search.trim()) {
        const term = search.trim().replace(/[,()]/g, ' ');
        query = query.or(`error_message.ilike.%${term}%,error_code.ilike.%${term}%,table_name.ilike.%${term}%,function_name.ilike.%${term}%`);
      }
      const { error, count } = await query;
      if (error) {
        reportSupabaseError(error, { table: 'app_bug_reports', action: 'delete', source: 'admin', functionName: 'BugCenterPanel.deleteAllBugs' });
        toast.error(error.message);
        return;
      }
      toast.success(`Deleted ${count ?? 0} bug reports`);
      fetchBugs();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete bug reports');
    } finally {
      setLoadingAllReports(false);
    }
   };

   const copyBug = async (bug: BugReportRow) => {
     await navigator.clipboard.writeText(makeDebugReport(bug));
     toast.success('Debug report copied');
   };

   // Download all bug reports as TXT file (opens in Notepad)
   const downloadAllBugsTXT = async () => {
     setLoadingAllReports(true);
     try {
       const lines: string[] = [];
       const timestamp = new Date().toISOString();
       
       // Header
       lines.push('='.repeat(80));
       lines.push('MaiTroll - BUG CENTER REPORT EXPORT');
       lines.push(`Generated: ${timestamp}`);
       lines.push(`Generated By: ${profile?.username || 'Admin'}`);
       lines.push(`Filter: Status=${status} | Source=${source} | Severity=${severity} | Route=${routeFilter || 'all'} | Stream=${streamFilter || 'all'}`);
       lines.push('='.repeat(80));
       lines.push('');

       // Fetch all bug reports matching current filters (no limit)
       let query = supabase
         .from('app_bug_reports')
         .select('*')
         .order('created_at', { ascending: false });

       if (status) query = query.eq('status', status);
       if (source !== 'all') query = query.eq('source', source);
       if (severity !== 'all') query = query.eq('severity', severity);
       if (routeFilter.trim()) query = query.ilike('route_path', `%${routeFilter.trim()}%`);
       if (streamFilter.trim()) query = query.eq('stream_id', streamFilter.trim());
       if (search.trim()) {
         const term = search.trim().replace(/[,()]/g, ' ');
         query = query.or(`error_message.ilike.%${term}%,error_code.ilike.%${term}%,table_name.ilike.%${term}%,function_name.ilike.%${term}%`);
       }

       const { data, error } = await query;

       if (error) {
         throw new Error(`Failed to fetch bug reports: ${error.message}`);
       }

       const allBugs = data as BugReportRow[] || [];

       // Summary header
       lines.push(`TOTAL BUG REPORTS: ${allBugs.length}`);
       lines.push('');
       lines.push('='.repeat(80));
       lines.push('');

       // Detailed bug list
       allBugs.forEach((bug, index) => {
         lines.push(`BUG REPORT #${index + 1}`);
         lines.push(`ID: ${bug.id}`);
         lines.push(`Status: ${bug.status}`);
         lines.push(`Severity: ${bug.severity}`);
         lines.push(`Source: ${bug.source || 'N/A'}`);
         lines.push(`Route/Page: ${bug.route_path || 'N/A'}`);
         lines.push(`Page URL: ${bug.page_url || 'N/A'}`);
         lines.push(`User ID: ${bug.user_id || 'N/A'}`);
         lines.push(`User Email: ${bug.user_email || 'N/A'}`);
         lines.push(`User Role: ${bug.user_role || 'N/A'}`);
         lines.push(`Stream ID: ${bug.stream_id || 'N/A'}`);
         lines.push(`Table: ${bug.table_name || 'N/A'}`);
         lines.push(`Function: ${bug.function_name || 'N/A'}`);
         lines.push(`Error Code: ${bug.error_code || 'N/A'}`);
         lines.push('');
         lines.push(`ERROR MESSAGE:`);
         lines.push(`${bug.error_message}`);
         lines.push('');
         if (bug.error_details) {
           lines.push(`DETAILS:`);
           lines.push(`${bug.error_details}`);
           lines.push('');
         }
         if (bug.error_hint) {
           lines.push(`HINT:`);
           lines.push(`${bug.error_hint}`);
           lines.push('');
         }
         if (bug.stack_trace) {
           lines.push(`STACK TRACE:`);
           lines.push(`${bug.stack_trace}`);
           lines.push('');
         }
          lines.push(`Occurrence Count: ${bug.occurrence_count || 1}`);
          lines.push(`Last Seen: ${bug.last_seen_at || 'N/A'}`);
          lines.push(`Created At: ${bug.created_at}`);
          lines.push(`Updated At: ${bug.updated_at || 'N/A'}`);
          lines.push('');
          lines.push('-'.repeat(80));
          lines.push('');
        });

        // Footer
        lines.push('='.repeat(80));
       lines.push('END OF BUG REPORT EXPORT');
       lines.push('='.repeat(80));

       // Create and download TXT file
       const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `MaiTroll_BugReports_${new Date().toISOString().split('T')[0]}.txt`;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       URL.revokeObjectURL(url);

       toast.success(`Downloaded ${allBugs.length} bug reports as text file`);
     } catch (error: any) {
       console.error('Error downloading bug reports:', error);
       toast.error(error.message || 'Failed to download bug reports');
     } finally {
       setLoadingAllReports(false);
     }
   };

   return (
     <div className="space-y-3">
       <div className="flex items-center justify-between gap-2">
         <div className="flex items-center gap-2">
           <AlertTriangle className="h-4 w-4 text-red-400" />
           <span className="text-sm font-bold text-white">Bug Center</span>
           <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">{bugs.length}</span>
         </div>
         <button
           onClick={fetchBugs}
           disabled={loading}
           className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/15 disabled:opacity-60"
         >
           <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
           Refresh
         </button>
       </div>

       {/* Download All Reports Button */}
       <div className="rounded-lg border border-orange-500/30 bg-orange-950/20 p-3">
         <div className="flex items-center justify-between">
           <div>
             <h3 className="text-sm font-bold text-orange-400 flex items-center gap-2">
               <FileDown className="h-4 w-4" />
               Export All Bug Reports
             </h3>
             <p className="text-xs text-gray-400 mt-0.5">
               Downloads all bug reports into one text file that opens directly in Notepad
             </p>
           </div>
           <button
             onClick={downloadAllBugsTXT}
             disabled={loadingAllReports}
             className="inline-flex items-center gap-2 rounded bg-gradient-to-r from-orange-600 to-red-600 px-4 py-2 text-xs font-bold text-white hover:from-orange-700 hover:to-red-700 disabled:opacity-50"
           >
             {loadingAllReports ? (
               <>
                 <Loader2 className="h-3 w-3 animate-spin" />
                 Generating...
               </>
             ) : (
               <>
                 <FileDown className="h-3 w-3" />
                 Download All (.TXT)
               </>
             )}
</button>
          </div>
        </div>

        {/* Delete All Bug Reports Button */}
        <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete All Bug Reports
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Permanently deletes all bug reports matching current filters
              </p>
            </div>
            <button
              onClick={deleteAllBugs}
              disabled={loadingAllReports}
              className="inline-flex items-center gap-2 rounded bg-gradient-to-r from-red-600 to-red-800 px-4 py-2 text-xs font-bold text-white hover:from-red-700 hover:to-red-900 disabled:opacity-50"
            >
              {loadingAllReports ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3" />
                  Delete All
                </>
              )}
            </button>
          </div>
        </div>

       <div className="grid grid-cols-2 gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value as BugStatus)} className="rounded bg-black/40 px-2 py-1 text-xs text-white border border-white/10">
          {statuses.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded bg-black/40 px-2 py-1 text-xs text-white border border-white/10">
          {sources.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded bg-black/40 px-2 py-1 text-xs text-white border border-white/10">
          {severities.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} placeholder="Route/page" className="rounded bg-black/40 px-2 py-1 text-xs text-white placeholder-gray-500 border border-white/10" />
        <input value={streamFilter} onChange={(e) => setStreamFilter(e.target.value)} placeholder="Stream ID" className="rounded bg-black/40 px-2 py-1 text-xs text-white placeholder-gray-500 border border-white/10" />
        <div className="flex items-center gap-1 rounded bg-black/40 px-2 py-1 border border-white/10">
          <Search className="h-3 w-3 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search error/code/table/function" className="w-full bg-transparent text-xs text-white placeholder-gray-500 outline-none" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="max-h-[360px] space-y-1 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-xs text-gray-500">Loading bugs...</div>
          ) : bugs.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">No bugs found</div>
          ) : bugs.map((bug) => (
            <button
              key={bug.id}
              onClick={() => setSelectedBug(bug)}
              className={`w-full rounded border px-2 py-2 text-left text-xs transition ${selectedBug?.id === bug.id ? 'border-red-400/50 bg-red-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white truncate">{bug.error_message}</span>
                <span className="shrink-0 rounded bg-black/30 px-1.5 py-0.5 text-[9px] uppercase text-gray-300">x{bug.occurrence_count || 1}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                <span>{bug.severity}</span>
                <span>{bug.source}</span>
                <span className="truncate">{bug.route_path}</span>
                <span className="ml-auto truncate text-cyan-300">{bug.username || bug.user_email || bug.user_id || 'unknown'}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="min-h-[320px] rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
          {selectedBug ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copyBug(selectedBug)} className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-2 py-1 text-blue-200 hover:bg-blue-500/30"><Clipboard className="h-3 w-3" /> Copy Debug Report</button>
                {isAdminOrCeo && (
                  <>
                    <button onClick={() => updateBug(selectedBug, 'in_progress')} className="rounded bg-amber-500/20 px-2 py-1 text-amber-200 hover:bg-amber-500/30">Mark In Progress</button>
                    <button onClick={() => updateBug(selectedBug, 'fixed')} className="inline-flex items-center gap-1 rounded bg-green-500/20 px-2 py-1 text-green-200 hover:bg-green-500/30"><CheckCircle2 className="h-3 w-3" /> Mark Fixed</button>
                    <button onClick={() => updateBug(selectedBug, 'ignored')} className="rounded bg-white/10 px-2 py-1 text-gray-200 hover:bg-white/15">Ignore</button>
                    <button onClick={() => deleteBug(selectedBug)} className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-red-200 hover:bg-red-500/30"><Trash2 className="h-3 w-3" /> Remove</button>
                  </>
                )}
              </div>

              {/* User Info Banner */}
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2">
                <div className="flex items-center gap-2 text-xs">
                  <User className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="font-bold text-cyan-100">
                    {selectedBug.username || selectedBug.user_email || selectedBug.user_id || 'Unknown User'}
                  </span>
                  {selectedBug.user_role && (
                    <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200">{selectedBug.user_role}</span>
                  )}
                  {selectedBug.user_email && selectedBug.username && (
                    <span className="text-gray-400">&lt;{selectedBug.user_email}&gt;</span>
                  )}
                </div>
                {selectedBug.page_url && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                    <span className="text-gray-500">Page:</span>
                    <span className="truncate text-cyan-300">{selectedBug.page_url}</span>
                  </div>
                )}
                {selectedBug.route_path && (
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-400">
                    <span className="text-gray-500">Route:</span>
                    <span className="text-gray-300">{selectedBug.route_path}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-gray-300">
                <div><span className="text-gray-500">Source:</span> {selectedBug.source}</div>
                <div><span className="text-gray-500">Severity:</span> {selectedBug.severity}</div>
                <div><span className="text-gray-500">Stream:</span> {selectedBug.stream_id || '-'}</div>
                <div><span className="text-gray-500">Table/Function:</span> {selectedBug.table_name || selectedBug.function_name || '-'}</div>
                <div><span className="text-gray-500">Code:</span> {selectedBug.error_code || '-'}</div>
                <div><span className="text-gray-500">Created:</span> {new Date(selectedBug.created_at).toLocaleString()}</div>
              </div>

              <div>
                <div className="mb-1 text-gray-500">Error Message</div>
                <pre className="max-h-24 overflow-auto rounded bg-black/50 p-2 text-red-100 whitespace-pre-wrap">{selectedBug.error_message}</pre>
              </div>
              {(selectedBug.error_details || selectedBug.error_hint) && (
                <div>
                  <div className="mb-1 text-gray-500">Details / Hint</div>
                  <pre className="max-h-24 overflow-auto rounded bg-black/50 p-2 text-gray-200 whitespace-pre-wrap">{[selectedBug.error_details, selectedBug.error_hint].filter(Boolean).join('\n')}</pre>
                </div>
              )}
              {selectedBug.stack_trace && (
                <div>
                  <div className="mb-1 text-gray-500">Stack</div>
                  <pre className="max-h-28 overflow-auto rounded bg-black/50 p-2 text-gray-300 whitespace-pre-wrap">{selectedBug.stack_trace}</pre>
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                <pre className="max-h-28 overflow-auto rounded bg-black/50 p-2 text-gray-300 whitespace-pre-wrap">{formatJson(selectedBug.request_payload) || 'No request payload'}</pre>
                <pre className="max-h-28 overflow-auto rounded bg-black/50 p-2 text-gray-300 whitespace-pre-wrap">{formatJson(selectedBug.response_payload) || 'No response payload'}</pre>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">Select a bug report</div>
          )}
        </div>
      </div>
    </div>
  );
}
