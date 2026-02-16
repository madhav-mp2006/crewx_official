
import React, { useState, useEffect, useRef } from 'react';
import { User, Job, Enrollment, UserRole, JobStatus, WithdrawalStatus, WithdrawalRequest, AppView } from './types';
import { db } from './db';
import { Icons, APP_NAME } from './constants';
import { supabase } from './supabase';

// --- Shared Components ---

const LoadingOverlay: React.FC<{ message?: string }> = ({ message = "LOADING..." }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020617]/90 backdrop-blur-sm animate-in fade-in duration-300">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-100 font-black text-xs tracking-widest uppercase">{message}</p>
    </div>
  </div>
);

const Logo: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`flex flex-col items-center ${className}`}>
    <span className="text-3xl font-black tracking-tighter text-indigo-400 uppercase italic leading-none">
      CREW<span className="text-white">X</span>
    </span>
  </div>
);

const Avatar: React.FC<{ name: string; size?: string; className?: string; color?: string }> = ({ name, size = 'w-10 h-10', className = '', color = 'bg-[#1e1b4b] text-indigo-400' }) => {
  const initial = name?.charAt(0).toUpperCase() || '?';
  return (
    <div className={`${size} rounded-full flex items-center justify-center font-bold text-sm border border-white/5 ${color} uppercase ${className}`}>
       {initial}
    </div>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick} 
    className={`bg-[#0b101c] rounded-xl border border-slate-800/60 transition-all ${onClick ? 'cursor-pointer hover:border-indigo-500/50 hover:bg-[#111827]' : ''} ${className}`}
  >
    {children}
  </div>
);

const Modal: React.FC<{ title?: string; children: React.ReactNode; onClose: () => void; maxWidth?: string }> = ({ title, children, onClose, maxWidth = "max-w-sm" }) => (
  <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className={`bg-[#0b101c] rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200`}>
      {title && (
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-100 text-sm uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-white transition-colors">
            <Icons.XMark className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="p-8">
        {children}
      </div>
    </div>
  </div>
);

// --- Sub-Components ---

const StatCard = ({ label, value, icon, colorClass = "text-indigo-400", bgClass = "bg-[#111827]" }: { label: string, value: string, icon: React.ReactNode, colorClass?: string, bgClass?: string }) => (
  <Card className="flex items-center gap-6 min-h-[130px] shadow-lg border-slate-800/80 p-6">
    <div className={`w-14 h-14 shrink-0 flex items-center justify-center rounded-xl border border-slate-700/40 ${bgClass} ${colorClass}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-1.5 truncate">{label}</p>
      <p className="text-4xl font-bold text-white tracking-tight">{value}</p>
    </div>
  </Card>
);

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-lg transition-all group ${active ? 'bg-indigo-600/15 text-indigo-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/20'}`}
    >
      <div className={`${active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { strokeWidth: 2 }) : icon}
      </div>
      <span className={`text-sm font-semibold tracking-tight ${active ? 'text-indigo-400' : ''}`}>{label}</span>
    </button>
  );
}

// --- Main Application ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>('home');
  const [loginRole, setLoginRole] = useState<UserRole>(UserRole.WORKER);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [payoutFilter, setPayoutFilter] = useState<WithdrawalStatus | 'ALL'>('ALL');
  
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Job Creation/Edit State (Admin)
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<Partial<Job>>({
    title: '',
    date: '',
    time: '',
    location: '',
    pay: 0,
    maxWorkers: 0
  });

  // Feature State (Admin)
  const [viewingStaffJobId, setViewingStaffJobId] = useState<string | null>(null);
  const [payingWorkerId, setPayingWorkerId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [selectedWorkerHistory, setSelectedWorkerHistory] = useState<User | null>(null);

  // Auth States
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerPassword, setWorkerPassword] = useState('');
  const [showWorkerEmailLogin, setShowWorkerEmailLogin] = useState(false);
  const [loginError, setLoginError] = useState(false);

  // App Data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const fetchData = async () => {
    try {
      const [u, j, e, w] = await Promise.all([
        db.getUsers(),
        db.getJobs(),
        db.getEnrollments(),
        db.getWithdrawals()
      ]);
      setUsers(u);
      setJobs(j);
      setEnrollments(e);
      setWithdrawals(w);
    } catch (err) {
      console.error("Data Fetch Error:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await db.getUserByEmail(session.user.email!);
        if (profile) {
            setUser(profile);
        } else {
            // New user via Google? Usually would create profile here.
            setView('auth');
        }
      } else {
        setView('auth');
      }
      await fetchData();
      setIsLoading(false);
    };
    init();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    try {
      const isValid = await db.verifyAdmin(adminEmail, adminPassword);
      if (isValid) {
        const profile = await db.getUserByEmail(adminEmail);
        setUser(profile || { id: 'admin', name: 'Admin', email: adminEmail, role: UserRole.ADMIN, balance: 0 });
        setView('home');
      } else {
        setLoginError(true);
      }
    } catch (err) {
      setLoginError(true);
    }
  };

  const handleWorkerEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    try {
      // Validate worker against Supabase 'workers' table (the profiles)
      const profile = await db.getUserByEmail(workerEmail);
      if (profile && profile.password === workerPassword) {
        setUser(profile);
        setView('home');
      } else {
        setLoginError(true);
      }
    } catch (err) {
      setLoginError(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setView('auth');
    setShowLogoutConfirm(false);
  };

  // --- Worker Actions ---
  const handleEnroll = async (jobId: string) => {
    if (!user) return;
    try {
      const job = jobs.find(j => j.id === jobId);
      if (!job || job.enrolledCount >= job.maxWorkers) return;
      
      const newEnrollment: Enrollment = {
        id: crypto.randomUUID(),
        userId: user.id,
        jobId: jobId,
        enrolledAt: new Date().toISOString()
      };
      
      await db.saveEnrollment(newEnrollment);
      await db.updateJob(jobId, { enrolledCount: job.enrolledCount + 1 });
      await fetchData();
      alert("Successfully enrolled!");
    } catch (err) {
      alert("Enrollment failed.");
    }
  };

  const handleUnenroll = async (jobId: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to unenroll from this event?")) return;
    try {
      const job = jobs.find(j => j.id === jobId);
      if (!job) return;
      
      await db.deleteEnrollmentByUserAndJob(user.id, jobId);
      await db.updateJob(jobId, { enrolledCount: Math.max(0, job.enrolledCount - 1) });
      await fetchData();
      alert("Successfully unenrolled.");
    } catch (err) {
      alert("Failed to unenroll.");
    }
  };

  const handleRequestPayout = async () => {
    if (!user || user.balance <= 0) return;
    if (!confirm(`Request a payout for ${user.balance} Rs?`)) return;
    try {
      const request: WithdrawalRequest = {
        id: crypto.randomUUID(),
        userId: user.id,
        amount: user.balance,
        status: WithdrawalStatus.PENDING,
        createdAt: new Date().toISOString()
      };
      await db.saveWithdrawal(request);
      await db.updateUser(user.id, { balance: 0 }); // Move balance to pending state effectively
      await fetchData();
      alert("Payout requested successfully.");
    } catch (err) {
      alert("Failed to request payout.");
    }
  };

  // --- Admin Actions ---
  const handleJobAction = async (id: string, action: 'edit' | 'toggle_status' | 'finish' | 'delete' | 'see_staff') => {
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    if (action === 'delete') {
      if (confirm('Permanently delete this event? This cannot be undone.')) {
        await db.deleteJob(id);
        await fetchData();
      }
    } else if (action === 'toggle_status') {
      const nextStatus = job.status === JobStatus.OPEN ? JobStatus.CLOSED : JobStatus.OPEN;
      if (confirm(`Set job status to ${nextStatus}?`)) {
        await db.updateJob(id, { status: nextStatus });
        await fetchData();
      }
    } else if (action === 'finish') {
      if (confirm('Mark this event as COMPLETED?')) {
        await db.updateJob(id, { status: JobStatus.COMPLETED });
        await fetchData();
      }
    } else if (action === 'edit') {
      setEditingJobId(id);
      setJobForm({ ...job });
      setIsCreatingJob(true);
    } else if (action === 'see_staff') {
      setViewingStaffJobId(id);
    }
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm('Save changes to this event?')) return;
    try {
      if (editingJobId) {
        await db.updateJob(editingJobId, jobForm);
      } else {
        await db.saveJob({
          id: crypto.randomUUID(),
          title: jobForm.title!,
          date: jobForm.date!,
          time: jobForm.time!,
          location: jobForm.location!,
          pay: Number(jobForm.pay),
          maxWorkers: Number(jobForm.maxWorkers),
          enrolledCount: 0,
          status: JobStatus.OPEN
        });
      }
      setIsCreatingJob(false);
      setEditingJobId(null);
      await fetchData();
    } catch (err) {
      alert("Failed to save job.");
    }
  };

  const handleAdminPay = async () => {
    if (!payingWorkerId || !payAmount) return;
    const amount = parseFloat(payAmount);
    if (confirm(`Add ${amount} Rs to worker wallet?`)) {
      const targetUser = users.find(u => u.id === payingWorkerId);
      if (targetUser) {
        await db.updateUser(payingWorkerId, { balance: (targetUser.balance || 0) + amount });
        setPayingWorkerId(null);
        setPayAmount('');
        await fetchData();
        alert("Payment processed.");
      }
    }
  };

  if (isLoading) return <LoadingOverlay />;

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-10 border-slate-800 shadow-2xl text-center">
          <Logo className="mb-12" />
          
          <div className="flex bg-[#080C17] p-1 rounded-xl mb-10 border border-slate-800">
            <button onClick={() => { setLoginRole(UserRole.WORKER); setLoginError(false); }} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${loginRole === UserRole.WORKER ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Worker</button>
            <button onClick={() => { setLoginRole(UserRole.ADMIN); setLoginError(false); }} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${loginRole === UserRole.ADMIN ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Admin</button>
          </div>

          {loginRole === UserRole.WORKER ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col items-center">
              <h2 className="text-2xl font-bold text-white mb-3">Worker Portal</h2>
              <p className="text-slate-400 text-sm mb-10">Sign in to manage your events and earnings.</p>
              
              {!showWorkerEmailLogin ? (
                <>
                  <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-4 bg-white text-[#020617] font-bold py-4 rounded-xl transition-all hover:bg-slate-100 shadow-xl mb-4">
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Continue with Google
                  </button>
                  <button 
                    onClick={() => setShowWorkerEmailLogin(true)}
                    className="text-[10px] text-slate-500 hover:text-indigo-400 font-bold uppercase tracking-widest transition-colors mt-2"
                  >
                    Direct Access Login
                  </button>
                </>
              ) : (
                <form onSubmit={handleWorkerEmailLogin} className="w-full space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Email</label>
                    <input type="email" value={workerEmail} onChange={(e) => setWorkerEmail(e.target.value)} required className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                    <input type="password" value={workerPassword} onChange={(e) => setWorkerPassword(e.target.value)} required className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                  {loginError && <p className="text-rose-500 text-[10px] font-bold text-center">Incorrect Email or Password</p>}
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all">Sign In</button>
                  <button 
                    type="button"
                    onClick={() => setShowWorkerEmailLogin(false)}
                    className="w-full text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center mt-2"
                  >
                    Back to Google
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-6 text-left animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Admin ID</label>
                <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              {loginError && <p className="text-rose-500 text-[10px] font-bold text-center">Admin Access Denied</p>}
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all">Secure Login</button>
            </form>
          )}
        </Card>
      </div>
    );
  }

  const isAdmin = user?.role === UserRole.ADMIN;
  const userEnrollments = enrollments.filter(e => e.userId === user?.id);
  const enrolledJobIds = new Set(userEnrollments.map(e => e.jobId));

  // --- Layout Render Logic ---

  return (
    <div className="min-h-screen flex bg-[#020617] text-slate-100 selection:bg-indigo-500/30">
      
      {/* Sidebar Navigation */}
      <aside className="w-[260px] border-r border-slate-800/60 bg-[#080C17] flex flex-col shrink-0">
        <div className="p-8 pb-10"><Logo /></div>
        <nav className="nav flex-1 px-4 flex flex-col gap-1.5">
          {isAdmin ? (
            <>
              <NavButton icon={<Icons.Dashboard className="w-5 h-5" />} label="Home" active={view === 'home'} onClick={() => setView('home')} />
              <NavButton icon={<Icons.Briefcase className="w-5 h-5" />} label="Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
              <NavButton icon={<Icons.Users className="w-5 h-5" />} label="Staff" active={view === 'staff'} onClick={() => setView('staff')} />
              <NavButton icon={<Icons.Check className="w-5 h-5" />} label="History" active={view === 'history'} onClick={() => setView('history')} />
              <NavButton icon={<Icons.Plus className="w-5 h-5" />} label="Payouts" active={view === 'payouts'} onClick={() => setView('payouts')} />
              <NavButton icon={<Icons.Wallet className="w-5 h-5" />} label="Payout Hist." active={view === 'payout_hist'} onClick={() => setView('payout_hist')} />
            </>
          ) : (
            <>
              <NavButton icon={<Icons.Dashboard className="w-5 h-5" />} label="My Dashboard" active={view === 'home'} onClick={() => setView('home')} />
              <NavButton icon={<Icons.Briefcase className="w-5 h-5" />} label="Available Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
              <NavButton icon={<Icons.Check className="w-5 h-5" />} label="My Enrollments" active={view === 'history'} onClick={() => setView('history')} />
              <NavButton icon={<Icons.Wallet className="w-5 h-5" />} label="Wallet" active={view === 'payouts'} onClick={() => setView('payouts')} />
            </>
          )}
          <div className="mt-auto mb-6">
            <NavButton icon={<Icons.Logout className="w-5 h-5" />} label="Sign Out" active={false} onClick={() => setShowLogoutConfirm(true)} />
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-[75px] border-b border-slate-800/60 flex items-center justify-between px-8 shrink-0 bg-[#020617]/50 backdrop-blur-md sticky top-0 z-50">
          <h1 className="text-xl font-bold tracking-tight text-white capitalize">
             {isAdmin ? (view === 'payout_hist' ? 'Admin History' : view) : (view === 'home' ? 'Worker Dashboard' : view)}
          </h1>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
               <p className="text-xs font-bold text-white">{user?.name}</p>
               <p className="text-[10px] text-slate-500 uppercase tracking-widest">{user?.role}</p>
            </div>
            <Avatar name={user?.name || 'User'} size="w-9 h-9" color={isAdmin ? "bg-emerald-950 text-emerald-400" : "bg-indigo-950 text-indigo-400"} />
          </div>
        </header>

        <div className="p-8 overflow-y-auto flex-1">
          {/* Dashboard Home View */}
          {view === 'home' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {isAdmin ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard label="TOTAL STAFF" value={users.filter(u => u.role === UserRole.WORKER).length.toString()} icon={<Icons.Users className="w-6 h-6" />} colorClass="text-slate-400" />
                  <StatCard label="LIVE EVENTS" value={jobs.filter(j => j.status === JobStatus.OPEN).length.toString()} icon={<Icons.Briefcase className="w-6 h-6" />} colorClass="text-indigo-400" />
                  <StatCard label="PENDING PAYOUTS" value={withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).length.toString()} icon={<Icons.Wallet className="w-6 h-6" />} colorClass="text-rose-400/80" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard label="MY WALLET" value={`${user?.balance || 0} Rs`} icon={<Icons.Wallet className="w-6 h-6" />} colorClass="text-emerald-400" />
                  <StatCard label="ENROLLED JOBS" value={userEnrollments.length.toString()} icon={<Icons.Check className="w-6 h-6" />} colorClass="text-indigo-400" />
                  <StatCard label="PENDING REQUESTS" value={withdrawals.filter(w => w.userId === user?.id && w.status === WithdrawalStatus.PENDING).length.toString()} icon={<Icons.Plus className="w-6 h-6" />} colorClass="text-amber-400" />
                </div>
              )}
            </div>
          )}

          {/* Jobs View */}
          {view === 'jobs' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white tracking-tight">{isAdmin ? 'Event Management' : 'Available Opportunities'}</h2>
                {isAdmin && (
                  <button onClick={() => { setEditingJobId(null); setJobForm({ title: '', date: '', location: '', pay: 0, maxWorkers: 0, time: '' }); setIsCreatingJob(true); }} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-lg">New Event</button>
                )}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {jobs.filter(j => isAdmin || j.status === JobStatus.OPEN).sort((a,b) => a.status === JobStatus.COMPLETED ? 1 : -1).map(job => (
                  <Card key={job.id} className={`p-6 space-y-4 ${job.status === JobStatus.COMPLETED ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-white truncate">{job.title}</h3>
                        <p className="text-sm text-indigo-400 font-medium truncate">{job.location}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-[9px] font-black rounded border uppercase tracking-widest ${job.status === JobStatus.OPEN ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="bg-[#080C17] p-4 rounded-xl border border-slate-800 space-y-3">
                       <div className="flex justify-between text-xs"><span className="text-slate-500 font-bold uppercase">Date</span><span className="text-white font-bold">{job.date}</span></div>
                       <div className="flex justify-between text-xs"><span className="text-slate-500 font-bold uppercase">Payment</span><span className="text-emerald-400 font-bold">{job.pay} Rs</span></div>
                       <div className="flex justify-between text-xs"><span className="text-slate-500 font-bold uppercase">Staffing</span><span className="text-white font-bold">{job.enrolledCount} / {job.maxWorkers}</span></div>
                    </div>
                    {isAdmin ? (
                      <>
                        <button onClick={() => setViewingStaffJobId(job.id)} className="w-full py-2 bg-slate-800/50 hover:bg-slate-800 text-[10px] font-bold uppercase tracking-widest border border-slate-700 rounded-lg transition-all">Enrolled Staff</button>
                        <div className="grid grid-cols-3 gap-2">
                           <button onClick={() => handleJobAction(job.id, 'edit')} className="py-2 px-3 bg-[#111827] border border-slate-700 hover:border-slate-500 rounded-lg text-[10px] font-bold text-slate-300 uppercase transition-all">Edit</button>
                           <button onClick={() => handleJobAction(job.id, 'finish')} disabled={job.status === JobStatus.COMPLETED} className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-bold text-white uppercase transition-all shadow-lg disabled:opacity-20">Finish</button>
                           <button onClick={() => handleJobAction(job.id, 'delete')} className="py-2 px-3 bg-rose-600 hover:bg-rose-500 rounded-lg text-white flex items-center justify-center shadow-lg"><Icons.Trash className="w-4 h-4" /></button>
                        </div>
                      </>
                    ) : (
                      <button 
                        disabled={enrolledJobIds.has(job.id) || job.enrolledCount >= job.maxWorkers}
                        onClick={() => handleEnroll(job.id)}
                        className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${enrolledJobIds.has(job.id) ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-900/20'}`}
                      >
                        {enrolledJobIds.has(job.id) ? 'Already Enrolled' : (job.enrolledCount >= job.maxWorkers ? 'Event Full' : 'Join Event')}
                      </button>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* History/My Enrollments View */}
          {view === 'history' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
               <h2 className="text-2xl font-bold text-white tracking-tight">{isAdmin ? 'Enrollment Logs' : 'My Event History'}</h2>
               <Card className="overflow-hidden">
                  <div className="px-6 py-4 bg-[#0d1424] flex items-center border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span className="flex-[2]">{isAdmin ? 'Worker' : 'Event Title'}</span>
                    <span className="flex-1 text-center">{isAdmin ? 'Event' : 'Date'}</span>
                    <span className="flex-1 text-right">Payment</span>
                    {!isAdmin && <span className="w-24 text-right">Action</span>}
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {(isAdmin ? enrollments : userEnrollments).map(enr => {
                      const job = jobs.find(j => j.id === enr.jobId);
                      const worker = users.find(u => u.id === enr.userId);
                      return (
                        <div key={enr.id} className="px-6 py-4 flex items-center hover:bg-[#111827]/30 transition-colors">
                           <div className="flex-[2] flex items-center gap-3">
                             {isAdmin ? (
                               <>
                                <Avatar name={worker?.name || '?'} size="w-8 h-8" />
                                <span className="font-bold text-sm text-slate-200">{worker?.name}</span>
                               </>
                             ) : (
                               <span className="font-bold text-sm text-slate-200">{job?.title}</span>
                             )}
                           </div>
                           <span className="flex-1 text-center text-xs text-indigo-400 font-bold">{isAdmin ? job?.title : job?.date}</span>
                           <span className="flex-1 text-right text-sm font-black text-emerald-400">{job?.pay} Rs</span>
                           {!isAdmin && (
                             <div className="w-24 text-right">
                               <button 
                                onClick={() => handleUnenroll(enr.jobId)}
                                className="text-[10px] font-bold text-rose-500 hover:text-rose-400 uppercase tracking-widest underline decoration-2 underline-offset-4 transition-colors"
                               >
                                Cancel
                               </button>
                             </div>
                           )}
                        </div>
                      )
                    })}
                  </div>
               </Card>
            </div>
          )}

          {/* Wallet / Payouts View */}
          {view === 'payouts' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <h2 className="text-2xl font-bold text-white tracking-tight">{isAdmin ? 'Pending Payouts' : 'My Wallet'}</h2>
              {isAdmin ? (
                <div className="space-y-4">
                   {withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).map(w => {
                     const worker = users.find(u => u.id === w.userId);
                     return (
                       <Card key={w.id} className="p-6 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                           <Avatar name={worker?.name || '?'} size="w-12 h-12" />
                           <div>
                             <p className="font-bold text-white">{worker?.name}</p>
                             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{worker?.email}</p>
                           </div>
                         </div>
                         <div className="text-center">
                            <p className="text-2xl font-black text-emerald-400">{w.amount} Rs</p>
                            <p className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">{new Date(w.createdAt).toLocaleDateString()}</p>
                         </div>
                         <div className="flex gap-3">
                            <button onClick={() => db.updateWithdrawal(w.id, WithdrawalStatus.REJECTED).then(fetchData)} className="px-4 py-2 bg-rose-600/10 text-rose-500 text-[10px] font-bold uppercase rounded-lg border border-rose-500/20">Reject</button>
                            <button onClick={() => db.updateWithdrawal(w.id, WithdrawalStatus.APPROVED).then(fetchData)} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase rounded-lg shadow-lg">Approve</button>
                         </div>
                       </Card>
                     )
                   })}
                   {withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).length === 0 && (
                     <p className="py-20 text-center text-slate-700 italic font-bold tracking-widest uppercase opacity-30">No pending payouts.</p>
                   )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <Card className="p-8 flex flex-col items-center justify-center text-center bg-indigo-600/5 border-indigo-500/20">
                      <Icons.Wallet className="w-16 h-16 text-indigo-400 mb-6" />
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Available Balance</p>
                      <h3 className="text-5xl font-black text-white mb-8 tracking-tighter">{user?.balance || 0} <span className="text-2xl text-slate-400">Rs</span></h3>
                      <button 
                        onClick={handleRequestPayout}
                        disabled={!user || user.balance <= 0}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 text-white font-bold rounded-xl shadow-xl shadow-emerald-950/40 uppercase tracking-widest text-xs transition-all"
                      >
                        Request Payout
                      </button>
                   </Card>
                   <Card className="p-8">
                      <h4 className="font-bold text-white uppercase tracking-widest text-[10px] mb-6 border-b border-slate-800 pb-4">Recent Transactions</h4>
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                        {withdrawals.filter(w => w.userId === user?.id).map(w => (
                          <div key={w.id} className="flex justify-between items-center p-4 bg-[#080C17] rounded-xl border border-slate-800">
                             <div>
                               <p className="text-xs font-bold text-white">Payout Request</p>
                               <p className="text-[9px] text-slate-600 font-bold uppercase">{new Date(w.createdAt).toLocaleDateString()}</p>
                             </div>
                             <div className="text-right">
                               <p className="text-sm font-black text-slate-200">{w.amount} Rs</p>
                               <span className={`text-[8px] font-black uppercase tracking-widest ${w.status === WithdrawalStatus.APPROVED ? 'text-emerald-500' : (w.status === WithdrawalStatus.PENDING ? 'text-amber-500' : 'text-rose-500')}`}>
                                 {w.status}
                               </span>
                             </div>
                          </div>
                        ))}
                        {withdrawals.filter(w => w.userId === user?.id).length === 0 && (
                          <p className="text-center py-10 text-slate-700 text-xs font-bold uppercase tracking-widest opacity-20 italic">No transactions found.</p>
                        )}
                      </div>
                   </Card>
                </div>
              )}
            </div>
          )}

          {/* Staff Directory View (Admin) */}
          {isAdmin && view === 'staff' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold text-white tracking-tight">Worker Profiles</h2>
                <div className="w-full max-w-sm relative">
                   <input type="text" placeholder="Search workers..." value={staffSearch} onChange={e => setStaffSearch(e.target.value)} className="w-full bg-[#0b101c] border border-slate-800 rounded-lg py-2.5 px-4 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-slate-700 transition-all" />
                </div>
              </div>
              <Card className="overflow-hidden">
                <div className="px-6 py-4 bg-[#0d1424] border-b border-slate-800 flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <span>Name</span>
                  <span>Balance</span>
                </div>
                <div className="divide-y divide-slate-800/60">
                   {users.filter(u => u.role === UserRole.WORKER).filter(u => u.name.toLowerCase().includes(staffSearch.toLowerCase())).map(u => (
                     <div key={u.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#111827]/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <Avatar name={u.name} size="w-10 h-10" />
                          <div>
                            <p className="font-bold text-white text-sm">{u.name}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{u.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-emerald-400">{u.balance} Rs</p>
                          <button onClick={() => setSelectedWorkerHistory(u)} className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-400 transition-colors">View Logs</button>
                        </div>
                     </div>
                   ))}
                </div>
              </Card>
            </div>
          )}

          {/* Admin History View */}
          {isAdmin && view === 'payout_hist' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
               <h2 className="text-2xl font-bold text-white tracking-tight">Admin Payout Audit</h2>
               <Card className="overflow-hidden">
                  <div className="px-8 py-4 bg-[#0d1424] flex items-center border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                    <span className="flex-1">Worker</span>
                    <span className="flex-1 text-center">Amount</span>
                    <span className="flex-1 text-center">Status</span>
                    <span className="flex-1 text-right">Processed On</span>
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {withdrawals.filter(w => w.status !== WithdrawalStatus.PENDING).map(w => (
                      <div key={w.id} className="px-8 py-4 flex items-center">
                        <span className="flex-1 font-bold text-sm text-slate-200">{users.find(u => u.id === w.userId)?.name || 'Unknown'}</span>
                        <span className="flex-1 text-center font-black text-emerald-400 text-sm">{w.amount} Rs</span>
                        <div className="flex-1 flex justify-center">
                           <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${w.status === WithdrawalStatus.APPROVED ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>{w.status}</span>
                        </div>
                        <span className="flex-1 text-right text-[10px] text-slate-500 uppercase font-black">{new Date(w.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
               </Card>
            </div>
          )}
        </div>
      </main>

      {/* Viewing Enrolled Staff Modal (Admin) */}
      {viewingStaffJobId && (
        <Modal title="Currently Enrolled Staff" onClose={() => setViewingStaffJobId(null)} maxWidth="max-w-xl">
           <div className="space-y-4">
              <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                 {enrollments.filter(e => e.jobId === viewingStaffJobId).map(enr => {
                   const worker = users.find(u => u.id === enr.userId);
                   return (
                     <div key={enr.id} className="flex items-center justify-between p-4 bg-[#080C17] border border-slate-800 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Avatar name={worker?.name || '?'} size="w-8 h-8" />
                          <span className="font-bold text-sm text-slate-200">{worker?.name}</span>
                        </div>
                        <button onClick={() => setPayingWorkerId(worker?.id || null)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase rounded-lg transition-all">Add Funds</button>
                     </div>
                   )
                 })}
                 {enrollments.filter(e => e.jobId === viewingStaffJobId).length === 0 && (
                   <p className="py-10 text-center text-slate-700 uppercase font-black text-[10px] tracking-widest opacity-30 italic">No one enrolled yet.</p>
                 )}
              </div>
           </div>
        </Modal>
      )}

      {/* Pay Modal (Admin) */}
      {payingWorkerId && (
        <Modal title="Process Payment" onClose={() => setPayingWorkerId(null)}>
           <div className="space-y-6">
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Add funds directly to the staff's digital wallet for this completed task.</p>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Amount (Rs)</label>
                <input type="number" autoFocus value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#080C17] border border-slate-800 rounded-xl px-4 py-3 text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/50" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPayingWorkerId(null)} className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleAdminPay} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-[10px] uppercase tracking-widest shadow-lg">Confirm</button>
              </div>
           </div>
        </Modal>
      )}

      {/* Create/Edit Job Modal (Admin) */}
      {isCreatingJob && (
        <Modal onClose={() => setIsCreatingJob(false)} maxWidth="max-w-2xl">
          <form onSubmit={handleSaveJob} className="space-y-6">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-8">{editingJobId ? 'Modify Event' : 'Create New Opportunity'}</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Title</label>
                <input type="text" required value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} className="w-full bg-[#080C17] border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-indigo-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date</label>
                  <input type="date" required value={jobForm.date} onChange={e => setJobForm({...jobForm, date: e.target.value})} className="w-full bg-[#080C17] border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-indigo-500/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Shift Hours</label>
                  <input type="text" required placeholder="e.g. 10AM - 6PM" value={jobForm.time} onChange={e => setJobForm({...jobForm, time: e.target.value})} className="w-full bg-[#080C17] border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-indigo-500/50" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Venue Address</label>
                <input type="text" required value={jobForm.location} onChange={e => setJobForm({...jobForm, location: e.target.value})} className="w-full bg-[#080C17] border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-indigo-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Payment (Rs)</label>
                  <input type="number" required value={jobForm.pay || ''} onChange={e => setJobForm({...jobForm, pay: Number(e.target.value)})} className="w-full bg-[#080C17] border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-indigo-500/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Staff Required</label>
                  <input type="number" required value={jobForm.maxWorkers || ''} onChange={e => setJobForm({...jobForm, maxWorkers: Number(e.target.value)})} className="w-full bg-[#080C17] border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-indigo-500/50" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6">
               <button type="button" onClick={() => setIsCreatingJob(false)} className="px-6 py-3 bg-[#111827] text-slate-400 font-bold rounded-xl text-xs uppercase tracking-widest">Cancel</button>
               <button type="submit" className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-950/40">Confirm Save</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Logout Confirmation */}
      {showLogoutConfirm && (
        <Modal title="Confirm Sign Out" onClose={() => setShowLogoutConfirm(false)}>
           <div className="text-center py-4">
              <p className="text-sm text-slate-300 font-medium mb-8 leading-relaxed">End your current session and return to the login screen?</p>
              <div className="flex gap-3">
                 <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-xs uppercase tracking-widest">No</button>
                 <button onClick={handleLogout} className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg">Yes</button>
              </div>
           </div>
        </Modal>
      )}

      {/* Staff Log Modal (Admin) */}
      {selectedWorkerHistory && (
        <Modal title={`${selectedWorkerHistory.name}'s History`} onClose={() => setSelectedWorkerHistory(null)} maxWidth="max-w-lg">
           <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {enrollments.filter(e => e.userId === selectedWorkerHistory.id).map(enr => {
                const job = jobs.find(j => j.id === enr.jobId);
                return (
                  <div key={enr.id} className="flex justify-between items-center p-3 border border-slate-800 rounded-xl bg-[#080C17]">
                     <span className="font-bold text-sm text-slate-200">{job?.title}</span>
                     <span className="font-black text-emerald-400 text-sm">{job?.pay} Rs</span>
                  </div>
                )
              })}
              {enrollments.filter(e => e.userId === selectedWorkerHistory.id).length === 0 && (
                <p className="py-10 text-center text-slate-700 italic font-bold tracking-widest uppercase opacity-20">No event records.</p>
              )}
           </div>
        </Modal>
      )}
    </div>
  );
}
