
import React, { useState, useEffect, useRef } from 'react';
import { User, Job, Enrollment, UserRole, JobStatus, WithdrawalStatus, AppNotification, NotificationType, WithdrawalRequest } from './types';
import { db } from './db';
import { Icons, APP_NAME } from './constants';
import { supabase } from './supabase';
import { GoogleGenAI } from "@google/genai";

// --- Services ---

const validateQrWithAI = async (base64Data: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const cleanData = base64Data.split(',')[1] || base64Data;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanData,
            },
          },
          {
            text: "Analyze this image. Is it a valid payment QR code (like UPI, Google Pay, PhonePe, or a standard QR code)? Answer only with 'VALID' if it is clearly a QR code, or 'INVALID' if it is not. Do not provide any other text.",
          },
        ],
      },
    });

    const result = response.text?.trim().toUpperCase();
    return result === 'VALID';
  } catch (error) {
    console.error("AI QR Validation Error:", error);
    return false;
  }
};

// --- Shared Components ---

const LoadingOverlay: React.FC<{ message?: string }> = ({ message = "LOADING... PLEASE WAIT" }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-[6px] animate-in fade-in duration-300">
    <div className="bg-slate-900 p-10 rounded-3xl shadow-2xl text-center flex flex-col items-center gap-6 border border-slate-800 max-w-[85vw]">
      <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <div>
        <p className="text-slate-100 font-black text-sm tracking-widest uppercase leading-relaxed">{message}</p>
        <p className="text-slate-600 text-[10px] mt-2 font-bold uppercase tracking-[0.25em]">CrewX Secure Operations</p>
      </div>
    </div>
  </div>
);

const SetupRequired: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-center">
    <Card className="max-w-md p-8 border-rose-500/30 bg-slate-900">
      <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
        <Icons.XMark className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-black text-white uppercase tracking-tight mb-4">Database Setup Required</h2>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed">
        The application couldn't find the required tables in your Supabase database. 
        Please copy the contents of <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-400">supabase_setup.sql</code> 
        and run it in the Supabase <strong>SQL Editor</strong>.
      </p>
      <Button variant="primary" className="w-full font-black py-4 uppercase tracking-widest" onClick={() => window.location.reload()}>
        I'VE RUN THE SQL - RELOAD
      </Button>
    </Card>
  </div>
);

const Logo: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <span className="text-3xl font-black tracking-tighter text-indigo-500 uppercase italic">
      Crew<span className="text-white">X</span>
    </span>
  </div>
);

const Avatar: React.FC<{ name: string; size?: string; className?: string; onClick?: () => void }> = ({ name, size = 'w-10 h-10', className = '', onClick }) => {
  const getInitials = (n: string = '') => {
    const cleaned = (n || '').trim();
    if (!cleaned) return '??';
    return cleaned.split(' ').filter(Boolean).map(x => x[0]).join('').toUpperCase().substring(0, 2) || '??';
  };
  
  const colors = [
    'bg-indigo-900/40 text-indigo-300 border-indigo-800/50', 
    'bg-emerald-900/40 text-emerald-300 border-emerald-800/50', 
    'bg-amber-900/40 text-amber-300 border-amber-800/50', 
    'bg-rose-900/40 text-rose-300 border-rose-800/50', 
    'bg-sky-900/40 text-sky-300 border-sky-800/50'
  ];
  
  const hash = (name || '').split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const colorClass = colors[Math.abs(hash) % colors.length];
  
  return (
    <div 
      onClick={onClick}
      className={`${size} rounded-full flex items-center justify-center font-bold border-2 shadow-md uppercase ${colorClass} ${className} ${onClick ? 'cursor-pointer hover:brightness-110 active:scale-95 transition-all' : ''}`}>
       {getInitials(name)}
    </div>
  );
};

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  className?: string;
  disabled?: boolean;
}> = ({ children, onClick, type = 'button', variant = 'primary', className = '', disabled = false }) => {
  const base = "px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20",
    secondary: "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
    success: "bg-emerald-600 text-white hover:bg-emerald-500",
    ghost: "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
  };
  return (
    <button type={type} onClick={(e) => { e.stopPropagation(); onClick?.(); }} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void; id?: string }> = ({ children, className = '', onClick, id }) => (
  <div 
    id={id}
    onClick={onClick} 
    className={`bg-slate-900 rounded-xl border border-slate-800 shadow-xl p-4 transition-all ${onClick ? 'cursor-pointer hover:border-indigo-500/50 hover:bg-slate-800/50 active:scale-[0.99]' : ''} ${className}`}
  >
    {children}
  </div>
);

const Badge: React.FC<{ status: string; variant?: 'green' | 'red' | 'gray' | 'blue' | 'yellow' }> = ({ status, variant = 'gray' }) => {
  const colors = {
    green: "bg-emerald-900/30 text-emerald-400 border border-emerald-800/50",
    red: "bg-rose-900/30 text-rose-400 border border-rose-800/50",
    gray: "bg-slate-800 text-slate-400 border border-slate-700",
    blue: "bg-indigo-900/30 text-indigo-400 border border-indigo-800/50",
    yellow: "bg-amber-900/30 text-amber-400 border border-amber-800/50"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[variant as keyof typeof colors] || colors.gray}`}>
      {status}
    </span>
  );
};

const Modal: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
    <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
        <h3 className="font-bold text-slate-100">{title}</h3>
        <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
          <Icons.XMark className="w-6 h-6" />
        </button>
      </div>
      <div className="p-6 max-h-[75vh] overflow-y-auto">
        {children}
      </div>
    </div>
  </div>
);

// --- Helper Functions ---

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});

const formatDate = (dateString: string) => {
  if (!dateString) return '--';
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return dateString;
  return `${day}-${month}-${year}`;
};

const formatViewName = (view: string) => {
  if (view === 'my_enrolled_jobs') return "My Enrolled Jobs";
  if (view === 'admin_users') return "Staff Directory";
  if (view === 'admin_requests') return "Payout Requests";
  if (view === 'admin_history') return "Enrollment History";
  if (view === 'admin_payout_history') return "Admin Payout History";
  if (view === 'dashboard') return "Dashboard Overview";
  if (view === 'payout_history') return "Payout History";
  return view.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// --- Shared Nav Component ---

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 transition-all md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2 md:rounded-lg ${active ? 'text-indigo-400 bg-indigo-900/30' : 'text-slate-500 hover:text-indigo-300 hover:bg-slate-800'}`}>
      <div className={`${active ? 'scale-110' : ''} transition-transform`}>{icon}</div>
      <span className="text-[10px] md:text-sm font-semibold">{label}</span>
    </button>
  );
}

// --- Application ---

type AppView = 'auth' | 'dashboard' | 'jobs' | 'wallet' | 'contact' | 'my_enrolled_jobs' | 'admin_users' | 'admin_requests' | 'admin_history';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>('auth');
  const [loginRole, setLoginRole] = useState<UserRole>(UserRole.WORKER);
  const [isLoading, setIsLoading] = useState(true);
  const [dbMissing, setDbMissing] = useState(false);
  const [dbTaskLoading, setDbTaskLoading] = useState(false);
  const [customLoadingMessage, setCustomLoadingMessage] = useState<string | null>(null);
  
  // App Data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Modals
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [showEnrollConfirm, setShowEnrollConfirm] = useState<string | null>(null);

  // Admin Auth
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
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
      setDbMissing(false);
    } catch (err: any) {
      console.error("Data Fetch Error:", err);
      if (err?.code === 'PGRST205' || err?.message?.includes('workers')) {
        setDbMissing(true);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      // Setup Auth Listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const authUser = session.user;
          setDbTaskLoading(true);
          setCustomLoadingMessage("SYNCING ACCOUNT...");
          
          try {
            let profile = await db.getUserByEmail(authUser.email!);
            if (!profile) {
              profile = {
                id: authUser.id,
                name: authUser.user_metadata.full_name || authUser.email!.split('@')[0],
                email: authUser.email!,
                role: UserRole.WORKER,
                balance: 0
              };
              await db.saveUser(profile);
            }
            setUser(profile);
            localStorage.setItem('crewx_user', JSON.stringify(profile));
            setView('dashboard');
            await fetchData(true);
          } catch (e: any) {
             if (e?.code === 'PGRST205') setDbMissing(true);
          } finally {
            setDbTaskLoading(false);
            setCustomLoadingMessage(null);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('crewx_user');
          setView('auth');
        }
      });

      // Recover Local User Session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchData();
      } else {
        setIsLoading(false);
      }
      
      return () => subscription.unsubscribe();
    };
    init();
  }, []);

  const handleGoogleLogin = async () => {
    setDbTaskLoading(true);
    setCustomLoadingMessage("OPENING GOOGLE...");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (err: any) {
      alert(err.message);
      setDbTaskLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    setDbTaskLoading(true);
    setCustomLoadingMessage("VERIFYING ADMIN...");
    try {
      const isValid = await db.verifyAdmin(adminEmail, adminPassword);
      if (isValid) {
        let adminProfile = await db.getUserByEmail(adminEmail);
        if (!adminProfile) {
          adminProfile = { 
            id: crypto.randomUUID(), 
            name: 'System Admin', 
            email: adminEmail, 
            role: UserRole.ADMIN, 
            balance: 0 
          };
          await db.saveUser(adminProfile);
        }
        setUser(adminProfile);
        localStorage.setItem('crewx_user', JSON.stringify(adminProfile));
        setView('dashboard');
        await fetchData(true);
      } else {
        setLoginError(true);
      }
    } catch (e: any) {
      if (e?.code === 'PGRST205') setDbMissing(true);
      else alert("Login failed.");
    } finally {
      setDbTaskLoading(false);
      setCustomLoadingMessage(null);
    }
  };

  const enrollInJob = async (jobId: string) => {
    if (!user) return;
    setDbTaskLoading(true);
    setCustomLoadingMessage("ENROLLING...");
    try {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        const newEnrollment: Enrollment = { 
          id: crypto.randomUUID(), userId: user.id, jobId: jobId, enrolledAt: new Date().toISOString() 
        };
        await db.saveEnrollment(newEnrollment);
        const currentCount = enrollments.filter(e => e.jobId === jobId).length + 1;
        await db.updateJob(jobId, { enrolledCount: currentCount, status: currentCount >= job.maxWorkers ? JobStatus.CLOSED : JobStatus.OPEN });
        await fetchData(true);
        setShowEnrollConfirm(null);
        setCustomLoadingMessage("ENROLLED!");
        setTimeout(() => { setDbTaskLoading(false); setCustomLoadingMessage(null); }, 1500);
      }
    } catch (err) { alert("Enrollment failed."); setDbTaskLoading(false); }
  };

  const cancelEnrollment = async (jobId: string) => {
    if (!user) return;
    setDbTaskLoading(true);
    setCustomLoadingMessage("CANCELLING...");
    try {
      await db.deleteEnrollmentByUserAndJob(user.id, jobId);
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        const currentCount = Math.max(0, enrollments.filter(e => e.jobId === jobId).length - 1);
        await db.updateJob(jobId, { enrolledCount: currentCount, status: JobStatus.OPEN });
      }
      await fetchData(true);
      setShowCancelConfirm(null);
      setCustomLoadingMessage("CANCELLED");
      setTimeout(() => { setDbTaskLoading(false); setCustomLoadingMessage(null); }, 1500);
    } catch (err) { alert("Cancellation failed."); setDbTaskLoading(false); }
  };

  const handleQrUpload = async (file: File) => {
    if (!user) return;
    setDbTaskLoading(true);
    setCustomLoadingMessage("AI VALIDATION...");
    try {
      const base64 = await toBase64(file);
      const isValid = await validateQrWithAI(base64);
      if (isValid) {
        await db.updateUser(user.id, { qrCode: base64 });
        await fetchData(true);
        setCustomLoadingMessage("QR UPDATED!");
      } else {
        alert("Invalid QR detected. Please upload a valid payment QR.");
      }
    } catch (e) { alert("Upload failed."); }
    finally { setDbTaskLoading(false); setCustomLoadingMessage(null); }
  };

  if (dbMissing) return <SetupRequired />;
  if (isLoading) return <LoadingOverlay />;

  const isAdmin = user?.role === UserRole.ADMIN;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100">
      {dbTaskLoading && <LoadingOverlay message={customLoadingMessage || undefined} />}
      
      {view === 'auth' ? (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 w-full">
          <Card className="max-w-md w-full p-8 border-slate-800 bg-slate-900 shadow-2xl">
            <Logo className="mb-10" />

            <div className="flex bg-slate-800 p-1 rounded-lg mb-8 border border-slate-700">
              <button onClick={() => setLoginRole(UserRole.WORKER)} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${loginRole === UserRole.WORKER ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-500 hover:text-slate-300'}`}>Staff Login</button>
              <button onClick={() => setLoginRole(UserRole.ADMIN)} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${loginRole === UserRole.ADMIN ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-500 hover:text-slate-300'}`}>Admin Login</button>
            </div>

            {loginRole === UserRole.WORKER ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="text-center">
                  <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Welcome back</h2>
                  <p className="text-xs text-slate-500 font-medium">Use Google to access your shifts and earnings.</p>
                </div>
                <button 
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-4 bg-white text-slate-900 py-4 px-6 rounded-xl font-black uppercase text-sm hover:bg-slate-100 transition-all shadow-xl active:scale-95"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </div>
            ) : (
              <form onSubmit={handleAdminLogin} className="space-y-4 animate-in fade-in duration-300">
                <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} type="email" placeholder="Admin Email" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} type="password" placeholder="Password" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                {loginError && <p className="text-xs text-rose-500 font-bold">Invalid admin credentials.</p>}
                <Button type="submit" disabled={dbTaskLoading} className="w-full py-4 text-sm font-black uppercase tracking-widest">ACCESS SYSTEM</Button>
              </form>
            )}
          </Card>
        </div>
      ) : (
        <>
          <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 md:relative md:w-64 md:border-t-0 md:border-r z-50">
            <div className="flex flex-row justify-around p-2 md:flex-col md:justify-start md:h-screen md:p-6">
              <div className="hidden md:flex mb-10 px-2 items-center justify-center"><Logo /></div>
              <div className="flex flex-row justify-around w-full md:flex-col md:gap-3">
                <NavButton icon={<Icons.Dashboard className="w-6 h-6"/>} label="Home" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                <NavButton icon={<Icons.Briefcase className="w-6 h-6"/>} label="Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
                {!isAdmin && (
                  <>
                    <NavButton icon={<Icons.Wallet className="w-6 h-6"/>} label="Wallet" active={view === 'wallet'} onClick={() => setView('wallet')} />
                    <NavButton icon={<Icons.Check className="w-6 h-6"/>} label="Enrolled" active={view === 'my_enrolled_jobs'} onClick={() => setView('my_enrolled_jobs')} />
                    <NavButton icon={<Icons.Users className="w-6 h-6"/>} label="Support" active={view === 'contact'} onClick={() => setView('contact')} />
                  </>
                )}
                {isAdmin && (
                   <>
                   <NavButton icon={<Icons.Users className="w-6 h-6"/>} label="Staff" active={view === 'admin_users'} onClick={() => setView('admin_users')} />
                   <NavButton icon={<Icons.Check className="w-6 h-6"/>} label="History" active={view === 'admin_history'} onClick={() => setView('admin_history')} />
                   <NavButton icon={<Icons.Wallet className="w-6 h-6"/>} label="Payouts" active={view === 'admin_requests'} onClick={() => setView('admin_requests')} />
                 </>
                )}
                <button onClick={() => setShowLogoutConfirm(true)} className="flex flex-col items-center justify-center p-2 text-slate-500 hover:text-rose-400 md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2 md:mt-auto md:rounded-lg md:hover:bg-rose-950/30 transition-all"><Icons.Logout className="w-6 h-6"/><span className="text-[10px] md:text-sm font-semibold">Logout</span></button>
              </div>
            </div>
          </nav>

          <main className="flex-1 pb-24 md:pb-0 overflow-y-auto max-h-screen">
            <header className="sticky top-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between z-40">
              <h1 className="text-xl font-black capitalize tracking-tight text-slate-100">{formatViewName(view)}</h1>
              <div className="flex items-center gap-2">
                <Avatar name={user?.name || ''} size="w-10 h-10" />
              </div>
            </header>
            <div className="p-6 max-w-5xl mx-auto">
              {view === 'dashboard' && user && <Dashboard user={user} jobs={jobs} enrollments={enrollments} isAdmin={isAdmin} setView={setView} users={users} onQrUpload={handleQrUpload} />}
              {view === 'jobs' && user && <JobsView user={user} jobs={jobs} enrollments={enrollments} isAdmin={isAdmin} onEnroll={(id) => setShowEnrollConfirm(id)} />}
              {view === 'my_enrolled_jobs' && user && <MyEnrolledJobsView user={user} jobs={jobs} enrollments={enrollments} onCancelEnroll={(id) => setShowCancelConfirm(id)} />}
              {view === 'wallet' && user && <WalletView user={user} withdrawals={withdrawals} />}
              {view === 'contact' && <ContactUsView />}
              {view === 'admin_users' && <AdminUsers users={users} />}
              {view === 'admin_history' && <AdminHistory enrollments={enrollments} users={users} jobs={jobs} />}
              {view === 'admin_requests' && <AdminWithdrawals withdrawals={withdrawals} users={users} />}
            </div>
          </main>
        </>
      )}

      {showLogoutConfirm && (
        <Modal title="Logout Confirmation" onClose={() => setShowLogoutConfirm(false)}>
          <div className="text-center">
            <p className="text-slate-400 mb-6 font-medium">Are you sure you want to log out of CrewX?</p>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setShowLogoutConfirm(false)}>Stay</Button>
              <Button variant="danger" className="flex-1 font-black uppercase" onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>Log Out</Button>
            </div>
          </div>
        </Modal>
      )}

      {showEnrollConfirm && (
        <Modal title="Shift Enrollment" onClose={() => setShowEnrollConfirm(null)}>
          <div className="text-center">
            <p className="text-slate-400 mb-6 font-medium">Confirm your attendance for this event.</p>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setShowEnrollConfirm(null)}>Cancel</Button>
              <Button variant="primary" className="flex-1 font-black uppercase" onClick={() => enrollInJob(showEnrollConfirm!)}>Confirm</Button>
            </div>
          </div>
        </Modal>
      )}

      {showCancelConfirm && (
        <Modal title="Withdraw from Shift" onClose={() => setShowCancelConfirm(null)}>
          <div className="text-center">
            <p className="text-slate-400 mb-6 font-medium">Confirm withdrawal from this shift.</p>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setShowCancelConfirm(null)}>Keep Shift</Button>
              <Button variant="danger" className="flex-1 font-black uppercase" onClick={() => cancelEnrollment(showCancelConfirm!)}>Withdraw</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// --- Sub-Views ---

const Dashboard: React.FC<{ user: User, jobs: Job[], enrollments: Enrollment[], isAdmin: boolean, setView: (v: AppView) => void, users: User[], onQrUpload: (f: File) => void }> = ({ user, jobs, enrollments, isAdmin, setView, users, onQrUpload }) => {
  const myEnrollments = enrollments.filter(e => e.userId === user.id);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label={isAdmin ? "Total Staff" : "Credits"} value={isAdmin ? users.filter(u => u.role === UserRole.WORKER).length.toString() : `${user.balance} Rs`} icon={<Icons.Wallet className="text-emerald-400 w-8 h-8"/>} onClick={() => setView(isAdmin ? 'admin_users' : 'wallet')} />
        <StatCard label={isAdmin ? "Total Events" : "My Shifts"} value={isAdmin ? jobs.length.toString() : myEnrollments.length.toString()} icon={<Icons.Check className="text-indigo-400 w-8 h-8"/>} onClick={() => setView(isAdmin ? 'jobs' : 'my_enrolled_jobs')} />
        <StatCard label="Live Jobs" value={jobs.filter(j => j.status === JobStatus.OPEN).length.toString()} icon={<Icons.Briefcase className="text-indigo-400 w-8 h-8"/>} onClick={() => setView('jobs')} />
      </div>
      {!isAdmin && (
        <Card className="p-8 flex flex-col items-center text-center">
          <h3 className="font-black text-lg mb-6 uppercase tracking-widest">Payout Gateway</h3>
          {user.qrCode ? (
            <div className="p-4 bg-white rounded-2xl relative group">
              <img src={user.qrCode} className="w-48 h-48 object-contain" alt="QR" />
              <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all rounded-2xl">
                <Icons.Plus className="w-10 h-10 text-white"/>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onQrUpload(e.target.files[0])} />
              </label>
            </div>
          ) : (
            <label className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-indigo-500 shadow-xl transition-all">
              LINK UPI QR
              <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onQrUpload(e.target.files[0])} />
            </label>
          )}
        </Card>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon, onClick }: { label: string, value: string, icon: React.ReactNode, onClick?: () => void }) => (
  <Card onClick={onClick} className="flex items-center gap-5 border-slate-800/60 hover:bg-slate-800/40">
    <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/50 shadow-lg">{icon}</div>
    <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{label}</p><p className="text-3xl font-black text-slate-100 tracking-tight">{value}</p></div>
  </Card>
);

const JobsView: React.FC<{ user: User, jobs: Job[], enrollments: Enrollment[], isAdmin: boolean, onEnroll: (id: string) => void }> = ({ user, jobs, enrollments, isAdmin, onEnroll }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
    {jobs.map(job => {
      const isEnrolled = enrollments.some(e => String(e.jobId) === String(job.id) && String(e.userId) === String(user.id));
      const actualCount = enrollments.filter(e => String(e.jobId) === String(job.id)).length;
      return (
        <Card key={job.id} className="flex flex-col h-full border-t-4 border-t-indigo-600">
          <div className="flex justify-between items-start mb-5">
            <div className="flex-1"><h3 className="font-black text-xl truncate mb-1 text-slate-100">{job.title}</h3><p className="text-xs text-indigo-400 font-bold">{job.location}</p></div>
            <Badge status={job.status} variant={job.status === JobStatus.OPEN ? 'green' : 'red'} />
          </div>
          <div className="grid grid-cols-2 gap-y-2 mb-6 text-sm">
            <div className="text-slate-500">Date</div><div className="text-slate-100 font-bold">{formatDate(job.date)}</div>
            <div className="text-slate-500">Payment</div><div className="text-emerald-400 font-black">{job.pay} Rs</div>
            <div className="text-slate-500">Staffing</div><div className="text-slate-100 font-bold">{actualCount} / {job.maxWorkers}</div>
          </div>
          {!isAdmin && <Button variant={isEnrolled ? "success" : "primary"} disabled={(!isEnrolled && actualCount >= job.maxWorkers)} onClick={() => onEnroll(job.id)} className="w-full font-black uppercase py-3">{isEnrolled ? "ENROLLED" : (actualCount >= job.maxWorkers) ? "FULL" : "ENROLL"}</Button>}
        </Card>
      );
    })}
  </div>
);

const MyEnrolledJobsView: React.FC<{ user: User, jobs: Job[], enrollments: Enrollment[], onCancelEnroll: (id: string) => void }> = ({ user, jobs, enrollments, onCancelEnroll }) => {
  const myEnrolledJobs = jobs.filter(job => enrollments.some(e => String(e.jobId) === String(job.id) && String(e.userId) === String(user.id)));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {myEnrolledJobs.length === 0 ? <div className="col-span-full py-20 text-center text-slate-600 font-black uppercase">No shifts.</div> : myEnrolledJobs.map(job => (
        <Card key={job.id} className="border-t-4 border-t-emerald-600">
          <h3 className="font-black text-xl mb-4 text-slate-100">{job.title}</h3>
          <p className="text-emerald-400 font-black text-xl mb-6">{job.pay} Rs</p>
          <Button variant="danger" className="w-full font-black uppercase py-3" onClick={() => onCancelEnroll(job.id)}>WITHDRAW</Button>
        </Card>
      ))}
    </div>
  );
};

const WalletView: React.FC<{ user: User, withdrawals: WithdrawalRequest[] }> = ({ user, withdrawals }) => (
  <div className="space-y-6">
    <Card className="bg-indigo-600 text-white p-10 text-center">
      <p className="text-xs font-black uppercase tracking-widest opacity-60 mb-2">Available Credits</p>
      <p className="text-6xl font-black">{user.balance} Rs</p>
    </Card>
    <h3 className="font-bold text-slate-400 uppercase text-xs tracking-widest mt-10">Recent Transactions</h3>
    {withdrawals.length === 0 && <p className="text-center py-10 text-slate-600 font-black uppercase">No transactions yet.</p>}
  </div>
);

const ContactUsView: React.FC = () => (
  <div className="text-center py-16 bg-slate-900 rounded-3xl border border-slate-800">
    <Icons.Users className="w-16 h-16 text-indigo-500 mx-auto mb-4 opacity-40" />
    <h2 className="text-2xl font-black mb-10 uppercase">Support Center</h2>
    <div className="flex gap-4 justify-center">
      <a href="mailto:crewmp54@gmail.com" className="bg-slate-800 text-slate-100 px-8 py-3 rounded-xl font-black uppercase text-[11px] border border-slate-700">Email</a>
      <a href="https://wa.me/6282913521" className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[11px]">WhatsApp</a>
    </div>
  </div>
);

const AdminUsers: React.FC<{ users: User[] }> = ({ users }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {users.filter(u => u.role === UserRole.WORKER).map(u => (
      <Card key={u.id} className="flex items-center gap-4">
        <Avatar name={u.name} size="w-12 h-12" />
        <div className="min-w-0 flex-1"><p className="font-black text-slate-100 text-sm truncate">{u.name}</p><p className="text-[10px] text-slate-500 font-bold truncate">{u.email}</p></div>
        <div className="text-right"><p className="text-emerald-400 font-black text-xs">{u.balance} Rs</p></div>
      </Card>
    ))}
  </div>
);

const AdminHistory: React.FC<{ enrollments: Enrollment[], users: User[], jobs: Job[] }> = ({ enrollments, users, jobs }) => (
  <Card className="p-0 overflow-hidden">
    <table className="w-full text-left text-sm">
      <thead className="bg-slate-900/80 border-b border-slate-800">
        <tr>
          <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase">Worker</th>
          <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase">Event</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/50">
        {enrollments.slice().reverse().map(en => (
          <tr key={en.id}>
            <td className="px-5 py-5 font-bold text-slate-200">{users.find(u => u.id === en.userId)?.name || 'Unknown'}</td>
            <td className="px-5 py-5 text-slate-400">{jobs.find(j => j.id === en.jobId)?.title || 'Deleted Event'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
);

const AdminWithdrawals: React.FC<{ withdrawals: WithdrawalRequest[], users: User[] }> = ({ withdrawals, users }) => (
  <div className="grid grid-cols-1 gap-4">
    {withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).map(w => (
      <Card key={w.id} className="flex justify-between items-center">
        <div>
          <p className="font-black text-slate-400 text-[10px] uppercase">{users.find(usr => usr.id === w.userId)?.name}</p>
          <p className="text-xl font-black text-slate-100">{w.amount} Rs</p>
        </div>
        <Button variant="primary" className="text-xs uppercase font-black">Process Payout</Button>
      </Card>
    ))}
  </div>
);
