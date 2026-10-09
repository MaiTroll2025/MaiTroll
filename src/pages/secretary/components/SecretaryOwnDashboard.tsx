import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../lib/store';
import { toast } from 'sonner';
import {
  CheckSquare, Clock, AlertTriangle, ClipboardList, Crown,
  Calendar, FileText, Users, Plus, Trash2, ChevronRight
} from 'lucide-react';

interface SecretaryTask {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string | null;
  created_at: string;
}

export default function SecretaryOwnDashboard() {
  const { user, profile } = useAuthStore();
  const [tasks, setTasks] = useState<SecretaryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as SecretaryTask['priority'],
    due_date: '',
  });

  // Stats
  const [stats, setStats] = useState({
    openIntake: 0,
    criticalAlerts: 0,
    activeElections: 0,
    pendingTasks: 0,
  });

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('secretary_tasks')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet, that's ok
        if (error.code === '42P01') {
          setTasks([]);
          setLoading(false);
          return;
        }
        throw error;
      }
      setTasks(data || []);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      // Don't show error for missing table
      if (err.code !== '42P01') {
        toast.error('Failed to load tasks');
      }
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchStats = useCallback(async () => {
    try {
      const [intakeRes, alertsRes, electionsRes] = await Promise.all([
        supabase.from('executive_intake').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_review']),
        supabase.from('critical_alerts').select('id', { count: 'exact', head: true }).eq('resolved', false),
        supabase.from('president_elections').select('id', { count: 'exact', head: true }).in('status', ['draft', 'open']),
      ]);
      setStats({
        openIntake: intakeRes.count || 0,
        criticalAlerts: alertsRes.count || 0,
        activeElections: electionsRes.count || 0,
        pendingTasks: tasks.filter((t) => t.status !== 'completed').length,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [tasks]);

  useEffect(() => {
    void fetchTasks();
    void fetchStats();
  }, [fetchStats, fetchTasks]);

  const handleCreateTask = async () => {
    if (!user || !newTask.title) {
      toast.error('Please enter a task title');
      return;
    }

    try {
      const { error } = await supabase.from('secretary_tasks').insert({
        title: newTask.title,
        description: newTask.description || null,
        priority: newTask.priority,
        status: 'pending',
        due_date: newTask.due_date || null,
        created_by: user.id,
      });

      if (error) {
        if (error.code === '42P01') {
          toast.error('Secretary tasks table does not exist yet. Please run the migration.');
          return;
        }
        throw error;
      }

      toast.success('Task created');
      setShowNewTask(false);
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '' });
      fetchTasks();
    } catch (err: any) {
      console.error('Error creating task:', err);
      toast.error('Failed to create task: ' + err.message);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      const { error } = await supabase
        .from('secretary_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);
      if (error) throw error;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus as any } : t))
      );
    } catch (_err: any) {
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('secretary_tasks').delete().eq('id', taskId);
      if (error) throw error;
      toast.success('Task deleted');
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (_err: any) {
      toast.error('Failed to delete task');
    }
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-slate-700 text-slate-300',
    medium: 'bg-blue-900/50 text-blue-300',
    high: 'bg-orange-900/50 text-orange-300',
    urgent: 'bg-red-900/50 text-red-300',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Secretary Dashboard</h2>
        <p className="text-slate-400 mt-1">
          Welcome, {profile?.username || 'Secretary'} — your personal command center
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <ClipboardList className="w-5 h-5 text-blue-400 mb-2" />
          <div className="text-2xl font-bold text-white">{stats.openIntake}</div>
          <div className="text-xs text-slate-400">Open Intake</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-400 mb-2" />
          <div className="text-2xl font-bold text-white">{stats.criticalAlerts}</div>
          <div className="text-xs text-slate-400">Critical Alerts</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <Crown className="w-5 h-5 text-yellow-400 mb-2" />
          <div className="text-2xl font-bold text-white">{stats.activeElections}</div>
          <div className="text-xs text-slate-400">Active Elections</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <CheckSquare className="w-5 h-5 text-green-400 mb-2" />
          <div className="text-2xl font-bold text-white">{stats.pendingTasks}</div>
          <div className="text-xs text-slate-400">Pending Tasks</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-sm text-slate-300">
            <FileText className="w-4 h-4 text-blue-400" />
            New Intake
          </button>
          <button className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-sm text-slate-300">
            <Calendar className="w-4 h-4 text-purple-400" />
            Schedule Meeting
          </button>
          <button className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-sm text-slate-300">
            <Users className="w-4 h-4 text-green-400" />
            Staff Review
          </button>
          <button className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-sm text-slate-300">
            <Crown className="w-4 h-4 text-yellow-400" />
            Election Control
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-purple-400" />
            My Tasks
          </h3>
          <button
            onClick={() => setShowNewTask(!showNewTask)}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Task
          </button>
        </div>

        {showNewTask && (
          <div className="mb-4 p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-3">
            <input
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
            <textarea
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm h-16 focus:outline-none focus:border-purple-500"
              placeholder="Description (optional)"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
            <div className="flex gap-3">
              <select
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
              <input
                type="date"
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              />
              <button
                onClick={handleCreateTask}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tasks yet. Add your first task to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  task.status === 'completed'
                    ? 'bg-slate-800/50 border-slate-800 opacity-60'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <button
                  onClick={() => handleToggleTask(task.id, task.status)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    task.status === 'completed'
                      ? 'bg-green-600 border-green-600'
                      : 'border-slate-500 hover:border-purple-400'
                  }`}
                >
                  {task.status === 'completed' && (
                    <CheckSquare className="w-3 h-3 text-white" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-white'}`}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-xs text-slate-500 truncate">{task.description}</div>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                  {task.priority}
                </span>
                {task.due_date && (
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {task.due_date}
                  </span>
                )}
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity / Notes */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Implementation Notes
        </h3>
        <p className="text-sm text-slate-400 mb-3">
          Use this space to track what needs to be implemented or reviewed.
        </p>
        <div className="space-y-2 text-sm text-slate-500">
          <div className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg">
            <ChevronRight className="w-4 h-4 mt-0.5 text-purple-400 flex-shrink-0" />
            <span>Executive Reports now route to CEO Assistant and Noah Assistant dashboards</span>
          </div>
          <div className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg">
            <ChevronRight className="w-4 h-4 mt-0.5 text-purple-400 flex-shrink-0" />
            <span>Staff Management reads from real <code className="text-purple-300">role</code> column — admins can be promoted to lead</span>
          </div>
          <div className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg">
            <ChevronRight className="w-4 h-4 mt-0.5 text-purple-400 flex-shrink-0" />
            <span>Elections show candidates, votes, and approval controls</span>
          </div>
          <div className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg">
            <ChevronRight className="w-4 h-4 mt-0.5 text-purple-400 flex-shrink-0" />
            <span>Calendar writes to Tromail calendar events for meeting scheduling</span>
          </div>
          <div className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg">
            <ChevronRight className="w-4 h-4 mt-0.5 text-purple-400 flex-shrink-0" />
            <span>Empire Partner Program removed from secretary panel</span>
          </div>
        </div>
      </div>
    </div>
  );
}
