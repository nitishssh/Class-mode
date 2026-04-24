export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: number;
  userId: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  dueDate?: string | null;
  comments: number;
  attachments: number;
  createdAt: Date;
}

export interface CreateTaskInput {
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  tags?: string[];
  dueDate?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  tags?: string[];
  dueDate?: string | null;
}
