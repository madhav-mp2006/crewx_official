
import { supabase } from './supabase';
import { User, Job, Enrollment, WithdrawalRequest, UserRole, JobStatus, WithdrawalStatus, AppNotification, NotificationType } from './types';

// Helper to map DB Job to Frontend Job
const mapJob = (j: any): Job => ({
  id: j.id,
  title: j.title,
  date: j.date,
  time: j.time,
  location: j.location,
  pay: j.pay,
  maxWorkers: j.max_workers ?? j.maxWorkers ?? 0,
  enrolledCount: j.enrolled_count ?? j.enrolledCount ?? 0,
  status: j.status as JobStatus
});

// Helper to map DB Withdrawal to Frontend Withdrawal
const mapWithdrawal = (w: any): WithdrawalRequest => ({
  id: w.id,
  userId: w.user_id ?? w.userId,
  amount: w.amount,
  status: w.status as WithdrawalStatus,
  createdAt: w.created_at ?? w.createdAt
});

// Helper to map DB Enrollment to Frontend Enrollment
const mapEnrollment = (e: any): Enrollment => ({
  id: e.id,
  userId: e.user_id ?? e.userId,
  jobId: e.job_id ?? e.jobId,
  enrolledAt: e.enrolled_at ?? e.enrolledAt
});

// Helper to map DB User to Frontend User
const mapUser = (u: any): User => ({
  id: u.id,
  name: u.name || '',
  email: u.email || '',
  password: u.password,
  phone: u.phone || '',
  role: (u.role?.toUpperCase() || UserRole.WORKER) as UserRole,
  balance: u.balance ?? 0,
  avatar: u.avatar,
  qrCode: u.qr_code ?? u.qrCode,
  age: u.age,
  experience: u.experience
});

const mapNotification = (n: any): AppNotification => ({
  id: n.id,
  user_id: n.user_id,
  title: n.title,
  message: n.message,
  type: n.type as NotificationType,
  event_id: n.event_id,
  is_read: n.is_read,
  created_at: n.created_at
});

export const db = {
  // Workers/Users
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('workers').select('*');
    if (error) throw error;
    return (data || []).map(mapUser);
  },
  getUserByEmail: async (email: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? mapUser(data) : null;
  },
  saveUser: async (user: User) => {
    const dbUser: any = {
      id: user.id,
      name: user.name,
      email: user.email.toLowerCase().trim(),
      password: user.password,
      phone: user.phone,
      role: user.role,
      balance: user.balance,
      qr_code: user.qrCode,
      age: user.age,
      experience: user.experience
    };
    
    Object.keys(dbUser).forEach(key => dbUser[key] === undefined && delete dbUser[key]);
    
    const { error } = await supabase.from('workers').upsert(dbUser);
    if (error) throw error;
  },
  updateUser: async (userId: string, updates: Partial<User>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email.toLowerCase().trim();
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
    if (updates.qrCode !== undefined) dbUpdates.qr_code = updates.qrCode;
    if (updates.age !== undefined) dbUpdates.age = Number(updates.age);
    if (updates.experience !== undefined) dbUpdates.experience = Number(updates.experience);
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.password !== undefined) dbUpdates.password = updates.password;

    const { error } = await supabase.from('workers').update(dbUpdates).eq('id', userId);
    if (error) throw error;
  },
  deleteUser: async (userId: string) => {
    await supabase.from('enrollments').delete().eq('user_id', userId);
    await supabase.from('withdrawals').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('user_id', userId);
    const { error } = await supabase.from('workers').delete().eq('id', userId);
    if (error) throw error;
  },

  // Admin Authentication
  verifyAdmin: async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('admin_auth')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .eq('password', password.trim())
      .single();
    
    if (error || !data) return false;
    return true;
  },

  // Jobs
  getJobs: async (): Promise<Job[]> => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('date', { ascending: true });
    
    if (error) throw error;
    return (data || []).map(mapJob);
  },
  saveJob: async (job: Job) => {
    const dbJob = {
      id: job.id,
      title: job.title,
      date: job.date,
      time: job.time,
      location: job.location,
      pay: job.pay,
      maxWorkers: job.maxWorkers,
      enrolledCount: job.enrolledCount,
      status: job.status
    };
    const { error = null } = await supabase.from('jobs').upsert(dbJob);
    if (error) throw error;

    // BROADCAST NOTIFICATION
    const { data: workers } = await supabase
      .from('workers')
      .select('id')
      .eq('role', UserRole.WORKER);
    
    if (workers && workers.length > 0) {
      const notifications = workers.map(w => ({
        id: crypto.randomUUID(),
        user_id: w.id,
        title: "New Event Posted",
        message: `A new event '${job.title}' has been posted. Check it now.`,
        type: NotificationType.NEW_EVENT,
        event_id: job.id,
        is_read: false,
        created_at: new Date().toISOString()
      }));
      await supabase.from('notifications').insert(notifications);
    }
  },
  updateJob: async (jobId: string, updates: Partial<Job>) => {
    const dbUpdates: any = { ...updates };
    
    const { error } = await supabase.from('jobs').update(dbUpdates).eq('id', jobId);
    if (error) throw error;
  },
  deleteJob: async (jobId: string) => {
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) throw error;
  },

  // Enrollments
  getEnrollments: async (): Promise<Enrollment[]> => {
    const { data, error } = await supabase.from('enrollments').select('*');
    if (error) throw error;
    return (data || []).map(mapEnrollment);
  },
  saveEnrollment: async (enrollment: Omit<Enrollment, 'id'>) => {
    const dbEnrollment = {
      user_id: enrollment.userId,
      job_id: enrollment.jobId,
      enrolled_at: enrollment.enrolledAt
    };
    const { error = null } = await supabase.from('enrollments').insert(dbEnrollment);
    if (error) throw error;
  },
  deleteEnrollmentByUserAndJob: async (userId: string, jobId: string) => {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('user_id', userId)
      .eq('job_id', jobId);
    if (error) throw error;
  },
  deleteEnrollmentsByJob: async (jobId: string) => {
    const { error } = await supabase.from('enrollments').delete().eq('job_id', jobId);
    if (error) throw error;
  },

  // Withdrawals
  getWithdrawals: async (): Promise<WithdrawalRequest[]> => {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return (data || []).map(mapWithdrawal);
  },
  saveWithdrawal: async (withdrawal: WithdrawalRequest) => {
    const dbWithdrawal = {
      id: withdrawal.id,
      user_id: withdrawal.userId,
      amount: withdrawal.amount,
      status: withdrawal.status,
      created_at: withdrawal.createdAt
    };
    const { error = null } = await supabase.from('withdrawals').insert(dbWithdrawal);
    if (error) throw error;
  },
  updateWithdrawal: async (id: string, status: WithdrawalStatus) => {
    const { error } = await supabase.from('withdrawals').update({ status }).eq('id', id);
    if (error) throw error;
  },

  // Notifications
  getNotifications: async (userId: string): Promise<AppNotification[]> => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapNotification);
  },
  cleanupOldNotifications: async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { error } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());
    if (error) throw error;
  },
  markAllNotificationsRead: async (userId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);
    if (error) throw error;
  },
  markNotificationRead: async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) throw error;
  },
  deleteNotification: async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
