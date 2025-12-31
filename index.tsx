import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GoogleGenAI, Type } from '@google/genai';

// --- Types ---
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

// --- Helper Functions ---
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

// --- AI Service ---
const getGeminiInsights = async (tasks: Task[], logs: TimeLog[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const prompt = `Analyze this productivity data:
    Tasks: ${JSON.stringify(tasks.map(t => ({ title: t.title, status: t.status })))}
    Logs: ${JSON.stringify(logs.slice(0, 10))}
    Return a JSON with: score (0-100), summary (string), recommendations (string array), focusTitles (string array).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          focusTitles: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["score", "summary", "recommendations", "focusTitles"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

// --- UI Components ---

const Sidebar = ({ activeView, setView, xp }: { activeView: View, setView: (v: View) => void, xp: number }) => {
  const level = Math.floor(xp / 500) + 1;
  const progressToNext = Math.max(0, Math.min(100, ((xp % 500) / 500) * 100));
  const items = [
    { id: 'schedule', icon: 'fa-calendar-day', label: 'Blocks' },
    { id: 'planning', icon: 'fa-bullseye', label: 'Goals' },
    { id: 'tracker', icon: 'fa-stopwatch', label: 'Focus' },
    { id: 'dashboard', icon: 'fa-chart-simple', label: 'Stats' },
    { id: 'insights', icon: 'fa-microchip', label: 'AI' },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col h-screen sticky top-0 shrink-0 shadow-2xl">
      <div className="p-8">
        <div className="flex items-center space-x-3 mb-12">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-bolt"></i></div>
          <span className="text-xl font-black">Chronos<span className="text-indigo-400">Flow</span></span>
        </div>
        <nav className="space-y-2">
          {items.map(item => (
            <button key={item.id} onClick={() => setView(item.id as View)} className={`w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all ${activeView === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <i className={`fas ${item.icon} w-5`}></i>
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-auto p-8">
        <div className="bg-slate-800/50 p-6 rounded-[2rem] border border-slate-700/50">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Lvl {level}</span>
            <span className="text-indigo-400 font-black text-xs">{xp} XP</span>
          </div>
          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${progressToNext}%` }}></div>
          </div>
        </div>
      </div>
    </aside>
  );
};

// --- App Root ---

const App = () => {
  const [activeView, setActiveView] = useState<View>('schedule');
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('chronos_v9_tasks');
    if (saved) return JSON.parse(saved);
    const ex = getDailyExercises();
    return [
      { id: 't1', title: 'Morning Routine', priority: Priority.HIGH, status: 'todo', createdAt: Date.now(), scheduledBlock: { startHour: 5, startMinute: 30, durationHours: 2 }, subTasks: [{id:'s1', title:'Hanging', completed:false, xpValue:10},{id:'s2', title:'Breathing', completed:false, xpValue:10},{id:'s3', title:'Stretching', completed:false, xpValue:10}] },
      { id: 't2', title: 'Deep Work (1 Thing)', priority: Priority.HIGH, status: 'todo', createdAt: Date.now(), scheduledBlock: { startHour: 7, startMinute: 30, durationHours: 2 }, xpStakes: 100 },
      { id: 't3', title: 'Training', priority: Priority.MEDIUM, status: 'todo', createdAt: Date.now(), scheduledBlock: { startHour: 9, startMinute: 30, durationHours: 2 }, subTasks: [{id:'s4', title:ex[0], completed:false, xpValue:20},{id:'s5', title:ex[1], completed:false, xpValue:20}] }
    ];
  });
  const [logs, setLogs] = useState<TimeLog[]>(() => JSON.parse(localStorage.getItem('chronos_v9_logs') || '[]'));
  const [planning, setPlanning] = useState<PlanningTask[]>(() => JSON.parse(localStorage.getItem('chronos_v9_plan') || '[]'));

  useEffect(() => {
    localStorage.setItem('chronos_v9_tasks', JSON.stringify(tasks));
    localStorage.setItem('chronos_v9_logs', JSON.stringify(logs));
    localStorage.setItem('chronos_v9_plan', JSON.stringify(planning));
  }, [tasks, logs, planning]);

  const xp = useMemo(() => {
    return tasks.reduce((acc, t) => {
      if (t.xpStakes) return acc + (t.status === 'done' ? t.xpStakes : t.status === 'todo' ? -t.xpStakes : 0);
      const subXP = t.subTasks?.reduce((sAcc, st) => sAcc + (st.completed ? st.xpValue : 0), 0) || 0;
      const baseXP = t.status === 'done' ? 50 : t.status === 'partial' ? 20 : 0;
      return acc + subXP + baseXP;
    }, 0);
  }, [tasks]);

  const cycleStatus = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        const next: TaskStatus = t.status === 'todo' ? 'partial' : t.status === 'partial' ? 'done' : 'todo';
        return { ...t, status: next, subTasks: t.subTasks?.map(s => ({ ...s, completed: next === 'done' })) };
      }
      return t;
    }));
  };

  const toggleSub = (tid: string, sid: string) => {
    setTasks(tasks.map(t => t.id === tid ? { ...t, subTasks: t.subTasks?.map(s => s.id === sid ? { ...s, completed: !s.completed } : s) } : t));
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      <Sidebar activeView={activeView} setView={setActiveView} xp={xp} />
      <main className="flex-1 p-8 overflow-y-auto max-h-screen custom-scrollbar">
        <header className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight capitalize">{activeView} Protocol</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Velocity Engine v9.0</p>
          </div>
          <div className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl shadow-xl flex items-center space-x-3">
            <i className="fas fa-bolt text-amber-400"></i>
            <span className="font-black text-sm">{xp} XP</span>
          </div>
        </header>

        {activeView === 'schedule' && (
          <div className="space-y-6 animate-fade">
            {tasks.map(task => (
              <div key={task.id} className={`bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm flex flex-col border-l-8 ${task.xpStakes ? 'border-l-indigo-500' : 'border-l-slate-200'}`}>
                <div className="flex items-center p-8 justify-between">
                  <div className="flex items-center space-x-6">
                    <button onClick={() => cycleStatus(task.id)} className="text-4xl active:scale-75 transition-all">
                      <i className={`fas fa-circle-check ${task.status === 'done' ? 'text-emerald-500' : task.status === 'partial' ? 'text-amber-500' : 'text-slate-200'}`}></i>
                    </button>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-1">{task.scheduledBlock.startHour}:00 • {task.scheduledBlock.durationHours}H Block</div>
                      <h3 className={`text-xl font-black text-slate-800 ${task.status === 'done' ? 'line-through opacity-30' : ''}`}>{task.title}</h3>
                    </div>
                  </div>
                </div>
                {task.subTasks && (
                  <div className="px-8 pb-8 pt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {task.subTasks.map(s => (
                      <button key={s.id} onClick={() => toggleSub(task.id, s.id)} className={`p-4 rounded-3xl border transition-all flex flex-col items-center ${s.completed ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <i className={`fas ${s.completed ? 'fa-check-circle' : 'fa-circle'} mb-2`}></i>
                        <span className="text-[10px] font-black uppercase">{s.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeView === 'insights' && (
           <div className="bg-indigo-900 text-white p-12 rounded-[3rem] text-center shadow-2xl relative overflow-hidden">
              <i className="fas fa-brain text-5xl mb-6 text-indigo-400"></i>
              <h3 className="text-2xl font-black mb-4">AI Optimizer Ready</h3>
              <p className="opacity-70 text-sm max-w-sm mx-auto leading-relaxed">System is recording your blocks. Use focus mode to generate neural efficiency ratings.</p>
           </div>
        )}

        {activeView === 'tracker' && (
          <div className="max-w-xl mx-auto py-12">
            <div className="bg-slate-900 rounded-[3rem] p-12 text-center shadow-2xl">
              <div className="text-7xl font-black text-white mb-10 tabular-nums font-mono">00:00:00</div>
              <button className="w-24 h-24 rounded-full bg-white text-slate-900 flex items-center justify-center text-3xl shadow-xl active:scale-90 transition-all">
                <i className="fas fa-play ml-1"></i>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
