import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GoogleGenAI, Type } from '@google/genai';

// --- Types & Interfaces ---
enum Priority { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH' }
type TaskStatus = 'todo' | 'partial' | 'done';
type View = 'dashboard' | 'schedule' | 'tracker' | 'insights' | 'planning' | 'shop';

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  xpValue: number;
}

interface Reward {
  id: string;
  title: string;
  cost: number;
  icon: string;
  count: number;
}

interface PlanningTask {
  id: string;
  title: string;
  category: 'monthly' | 'weekly';
  completed: boolean;
  subTasks: SubTask[];
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
  duration: number; // seconds
}

// --- Helper Data & Logic ---
const getDailyExercises = () => {
  const day = new Date().getDay();
  switch(day) {
    case 1: return ['Burpies', 'Pull ups'];
    case 2: return ['Push ups', 'Supermans'];
    case 3: return ['Squats', 'Face pulls'];
    case 4: return ['Pull ups', 'Push ups'];
    case 5: return ['Burpies', 'Supermans'];
    case 6: return ['Squats', 'Face pulls'];
    default: return ['Mobility Flow', 'Stretching'];
  }
};

const formatTime = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatHour = (h: number, m: number) => {
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
};

// --- Sub-Components ---

const Sidebar = ({ activeView, setView, xp, multipliers, balance }: { activeView: View, setView: (v: View) => void, xp: number, multipliers: { focus: number, adherence: number }, balance: number }) => {
  const level = Math.floor(xp / 500) + 1;
  const progress = Math.max(0, Math.min(100, ((xp % 500) / 500) * 100));
  const nav = [
    { id: 'schedule', icon: 'fa-calendar-day', label: 'Protocol' },
    { id: 'planning', icon: 'fa-bullseye', label: 'Mission' },
    { id: 'tracker', icon: 'fa-stopwatch', label: 'Focus' },
    { id: 'shop', icon: 'fa-gem', label: 'Vault' },
    { id: 'dashboard', icon: 'fa-chart-simple', label: 'Stats' },
    { id: 'insights', icon: 'fa-microchip', label: 'AI Core' },
  ];

  return (
    <>
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col h-screen sticky top-0 shrink-0 shadow-2xl">
        <div className="p-8">
          <div className="flex items-center space-x-3 mb-12">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-bolt"></i></div>
            <span className="text-xl font-black tracking-tight">Chronos<span className="text-indigo-400">Flow</span></span>
          </div>
          <nav className="space-y-2">
            {nav.map(item => (
              <button key={item.id} onClick={() => setView(item.id as View)} className={`w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all ${activeView === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                <i className={`fas ${item.icon} w-5 text-center`}></i>
                <span className="font-bold text-sm tracking-wide">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-8">
          <div className="bg-slate-800/50 p-6 rounded-[2rem] border border-slate-700/50 group relative">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Rank: {level}</span>
              <span className="text-indigo-400 font-black text-xs">{balance} XP Bal</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="absolute bottom-full left-0 w-full mb-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl shadow-2xl text-[10px] space-y-2">
                <div className="flex justify-between font-black uppercase tracking-widest text-slate-400">
                  <span>Lifetime XP</span>
                  <span className="text-white">{xp}</span>
                </div>
                <div className="flex justify-between font-black uppercase tracking-widest text-slate-400">
                  <span>Adherence Buff</span>
                  <span className={multipliers.adherence > 1 ? 'text-emerald-400' : ''}>x{multipliers.adherence.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2">
        <div className="glass-morphism rounded-[2rem] flex items-center justify-around p-2 shadow-2xl">
          {nav.map(item => (
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

// --- Main App Controller ---

const App = () => {
  const [activeView, setActiveView] = useState<View>('schedule');
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('chronos_v15_tasks');
    if (saved) return JSON.parse(saved);
    const ex = getDailyExercises();
    return [
      { id: 't1', title: 'Morning Routine', priority: Priority.HIGH, status: 'todo', createdAt: Date.now(), scheduledBlock: { startHour: 5, startMinute: 30, durationHours: 2 }, subTasks: [
        {id:'mr1', title:'Hanging', completed:false, xpValue:10},
        {id:'mr2', title:'Stretching', completed:false, xpValue:10},
        {id:'mr3', title:'Breathing', completed:false, xpValue:10},
        {id:'mr4', title:'Make Bed', completed:false, xpValue:10},
        {id:'mr5', title:'BMCJJ', completed:false, xpValue:10}
      ]},
      { id: 't2', title: '1 Thing (Deepwork)', priority: Priority.HIGH, status: 'todo', createdAt: Date.now(), scheduledBlock: { startHour: 7, startMinute: 30, durationHours: 2 }, xpStakes: 100 },
      { id: 't3', title: 'Training', priority: Priority.MEDIUM, status: 'todo', createdAt: Date.now(), scheduledBlock: { startHour: 9, startMinute: 30, durationHours: 2 }, subTasks: [
        {id:'tr1', title:'Steps', completed:false, xpValue:10},
        {id:'tr2', title:'Core', completed:false, xpValue:10},
        {id:'tr3', title:'Cardio', completed:false, xpValue:10},
        {id:'tr4', title:ex[0], completed:false, xpValue:10},
        {id:'tr5', title:ex[1], completed:false, xpValue:10}
      ]},
      { id: 't4', title: 'B Side (Deepwork)', priority: Priority.HIGH, status: 'todo', createdAt: Date.now(), scheduledBlock: { startHour: 11, startMinute: 30, durationHours: 2 }, xpStakes: 75 },
      { id: 't5', title: 'Free Time', priority: Priority.LOW, status: 'todo', createdAt: Date.now(), scheduledBlock: { startHour: 13, startMinute: 30, durationHours: 4.5 } },
      { id: 't8', title: 'Night Routine', priority: Priority.MEDIUM, status: 'todo', createdAt: Date.now(), scheduledBlock: { startHour: 22, startMinute: 0, durationHours: 0.5 }, subTasks: [
        {id:'nr1', title:'Review Day', completed:false, xpValue:20},
        {id:'nr2', title:'Plan Tomorrow', completed:false, xpValue:20},
        {id:'nr3', title:'Bed time', completed:false, xpValue:20}
      ]}
    ];
  });
  const [planning, setPlanning] = useState<PlanningTask[]>(() => {
    const saved = localStorage.getItem('chronos_v15_plan');
    return saved ? JSON.parse(saved) : [];
  });
  const [rewards, setRewards] = useState<Reward[]>(() => {
    const saved = localStorage.getItem('chronos_v15_rewards');
    return saved ? JSON.parse(saved) : [
      { id: 'r1', title: 'Gourmet Coffee', cost: 100, icon: 'fa-coffee', count: 0 },
      { id: 'r2', title: '1 Hour Gaming', cost: 250, icon: 'fa-gamepad', count: 0 },
      { id: 'r3', title: 'Amazon Luxury Purchase', cost: 1000, icon: 'fa-shopping-cart', count: 0 }
    ];
  });
  const [spentXP, setSpentXP] = useState<number>(() => {
    return parseInt(localStorage.getItem('chronos_v15_spent') || '0');
  });
  const [logs, setLogs] = useState<TimeLog[]>(() => JSON.parse(localStorage.getItem('chronos_v15_logs') || '[]'));

  // Timer State
  const [timerTaskId, setTimerTaskId] = useState<string>('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerIntervalRef = useRef<number | null>(null);
  const timerStartRef = useRef<number>(0);

  // Modals
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [isAddingReward, setIsAddingReward] = useState(false);

  useEffect(() => {
    localStorage.setItem('chronos_v15_tasks', JSON.stringify(tasks));
    localStorage.setItem('chronos_v15_plan', JSON.stringify(planning));
    localStorage.setItem('chronos_v15_logs', JSON.stringify(logs));
    localStorage.setItem('chronos_v15_rewards', JSON.stringify(rewards));
    localStorage.setItem('chronos_v15_spent', spentXP.toString());
  }, [tasks, planning, logs, rewards, spentXP]);

  // --- REWARD SYSTEM ENGINE ---
  const { totalXP, activeMultipliers } = useMemo(() => {
    let rawXP = 0;
    tasks.forEach(t => {
      let taskBase = 0;
      if (t.xpStakes) {
        if (t.status === 'done') taskBase = t.xpStakes;
        else if (t.status === 'todo') taskBase = -t.xpStakes;
      } else if (t.subTasks) {
        const completedCount = t.subTasks.filter(st => st.completed).length;
        if (t.title === 'Night Routine') {
          taskBase = completedCount * 20 + (completedCount === t.subTasks.length ? 40 : 0) - (completedCount === 0 ? 50 : 0);
        } else if (t.title === 'Morning Routine' || t.title === 'Training') {
          taskBase = completedCount * 10 + (completedCount === t.subTasks.length ? 25 : 0) - (completedCount === 0 ? 25 : 0);
        } else {
          taskBase = completedCount * 10;
        }
      } else {
        if (t.status === 'done') taskBase += 50;
        if (t.status === 'partial') taskBase += 20;
      }
      if (taskBase > 0 && t.status === 'done') {
        if (t.priority === Priority.HIGH) taskBase *= 1.2;
        else if (t.priority === Priority.LOW) taskBase *= 0.8;
      }
      rawXP += taskBase;
    });

    const totalFocusSeconds = logs.reduce((acc, l) => acc + l.duration, 0);
    const focusBonus = Math.floor(totalFocusSeconds / 1800) * 5;
    const adherenceRate = tasks.length > 0 ? tasks.filter(t => t.status === 'done').length / tasks.length : 0;
    const adherenceMultiplier = adherenceRate >= 0.8 ? 1.1 : 1.0;
    const finalXP = Math.round((rawXP + focusBonus) * adherenceMultiplier);

    return { totalXP: Math.max(0, finalXP), activeMultipliers: { focus: focusBonus, adherence: adherenceMultiplier } };
  }, [tasks, logs]);

  const currentBalance = totalXP - spentXP;

  // --- ACTIONS ---

  const buyReward = (id: string) => {
    const r = rewards.find(x => x.id === id);
    if (r && currentBalance >= r.cost) {
      setSpentXP(prev => prev + r.cost);
      setRewards(prev => prev.map(x => x.id === id ? { ...x, count: x.count + 1 } : x));
    }
  };

  const addReward = (title: string, cost: number, icon: string) => {
    setRewards([...rewards, { id: crypto.randomUUID(), title, cost, icon, count: 0 }]);
    setIsAddingReward(false);
  };

  const cycleStatus = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const next: TaskStatus = t.status === 'todo' ? 'partial' : t.status === 'partial' ? 'done' : 'todo';
        return { ...t, status: next, subTasks: t.subTasks?.map(s => ({ ...s, completed: next === 'done' })) };
      }
      return t;
    }));
  };

  const toggleSub = (tid: string, sid: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === tid) {
        const nextSubs = t.subTasks?.map(s => s.id === sid ? { ...s, completed: !s.completed } : s);
        const allDone = nextSubs?.every(s => s.completed);
        const someDone = nextSubs?.some(s => s.completed);
        return { ...t, subTasks: nextSubs, status: allDone ? 'done' : someDone ? 'partial' : 'todo' };
      }
      return t;
    }));
  };

  const startTimer = () => {
    if (!timerTaskId) return;
    timerStartRef.current = Date.now();
    setTimerRunning(true);
    timerIntervalRef.current = window.setInterval(() => setTimerSeconds(s => s + 1), 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const task = tasks.find(t => t.id === timerTaskId);
    if (task && timerSeconds > 0) {
      setLogs(prev => [{ id: crypto.randomUUID(), taskId: task.id, taskTitle: task.title, startTime: timerStartRef.current, endTime: Date.now(), duration: timerSeconds }, ...prev]);
    }
    setTimerRunning(false);
    setTimerSeconds(0);
  };

  const chartData = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const hours = logs.filter(l => new Date(l.startTime).toDateString() === d.toDateString()).reduce((acc, l) => acc + (l.duration / 3600), 0);
      result.push({ name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()], hours: parseFloat(hours.toFixed(1)) });
    }
    return result;
  }, [logs]);

  // AI Core Sync
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const syncAI = async () => {
    setAiLoading(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze protocol: ${JSON.stringify(tasks.map(t=>t.title))}. XP: ${totalXP}. Spent: ${spentXP}.`,
        config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING }, recommendations: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['score', 'summary', 'recommendations'] } }
      });
      setAiResult(JSON.parse(resp.text || '{}'));
    } catch(e) { console.error(e); }
    setAiLoading(false);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      <Sidebar activeView={activeView} setView={setActiveView} xp={totalXP} multipliers={activeMultipliers} balance={currentBalance} />
      <main className="flex-1 p-4 md:p-10 overflow-y-auto max-h-screen custom-scrollbar pb-32 md:pb-10">
        <header className="mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight capitalize">{activeView} Protocol</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Chronos Efficiency Engine v15.0</p>
          </div>
          <div className="flex items-center space-x-4">
             <div className="bg-white px-8 py-3 rounded-2xl shadow-xl flex items-center space-x-4 border border-slate-100">
               <i className="fas fa-wallet text-indigo-500 text-xl"></i>
               <span className="font-black text-lg tracking-wider tabular-nums">{currentBalance} XP</span>
             </div>
             <div className="bg-slate-900 text-white px-8 py-3 rounded-2xl shadow-2xl flex items-center space-x-4 border border-white/5">
               <i className="fas fa-bolt text-amber-400 text-xl"></i>
               <span className="font-black text-lg tracking-wider tabular-nums">{totalXP} XP</span>
             </div>
          </div>
        </header>

        {activeView === 'schedule' && (
          <div className="space-y-6 animate-fade">
            {tasks.map(task => (
              <div key={task.id} className={`bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm flex flex-col border-l-[10px] transition-all hover:shadow-md ${task.xpStakes ? 'border-l-indigo-600' : 'border-l-slate-200'}`}>
                <div className="flex flex-col sm:flex-row items-stretch">
                  <div className="w-full sm:w-36 bg-slate-50/50 p-6 flex flex-row sm:flex-col items-center justify-between sm:justify-center sm:border-r border-slate-100">
                    <span className="text-xs font-black text-slate-900 tabular-nums tracking-widest">{formatHour(task.scheduledBlock.startHour, task.scheduledBlock.startMinute)}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">{task.scheduledBlock.durationHours}H Block</span>
                  </div>
                  <div className="flex-1 p-8 flex items-center justify-between">
                    <div className="flex items-center space-x-8">
                      <button onClick={() => cycleStatus(task.id)} className="text-5xl active:scale-75 transition-all outline-none">
                        <i className={`fas fa-circle-check ${task.status === 'done' ? 'text-emerald-500' : task.status === 'partial' ? 'text-amber-500' : 'text-slate-200'}`}></i>
                      </button>
                      <div>
                        <h3 className={`text-2xl font-black text-slate-800 tracking-tight ${task.status === 'done' ? 'line-through opacity-30' : ''}`}>{task.title}</h3>
                        <div className="flex items-center space-x-3 mt-2">
                           {task.xpStakes && <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">+/- {task.xpStakes} XP Stake</span>}
                           {task.priority === Priority.HIGH && <span className="text-[10px] text-rose-500 font-black uppercase tracking-widest"><i className="fas fa-fire mr-1 text-xs"></i> 1.2x Multiplier</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {task.subTasks && (
                  <div className="px-8 pb-8 pt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {task.subTasks.map(s => (
                      <button key={s.id} onClick={() => toggleSub(task.id, s.id)} className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center justify-center text-center group ${s.completed ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-200'}`}>
                        <i className={`fas ${s.completed ? 'fa-check-circle' : 'fa-circle'} mb-2 text-lg group-active:scale-90 transition-transform`}></i>
                        <span className="text-[10px] font-black uppercase tracking-tight">{s.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeView === 'planning' && (
          <div className="space-y-12 animate-fade max-w-5xl mx-auto">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
              <h2 className="text-xl font-black mb-10 uppercase tracking-[0.3em] text-slate-400">Strategic Objectives</h2>
              <div className="flex flex-col md:flex-row gap-4">
                <input id="planInput" className="flex-1 bg-slate-50 rounded-2xl px-8 py-5 font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" placeholder="Enter goal..." />
                <button onClick={() => {
                  const input = document.getElementById('planInput') as HTMLInputElement;
                  if (input.value) setPlanning([{ id: crypto.randomUUID(), title: input.value, category: 'weekly', completed: false, subTasks: [] }, ...planning]);
                  input.value = '';
                }} className="bg-slate-900 text-white px-10 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all">Deploy Mission</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {planning.map(p => (
                <div key={p.id} className={`bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative group transition-all hover:border-indigo-100 ${p.completed ? 'opacity-40 grayscale' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{p.category} mission</span>
                    <button onClick={() => setPlanning(planning.filter(x => x.id !== p.id))} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><i className="fas fa-times-circle text-xl"></i></button>
                  </div>
                  <h4 className="text-2xl font-black text-slate-800 leading-tight">{p.title}</h4>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'shop' && (
          <div className="space-y-10 animate-fade">
             <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm mb-10">
               <div className="flex justify-between items-center mb-10">
                 <h2 className="text-xl font-black uppercase tracking-[0.3em] text-slate-400">The Vault</h2>
                 <button onClick={() => setIsAddingReward(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">Construct Reward</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {rewards.map(r => (
                   <div key={r.id} className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:border-indigo-100 group">
                     <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                       <i className={`fas ${r.icon} text-2xl`}></i>
                     </div>
                     <h4 className="text-2xl font-black text-slate-800 mb-2">{r.title}</h4>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">{r.cost} XP COST</p>
                     <div className="flex justify-between items-center">
                       <span className="text-xs font-black text-slate-300">Claimed: {r.count}</span>
                       <button 
                         onClick={() => buyReward(r.id)} 
                         disabled={currentBalance < r.cost}
                         className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${currentBalance >= r.cost ? 'bg-slate-900 text-white shadow-xl hover:-translate-y-1' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                       >
                         Claim
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        )}

        {activeView === 'tracker' && (
          <div className="max-w-2xl mx-auto py-12 animate-fade">
            <div className="bg-slate-900 rounded-[4rem] p-16 text-center shadow-[0_40px_80px_-15px_rgba(30,27,75,0.4)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full -mr-40 -mt-40 blur-3xl"></div>
              <div className="text-8xl font-black text-white mb-16 tabular-nums font-mono tracking-tighter" style={{ fontFamily: 'JetBrains Mono' }}>{formatTime(timerSeconds)}</div>
              <div className="mb-12">
                {timerRunning ? (
                  <div className="bg-white/10 text-white px-8 py-4 rounded-2xl font-black text-sm tracking-widest uppercase border border-white/10 animate-pulse">FOCUSING: {tasks.find(t=>t.id===timerTaskId)?.title}</div>
                ) : (
                  <select value={timerTaskId} onChange={e => setTimerTaskId(e.target.value)} className="w-full bg-slate-800 text-white px-8 py-5 rounded-2xl border border-slate-700 outline-none font-black text-center cursor-pointer hover:bg-slate-750 transition-colors uppercase tracking-widest text-xs">
                    <option value="">Select Target Block...</option>
                    {tasks.filter(t=>t.status!=='done').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                )}
              </div>
              <div className="flex justify-center space-x-8">
                {!timerRunning ? (
                  <button onClick={startTimer} disabled={!timerTaskId} className="w-28 h-28 rounded-full bg-indigo-600 text-white flex items-center justify-center text-4xl shadow-2xl shadow-indigo-600/40 disabled:opacity-20 active:scale-90 transition-all"><i className="fas fa-play ml-2"></i></button>
                ) : (
                  <button onClick={stopTimer} className="w-28 h-28 rounded-full bg-rose-600 text-white flex items-center justify-center text-4xl shadow-2xl shadow-rose-600/40 active:scale-90 transition-all"><i className="fas fa-stop"></i></button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeView === 'dashboard' && (
          <div className="space-y-10 animate-fade">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Total Focus Time</span>
                   <div className="text-5xl font-black text-slate-900 tabular-nums tracking-tighter">
                     {Math.floor(logs.reduce((a,b)=>a+b.duration,0)/3600)}<span className="text-2xl text-slate-300 ml-1 uppercase">h</span> {Math.floor((logs.reduce((a,b)=>a+b.duration,0)%3600)/60)}<span className="text-2xl text-slate-300 ml-1 uppercase">m</span>
                   </div>
                </div>
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Protocol Adherence</span>
                   <div className="text-5xl font-black text-indigo-600 tracking-tighter">
                     {tasks.length > 0 ? Math.round((tasks.filter(t=>t.status==='done').length/tasks.length)*100) : 0}%
                   </div>
                </div>
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">XP Velocity</span>
                   <div className="text-5xl font-black text-emerald-500 tabular-nums tracking-tighter">+{totalXP % 500}</div>
                </div>
             </div>
             <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm h-[450px]">
                <h3 className="text-sm font-black text-slate-900 mb-10 uppercase tracking-[0.3em]">Neural Efficiency History (7D)</h3>
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 800}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 800}} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="hours" radius={[12, 12, 0, 0]}>
                         {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 6 ? '#4f46e5' : '#e2e8f0'} />)}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        )}

        {/* --- MODALS --- */}
        {isAddingReward && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white rounded-[4rem] p-12 w-full max-w-lg shadow-2xl animate-in zoom-in-95">
               <h3 className="text-3xl font-black mb-8 tracking-tight text-slate-900 text-center">Construct Reward</h3>
               <div className="space-y-6">
                  <input id="rewTitle" placeholder="Reward Name..." className="w-full bg-slate-50 rounded-2xl px-8 py-5 font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
                  <input id="rewCost" type="number" placeholder="XP Cost..." className="w-full bg-slate-50 rounded-2xl px-8 py-5 font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
                  <select id="rewIcon" className="w-full bg-slate-50 rounded-2xl px-8 py-5 font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all">
                    <option value="fa-gamepad">Gaming</option>
                    <option value="fa-coffee">Coffee/Drink</option>
                    <option value="fa-shopping-cart">Purchase</option>
                    <option value="fa-bed">Sleep/Rest</option>
                    <option value="fa-pizza-slice">Treat Meal</option>
                  </select>
                  <button onClick={() => {
                    const t = (document.getElementById('rewTitle') as HTMLInputElement).value;
                    const c = parseInt((document.getElementById('rewCost') as HTMLInputElement).value);
                    const i = (document.getElementById('rewIcon') as HTMLSelectElement).value;
                    if (t && c) addReward(t, c, i);
                  }} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Register Upgrade</button>
                  <button onClick={() => setIsAddingReward(false)} className="w-full text-slate-400 font-black py-4 uppercase tracking-widest text-xs">Cancel</button>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
