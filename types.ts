
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

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  balance: number;
  avatar?: string;
  qrCode?: string; // Base64 string for QR code image
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
