import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/root';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GoogleGenAI, Type } from '@google/genai';

// --- Types & Enums ---
enum Priority { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH' }
type TaskStatus = 'todo' | 'partial' | 'done';
type View = 'dashboard' | 'schedule' | 'tracker' | 'insights' | 'planning';

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  xpValue: number;
}

interface PlanningTask {
  id: string;
  title: string;
  category: 'monthly' | 'weekly';
  completed: boolean;
  subTasks?: SubTask[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: number;
  scheduledBlock: { startHour: number; startMinute: number; durationHours: number };
  subTasks?: SubTask[];
  linkedPlanningTaskId?: string;
  xpStakes?: number;
}

interface TimeLog {
  id: string;
  taskId: string;
  taskTitle: string;
  startTime: number;
  endTime: number;
  duration: number;
}

// --- Helper Data ---
const getDailyExercises = () => {
  const day = new Date().getDay();
  switch(day) {
    case 1: return ['Burpies', 'Pull ups'];
    case 2: return ['Push ups', 'Supermans'];
    case 3: return ['Squats', 'Face pulls'];
    case 4: return ['Pull ups', 'Push ups'];
    case 5: return ['Burpies', 'Supermans'];
    case 6: return ['Squats', 'Face pulls'];
    case 0: return ['Mobility Flow', 'Deep Stretching'];
    default: return ['Exercise A', 'Exercise B'];
  }
};

// --- Sub-Components ---

const Sidebar = ({ activeView, setView, xp }: { activeView: View, setView: (v: View) => void, xp: number }) => {
  const level = Math.floor(xp / 500) + 1;
  const progressToNext = ((xp % 500) / 500) * 100;
  const items = [
    { id: 'schedule', icon: 'fa-calendar-day', label: 'Blocks' },
    { id: 'planning', icon: 'fa-bullseye', label: 'Goals' },
    { id: 'tracker', icon: 'fa-stopwatch', label: 'Focus' },
    { id: 'dashboard', icon: 'fa-chart-simple', label: 'Stats' },
    { id: 'insights', icon: 'fa-microchip', label: 'AI' },
  ];

  return (
    <>
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col h-screen sticky top-0 shrink-0 shadow-2xl">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-bolt"></i></div>
            <span className="text-xl font-black">Chronos<span className="text-indigo-400">Flow</span></span>
          </div>
          <nav className="space-y-1.5">
            {items.map(item => (
              <button key={item.id} onClick={() => setView(item.id as View)} className={`w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all ${activeView === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                <i className={`fas ${item.icon} w-5`}></i>
                <span className="font-bold text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6">
          <div className="bg-slate-800/50 p-5 rounded-3xl border border-slate-700/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Lvl {level}</span>
              <span className="text-indigo-400 font-black text-[10px]">{xp} XP</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${progressToNext}%` }}></div>
            </div>
          </div>
        </div>
      </aside>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6">
        <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl flex items-center justify-around p-2 shadow-2xl border border-white/10">
          {items.map(item => (
            <button key={item.id} onClick={() => setView(item.id as View)} className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all ${activeView === item.id ? 'bg-indigo-600 text-white shadow-lg -translate-y-2' : 'text-slate-400'}`}>
              <i className={`fas ${item.icon} text-lg mb-1`}></i>
              <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};

// --- Main Application ---

const App = () => {
  const [activeView, setActiveView] = useState<View>('schedule');
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('chronos_tasks_v8');
    if (saved) return JSON.parse(saved);
    
    // Initial Routine Setup
    const ex = getDailyExercises();
    const defaults = [
      { title: 'Morning Routine', h: 5, m: 30, d: 2, p: Priority.HIGH, subs: ['Hanging', 'Stretching', 'Breathing', 'Make Bed', 'BMCJJ'] },
      { title: '1 Thing (Deepwork)', h: 7, m: 30, d: 2, p: Priority.HIGH, stakes: 100 },
      { title: 'Training', h: 9, m: 30, d: 2, p: Priority.MEDIUM, subs: ['Steps', 'Core', 'Cardio', ex[0], ex[1]] },
      { title: 'Education', h: 18, m: 30, d: 1, p: Priority.MEDIUM, stakes: 50 },
      { title: 'Night Routine', h: 22, m: 0, d: 0.5, p: Priority.MEDIUM, subs: ['Review day', 'Plan tomorrow', 'Bed time'] },
    ];

    return defaults.map((item, idx) => ({
      id: `task-${idx}-${Date.now()}`,
      title: item.title,
      description: '',
      priority: item.p,
      status: 'todo' as TaskStatus,
      createdAt: Date.now(),
      scheduledBlock: { startHour: item.h, startMinute: item.m, durationHours: item.d },
      xpStakes: item.stakes,
      subTasks: item.subs?.map(s => ({ id: crypto.randomUUID(), title: s, completed: false, xpValue: 10 }))
    }));
  });

  const [logs, setLogs] = useState<TimeLog[]>(() => JSON.parse(localStorage.getItem('chronos_logs_v8') || '[]'));
  const [planning, setPlanning] = useState<PlanningTask[]>(() => JSON.parse(localStorage.getItem('chronos_planning_v8') || '[]'));

  useEffect(() => {
    localStorage.setItem('chronos_tasks_v8', JSON.stringify(tasks));
    localStorage.setItem('chronos_logs_v8', JSON.stringify(logs));
    localStorage.setItem('chronos_planning_v8', JSON.stringify(planning));
  }, [tasks, logs, planning]);

  const xp = useMemo(() => {
    return tasks.reduce((acc, task) => {
      let taskXP = 0;
      if (task.xpStakes) {
        if (task.status === 'done') taskXP = task.xpStakes;
        else if (task.status === 'todo') taskXP = -task.xpStakes;
      } else if (task.subTasks) {
        const comp = task.subTasks.filter(s => s.completed).length;
        taskXP = comp * 10;
        if (comp === task.subTasks.length) taskXP += 25;
      } else {
        if (task.status === 'done') taskXP = 50;
        else if (task.status === 'partial') taskXP = 20;
      }
      return acc + taskXP;
    }, 0);
  }, [tasks]);

  const toggleSub = (tid: string, sid: string) => {
    setTasks(tasks.map(t => {
      if (t.id === tid) {
        const subs = t.subTasks?.map(s => s.id === sid ? { ...s, completed: !s.completed } : s);
        const allDone = subs?.every(s => s.completed);
        const someDone = subs?.some(s => s.completed);
        return { ...t, subTasks: subs, status: allDone ? 'done' : someDone ? 'partial' : 'todo' };
      }
      return t;
    }));
  };

  const cycleStatus = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        const next: TaskStatus = t.status === 'todo' ? 'partial' : t.status === 'partial' ? 'done' : 'todo';
        return { ...t, status: next, subTasks: t.subTasks?.map(s => ({ ...s, completed: next === 'done' })) };
      }
      return t;
    }));
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar activeView={activeView} setView={setActiveView} xp={xp} />
      <main className="flex-1 overflow-y-auto max-h-screen custom-scrollbar pb-32 md:pb-8">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight capitalize">{activeView === 'schedule' ? 'Block Protocol' : activeView}</h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1 opacity-60">System Core v8.0</p>
            </div>
            <div className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl shadow-xl flex items-center space-x-3 w-full sm:w-auto justify-center">
              <i className="fas fa-bolt text-amber-400"></i>
              <span className="font-black text-sm">{xp} XP</span>
            </div>
          </header>

          {activeView === 'schedule' && (
            <div className="space-y-6 animate-fade">
              {tasks.map(task => (
                <div key={task.id} className={`bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm flex flex-col border-l-8 ${task.xpStakes ? 'border-l-indigo-500' : 'border-l-slate-200'}`}>
                  <div className="flex items-center p-6 justify-between">
                    <div className="flex items-center space-x-6">
                      <button onClick={() => cycleStatus(task.id)} className="text-3xl active:scale-75 transition-all">
                        <i className={`fas fa-circle-check ${task.status === 'done' ? 'text-emerald-500' : task.status === 'partial' ? 'text-amber-500' : 'text-slate-200'}`}></i>
                      </button>
                      <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tabular-nums mb-1">
                          {task.scheduledBlock.startHour.toString().padStart(2, '0')}:00 • {task.scheduledBlock.durationHours}H
                        </div>
                        <h3 className={`text-xl font-black text-slate-800 ${task.status === 'done' ? 'line-through opacity-30' : ''}`}>{task.title}</h3>
                        {task.xpStakes && <div className="text-[9px] font-black text-indigo-500 uppercase mt-1">+/- {task.xpStakes} XP Stake</div>}
                      </div>
                    </div>
                    <button onClick={() => setTasks(tasks.filter(t => t.id !== task.id))} className="text-slate-200 hover:text-rose-500"><i className="fas fa-trash-alt"></i></button>
                  </div>
                  {task.subTasks && task.subTasks.length > 0 && (
                    <div className="px-6 pb-6 pt-2 grid grid-cols-2 md:grid-cols-5 gap-2">
                      {task.subTasks.map(s => (
                        <button key={s.id} onClick={() => toggleSub(task.id, s.id)} className={`p-3 rounded-2xl border transition-all flex flex-col items-center ${s.completed ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                          <i className={`fas ${s.completed ? 'fa-check-circle' : 'fa-circle'} mb-1`}></i>
                          <span className="text-[9px] font-black uppercase text-center line-clamp-1">{s.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeView === 'dashboard' && (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Efficiency Rating</div>
                   <div className="text-4xl font-black text-indigo-600">{tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0}%</div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current XP</div>
                   <div className="text-4xl font-black text-emerald-500">{xp}</div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Focus Hours</div>
                   <div className="text-4xl font-black text-slate-900">{Math.round(logs.reduce((a, b) => a + b.duration, 0) / 3600)}h</div>
                </div>
             </div>
          )}

          {activeView === 'planning' && (
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm animate-fade">
              <h2 className="text-2xl font-black mb-8">Mission Matrix</h2>
              <div className="flex space-x-3 mb-10">
                <input id="p-in" className="flex-1 bg-slate-50 rounded-2xl px-6 py-4 font-bold outline-none border-2 border-transparent focus:border-indigo-100" placeholder="New objective..." />
                <button onClick={() => {
                  const el = document.getElementById('p-in') as HTMLInputElement;
                  if (el.value) setPlanning([...planning, { id: crypto.randomUUID(), title: el.value, category: 'weekly', completed: false }]);
                  el.value = '';
                }} className="bg-slate-900 text-white px-10 rounded-2xl font-black text-sm uppercase">Deploy</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {planning.map(p => (
                  <div key={p.id} className="p-6 bg-slate-50 rounded-3xl flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-indigo-50">
                    <span className="font-bold text-slate-800">{p.title}</span>
                    <button onClick={() => setPlanning(planning.filter(x => x.id !== p.id))} className="text-slate-200 hover:text-rose-500"><i className="fas fa-times-circle text-lg"></i></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'insights' && (
             <div className="bg-indigo-900 text-white p-12 rounded-[3rem] text-center animate-fade shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <i className="fas fa-brain text-5xl mb-6 text-indigo-400"></i>
                <h3 className="text-2xl font-black mb-4">Neural Optimizer Ready</h3>
                <p className="opacity-70 text-sm max-w-sm mx-auto leading-relaxed">System is analyzing your Protocol Blocks. Track focus sessions to unlock organizational depth and efficiency ratings.</p>
             </div>
          )}
          
          {activeView === 'tracker' && (
             <div className="max-w-xl mx-auto py-10 animate-fade">
                <div className="bg-slate-900 rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
                   <div className="text-7xl font-black text-white mb-10 tabular-nums mono tracking-tighter" style={{ fontFamily: 'JetBrains Mono' }}>00:00:00</div>
                   <div className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-10">Select Block to Sync Focus</div>
                   <div className="flex justify-center">
                      <button className="w-24 h-24 rounded-full bg-white text-slate-900 flex items-center justify-center text-3xl shadow-white/10 shadow-2xl active:scale-90 transition-all">
                         <i className="fas fa-play ml-1"></i>
                      </button>
                   </div>
                </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);