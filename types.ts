
export enum UserRole {
  ADMIN = 'ADMIN',
  WORKER = 'WORKER'
}

export enum JobStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  COMPLETED = 'COMPLETED'
}

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum NotificationType {
  NEW_EVENT = 'new_event',
  REMINDER = 'reminder'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role: UserRole;
  balance: number;
  avatar?: string;
  qrCode?: string;
  age?: number;
  experience?: number;
}

export interface Job {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  pay: number;
  maxWorkers: number;
  enrolledCount: number;
  status: JobStatus;
}

export interface Enrollment {
  id: string;
  userId: string;
  jobId: string;
  enrolledAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  status: WithdrawalStatus;
  createdAt: string;
}

export interface CMSPage {
  slug: string;
  title: string;
  content: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  event_id?: string;
  is_read: boolean;
  created_at: string;
}
