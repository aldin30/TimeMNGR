
export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export type TaskStatus = 'todo' | 'partial' | 'done';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  xpValue: number;
}

export interface PlanningTask {
  id: string;
  title: string;
  category: 'monthly' | 'weekly';
  completed: boolean;
  subTasks?: SubTask[]; // Added support for subtasks in planning
}

export interface TimeBlock {
  startHour: number; // 0-23
  startMinute: number; // 0-59
  durationHours: number; // e.g., 0.5, 2, 4.5
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: number;
  scheduledBlock?: TimeBlock;
  subTasks?: SubTask[];
  linkedPlanningTaskId?: string;
  xpStakes?: number; // +/- stakes for this block
}

export interface TimeLog {
  id: string;
  taskId: string;
  taskTitle: string;
  startTime: number;
  endTime: number;
  duration: number; // In seconds
}

export type View = 'dashboard' | 'schedule' | 'tracker' | 'insights' | 'planning';
