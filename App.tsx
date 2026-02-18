
import React, { useState, useEffect, useRef } from 'react';
import { User, Job, Enrollment, UserRole, JobStatus, WithdrawalStatus, WithdrawalRequest, AppView } from './types';
import { db } from './db';
import { Icons, APP_NAME } from './constants';
import { supabase } from './supabase';
import { GoogleGenAI } from "@google/genai";

// --- Shared Components ---

const LoadingOverlay: React.FC<{ message?: string }> = ({ message = "LOADING..." }) => (
  <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[#020617]/95 backdrop-blur-md animate-in fade-in duration-300">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-100 font-black text-[9px] tracking-widest uppercase">{message}</p>
    </div>
  </div>
);

const Logo: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`flex items-center gap-1 ${className}`}>
    <span className="text-xl lg:text-3xl font-black tracking-tighter text-indigo-500 uppercase italic">
      CREW<span className="text-white">X</span>
    </span>
  </div>
);

const Avatar: React.FC<{ name: string; size?: string; className?: string }> = ({ name, size = 'w-10 h-10', className = '' }) => {
  const initial = name?.charAt(0).toUpperCase() || 'E';
  return (
    <div className={`${size} rounded-full flex items-center justify-center font-bold text-sm bg-orange-900/40 text-orange-400 border border-orange-500/30 uppercase shadow-lg shrink-0 ${className}`}>
       {initial}
    </div>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick} 
    className={`bg-[#0b1222] rounded-[20px] border border-white/5 shadow-xl transition-all ${onClick ? 'cursor-pointer hover:bg-[#111a30] active:scale-[0.98]' : ''} ${className}`}
  >
    {children}
  </div>
);

const Modal: React.FC<{ title?: string; children: React.ReactNode; onClose: () => void; maxWidth?: string; centered?: boolean }> = ({ title, children, onClose, maxWidth = "max-w-sm", centered = false }) => (
  <div className={`fixed inset-0 z-[600] flex ${centered ? 'items-center' : 'items-end lg:items-center'} justify-center p-4 lg:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200`}>
    <div className={`bg-[#0b101c] rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden border border-slate-800 animate-in ${centered ? 'zoom-in-95' : 'slide-in-from-bottom-10 lg:zoom-in-95'} duration-200`}>
      {title && (
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-100 text-[10px] lg:text-sm uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-white transition-colors">
            <Icons.XMark className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="p-6 lg:p-8">
        {children}
      </div>
    </div>
  </div>
);

// --- Sub-Components ---

const StatCard = ({ label, value, icon, color = "text-indigo-400", onClick }: { label: string, value: string, icon: React.ReactNode, color?: string, onClick?: () => void }) => (
  <Card onClick={onClick} className="flex items-center gap-6 p-5 w-full">
    <div className={`w-14 h-14 shrink-0 flex items-center justify-center rounded-[16px] bg-slate-900/40 border border-white/5 ${color}`}>
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6' }) : icon}
    </div>
    <div className="flex flex-col min-w-0">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">{label}</p>
      <p className="text-2xl font-black text-white tracking-tight truncate">{value}</p>
    </div>
  </Card>
);

function NavItem({ icon, label, active, onClick, isMobile = false }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, isMobile?: boolean }) {
  if (isMobile) {
    return (
      <button 
        onClick={onClick} 
        className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full py-2 transition-all active:scale-95 relative ${active ? 'bg-[#1a1f35]/80' : ''}`}
      >
        <div className={`${active ? 'text-[#6366f1]' : 'text-slate-500'}`}>
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5 lg:w-6 lg:h-6' }) : icon}
        </div>
        <span className={`text-[8px] font-bold tracking-tight whitespace-nowrap ${active ? 'text-[#6366f1]' : 'text-slate-500'}`}>{label}</span>
      </button>
    );
  }

  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-4 px-6 py-3.5 rounded-xl transition-all group ${active ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/20'}`}
    >
      <div className={`${active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' }) : icon}
      </div>
      <span className={`text-sm font-bold tracking-tight ${active ? 'text-indigo-400' : ''}`}>{label}</span>
    </button>
  );
}

// --- Main Application ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>('auth');
  const [loginRole, setLoginRole] = useState<UserRole>(UserRole.WORKER);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [showEnrollConfirm, setShowEnrollConfirm] = useState(false);
  const [selectedJobForEnroll, setSelectedJobForEnroll] = useState<Job | null>(null);

  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [qrFileToProcess, setQrFileToProcess] = useState<File | null>(null);
  const [showQrConfirmModal, setShowQrConfirmModal] = useState(false);
  const [qrWarningMessage, setQrWarningMessage] = useState<string | null>(null);

  const [loginError, setLoginError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activityListRef = useRef<HTMLDivElement>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const fetchData = async () => {
    try {
      const [j, e, w] = await Promise.all([
        db.getJobs(),
        db.getEnrollments(),
        db.getWithdrawals()
      ]);
      setJobs(j || []);
      setEnrollments(e || []);
      setWithdrawals(w || []);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const profile = await db.getUserByEmail(session.user.email);
        if (profile) setUser(profile);
      }
    } catch (err) {
      console.error("Data Fetch Error:", err);
    }
  };

  useEffect(() => {
    // Auth Listener for OAuth (Google) redirects
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        let profile = await db.getUserByEmail(session.user.email!);
        if (!profile) {
          // Auto-create profile for new Google users
          profile = {
            id: session.user.id,
            name: session.user.user_metadata.full_name || 'Worker',
            email: session.user.email!,
            role: UserRole.WORKER,
            balance: 0,
          };
          await db.saveUser(profile);
        }
        setUser(profile);
        setView('home');
      } else {
        // Only switch to auth if we were not already there
        // or if it's a signed out event
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setView('auth');
        }
      }
      await fetchData();
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error("Google Auth Error:", err);
      setLoginError(true);
      setIsLoading(false);
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
        await fetchData();
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

  const handleQrFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQrFileToProcess(file);
      setShowQrConfirmModal(true);
    }
    e.target.value = '';
  };

  const processAndUploadQR = async () => {
    if (!qrFileToProcess || !user) return;
    setShowQrConfirmModal(false);
    setIsProcessingQR(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        const base64String = dataUrl.split(',')[1];
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: base64String, mimeType: qrFileToProcess.type } },
              { text: "Examine this image. Is it a clear UPI/Payment QR code? If it is a QR code, answer only 'YES'. If it is anything else, answer only 'NO'." }
            ]
          }
        });
        const result = response.text?.trim().toUpperCase();
        if (result === 'YES') {
          await db.updateUser(user.id, { qrCode: dataUrl });
          setUser({ ...user, qrCode: dataUrl });
          setQrWarningMessage(null);
          await fetchData();
        } else {
          setQrWarningMessage("Warning: Invalid Image. Please upload a clear image of your payment QR code only.");
        }
        setIsProcessingQR(false);
        setQrFileToProcess(null);
      };
      reader.readAsDataURL(qrFileToProcess);
    } catch (err) {
      console.error(err);
      setQrWarningMessage("Error processing image. Please try again.");
      setIsProcessingQR(false);
      setQrFileToProcess(null);
    }
  };

  const handleEnrollAttempt = (job: Job) => {
    if (!user) return;
    const isEnrolled = enrollments.some(e => e.userId === user.id && e.jobId === job.id);
    if (isEnrolled) {
      handleEnrollConfirm(job);
    } else {
      if (job.enrolledCount >= job.maxWorkers) {
        alert("This event is full.");
        return;
      }
      setSelectedJobForEnroll(job);
      setShowEnrollConfirm(true);
    }
  };

  const handleEnrollConfirm = async (jobOverride?: Job) => {
    const job = jobOverride || selectedJobForEnroll;
    if (!user || !job) return;
    const isEnrolled = enrollments.some(e => e.userId === user.id && e.jobId === job.id);
    try {
      if (isEnrolled) {
        await db.deleteEnrollmentByUserAndJob(user.id, job.id);
        await db.updateJob(job.id, { enrolledCount: Math.max(0, job.enrolledCount - 1) });
      } else {
        await db.saveEnrollment({
          id: crypto.randomUUID(),
          userId: user.id,
          jobId: job.id,
          enrolledAt: new Date().toISOString()
        });
        await db.updateJob(job.id, { enrolledCount: job.enrolledCount + 1 });
      }
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setShowEnrollConfirm(false);
      setSelectedJobForEnroll(null);
    }
  };

  const handleWithdrawalAttempt = () => {
    if (!user || !withdrawalAmount) return;
    const amount = parseFloat(withdrawalAmount);
    setBalanceWarning(null);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > user.balance) {
      setBalanceWarning("Insufficient Balance");
      activityListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setShowWithdrawConfirm(true);
  };

  const confirmWithdrawal = async () => {
    if (!user || !withdrawalAmount) return;
    const amount = parseFloat(withdrawalAmount);
    setIsSubmittingWithdrawal(true);
    setShowWithdrawConfirm(false);
    try {
      await db.saveWithdrawal({
        id: crypto.randomUUID(),
        userId: user.id,
        amount: amount,
        status: WithdrawalStatus.PENDING,
        createdAt: new Date().toISOString()
      });
      const newBalance = user.balance - amount;
      await db.updateUser(user.id, { balance: newBalance });
      setUser({ ...user, balance: newBalance });
      setWithdrawalAmount('');
      await fetchData();
      activityListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  const openMap = (location: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    window.open(url, '_blank');
  };

  const handleEmailSupport = () => {
    window.location.href = "mailto:crewmp54@gmail.com?subject=CrewX Support Request&body=Hi CrewX Team,";
  };

  const handleWhatsAppSupport = () => {
    window.open("https://wa.me/916282913521", "_blank");
  };

  const handleJoinCommunity = () => {
    window.open("https://chat.whatsapp.com/BCAQOkUYBLL0dTNz5CbvUH?mode=gi_t", "_blank");
  };

  if (isLoading) return <LoadingOverlay />;

  const userEnrollments = enrollments.filter(e => e.userId === user?.id);
  const enrolledJobs = jobs.filter(j => enrollments.some(e => e.userId === user?.id && e.jobId === j.id));
  const openJobs = jobs.filter(j => j.status === JobStatus.OPEN);
  const userWithdrawals = withdrawals.filter(w => w.userId === user?.id);
  const recentWithdrawal = userWithdrawals[0];
  const finalPayouts = userWithdrawals.filter(w => w.status === WithdrawalStatus.APPROVED || w.status === WithdrawalStatus.REJECTED);

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-5 overflow-hidden">
        <Card className="max-w-md w-full p-6 lg:p-10 text-center border-slate-800">
          <Logo className="mb-8 justify-center" />
          <div className="flex bg-[#080C17] p-1 rounded-xl mb-8 border border-slate-800">
            <button onClick={() => setLoginRole(UserRole.WORKER)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${loginRole === UserRole.WORKER ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Worker</button>
            <button onClick={() => setLoginRole(UserRole.ADMIN)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${loginRole === UserRole.ADMIN ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Admin</button>
          </div>
          {loginRole === UserRole.WORKER ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col items-center w-full">
              <h2 className="text-xl font-bold text-white mb-2">Worker Portal</h2>
              <p className="text-slate-400 text-[10px] lg:text-sm mb-8 uppercase tracking-widest font-medium text-center">Identity Verification Required</p>
              
              <button 
                onClick={handleGoogleLogin} 
                className="w-full bg-white hover:bg-slate-100 text-slate-950 font-black py-4 rounded-xl shadow-lg transition-all mb-4 uppercase tracking-widest text-xs active:scale-95 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
              
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-4">
                Fast & Secure Access
              </p>
              {loginError && <p className="text-rose-500 text-[10px] font-bold text-center mt-4">Authentication failed. Please try again.</p>}
            </div>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4 text-left w-full">
              <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required placeholder="Admin Email" className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs" />
              <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required placeholder="Admin Password" className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs" />
              {loginError && <p className="text-rose-500 text-[10px] font-bold text-center">Admin access denied</p>}
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all text-xs uppercase tracking-widest active:scale-95">ADMIN LOGIN</button>
            </form>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col lg:flex-row bg-[#020617] text-slate-100 font-inter overflow-hidden">
      <aside className="hidden lg:flex w-[280px] bg-[#050914] border-r border-white/5 flex-col shrink-0">
        <div className="p-10 mb-6"><Logo /></div>
        <nav className="flex-1 px-4 flex flex-col gap-2">
          <NavItem icon={<Icons.Dashboard />} label="Home" active={view === 'home'} onClick={() => setView('home')} />
          <NavItem icon={<Icons.Briefcase />} label="Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
          <NavItem icon={<Icons.Wallet />} label="Wallet" active={view === 'wallet'} onClick={() => setView('wallet')} />
          <NavItem icon={<Icons.Check />} label="Enrolled" active={view === 'enrolled'} onClick={() => setView('enrolled')} />
          <NavItem icon={<Icons.Users />} label="Contact" active={view === 'contact'} onClick={() => setView('contact')} />
          <NavItem icon={<Icons.Dashboard />} label="Payout Hist." active={view === 'payout_hist'} onClick={() => setView('payout_hist')} />
          <div className="mt-auto mb-10"><NavItem icon={<Icons.Logout />} label="Exit" active={false} onClick={() => setShowLogoutConfirm(true)} /></div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <header className="h-[70px] lg:h-[90px] flex items-center justify-between px-6 lg:px-10 shrink-0 border-b border-white/5 bg-[#020617]/95 backdrop-blur-md z-[50]">
          <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight uppercase">
            {view === 'jobs' ? 'Jobs' : view === 'home' ? 'Dashboard Overview' : view === 'enrolled' ? 'Enrolled Events' : view === 'contact' ? 'Contact' : view === 'payout_hist' ? 'Payout History' : view.toUpperCase()}
          </h1>
          <div className="flex items-center gap-6">
            <button className="text-slate-400 hover:text-white transition-colors relative">
              <Icons.Bell className="w-6 h-6" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full border border-[#020617]"></span>
            </button>
            <Avatar name={user?.name || 'E'} />
          </div>
        </header>

        <div className="p-6 lg:p-10 overflow-y-auto flex-1 scrollbar-hide max-w-4xl mx-auto w-full pb-24 lg:pb-10">
          {view === 'home' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex flex-col gap-4">
                <StatCard label="MY WALLET" value={`${user?.balance?.toFixed(0) || '0'} Rs`} icon={<Icons.Wallet />} color="text-emerald-400" onClick={() => setView('wallet')} />
                <StatCard label="ENROLLED" value={userEnrollments.length.toString()} icon={<Icons.Check />} color="text-indigo-400" onClick={() => setView('enrolled')} />
                <StatCard label="AVAILABLE JOBS" value={openJobs.length.toString()} icon={<Icons.Briefcase />} color="text-indigo-400" onClick={() => setView('jobs')} />
              </div>
              <Card className="px-5 py-4 flex items-center justify-between gap-4 border-indigo-500/10 bg-[#0b1222]">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/10 shrink-0">
                    <Icons.Wallet className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">RECENT PAYOUT SUMMARY</p>
                    <p className="text-[10px] text-slate-500 font-medium italic truncate leading-tight">
                      {recentWithdrawal ? `Request: ${recentWithdrawal.amount} Rs is ${recentWithdrawal.status}.` : "No completed payouts recorded yet."}
                    </p>
                  </div>
                </div>
                <button onClick={() => setView('payout_hist')} className="px-4 py-2 bg-[#6366f1] hover:bg-[#5558e3] text-white text-[9px] font-black uppercase rounded-[10px] transition-all flex items-center gap-1.5 shadow-lg active:scale-95 shrink-0 h-fit">
                  VIEW ALL <Icons.Check className="w-3 h-3" />
                </button>
              </Card>
              <div className="grid grid-cols-1 gap-6">
                <Card className="p-6 lg:p-8 flex flex-col h-[280px] overflow-hidden">
                   <div className="flex items-center gap-3 mb-5 shrink-0">
                     <Icons.Briefcase className="w-4 h-4 text-indigo-400" />
                     <h3 className="font-black text-white text-base uppercase tracking-tight">Upcoming Events</h3>
                   </div>
                   <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide">
                     {openJobs.length > 0 ? (
                       <div className="space-y-3">
                         {openJobs.map(job => (
                           <div key={job.id} onClick={() => setView('jobs')} className="p-3.5 bg-slate-900/40 border border-white/5 rounded-xl flex justify-between items-center cursor-pointer hover:bg-slate-800/40 transition-colors group">
                             <div className="min-w-0">
                               <p className="font-bold text-white uppercase text-xs truncate group-hover:text-indigo-400 transition-colors">{job.title}</p>
                               <p className="text-[10px] text-slate-500 truncate">{job.location} • {job.date}</p>
                             </div>
                             <div className="text-right ml-4 shrink-0">
                               <p className="font-black text-indigo-400 text-sm">{job.pay} Rs</p>
                               <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">DETAILS</span>
                             </div>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="h-full border border-dashed border-slate-800 rounded-xl flex items-center justify-center">
                          <p className="text-xs text-slate-600 font-medium italic">No events available.</p>
                       </div>
                     )}
                   </div>
                </Card>
                <Card className="p-8 flex flex-col items-center overflow-hidden">
                  <h3 className="text-base font-black text-white uppercase mb-8">Payment Gateway</h3>
                  <div className="w-full max-w-[280px] border border-dashed border-slate-800 rounded-[35px] p-8 flex flex-col items-center justify-center gap-6 group">
                    <div className="w-20 h-20 rounded-[28px] bg-slate-900 border border-white/5 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl transition-transform hover:scale-105">
                      {user?.qrCode ? (
                        <img src={user.qrCode} alt="Linked QR" className="w-full h-full object-cover" />
                      ) : (
                        <Icons.Wallet className="w-9 h-9 text-slate-700" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">{user?.qrCode ? "UPI QR LINKED" : "No QR Linked"}</p>
                      {user?.qrCode && <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest animate-pulse">VERIFIED</p>}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleQrFileSelected} />
                    <button disabled={isProcessingQR} onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black uppercase rounded-xl shadow-xl transition-all tracking-widest active:scale-95">
                      {isProcessingQR ? "AI VALIDATING..." : user?.qrCode ? "UPDATE QR" : "LINK UPI QR"}
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {view === 'wallet' && (
            <div className="space-y-10 animate-in fade-in duration-500 max-w-2xl mx-auto">
              <div className="relative rounded-[32px] p-10 bg-gradient-to-br from-[#4f46e5] to-[#1e1b4b] overflow-hidden shadow-2xl border border-white/10 flex flex-col items-center text-center">
                 <Icons.Wallet className="absolute -right-8 -bottom-8 w-64 h-64 text-white/5 rotate-12 pointer-events-none" />
                 <span className="text-xs font-black text-indigo-200/60 uppercase tracking-[0.2em] mb-4">AVAILABLE BALANCE</span>
                 <h2 className="text-[64px] font-black text-white leading-none tracking-tighter mb-12">
                   {user?.balance?.toFixed(0) || '0'} Rs
                 </h2>
                 <div className="w-full space-y-4 relative z-10">
                   <div className="relative">
                      <input 
                        type="number" 
                        value={withdrawalAmount}
                        onChange={(e) => { setWithdrawalAmount(e.target.value); setBalanceWarning(null); }}
                        placeholder="Enter Amount" 
                        className="w-full bg-[#1e1b4b]/60 border border-white/10 rounded-[20px] py-5 px-8 text-white text-lg font-bold placeholder:text-indigo-300/40 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-center"
                      />
                   </div>
                   <button 
                    onClick={handleWithdrawalAttempt}
                    disabled={isSubmittingWithdrawal || !withdrawalAmount}
                    className="w-full bg-[#059669] hover:bg-[#047857] disabled:bg-slate-700 text-white py-5 rounded-[20px] text-base font-black uppercase tracking-[0.1em] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                   >
                     {isSubmittingWithdrawal ? "PROCESSING..." : "WITHDRAW"}
                   </button>
                 </div>
              </div>
              <div ref={activityListRef} className="space-y-6 scroll-mt-20">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.15em]">RECENT ACTIVITY</h3>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{userWithdrawals.length} TOTAL</span>
                </div>
                <div className="min-h-[200px] border-2 border-dashed border-slate-800/50 rounded-[32px] flex flex-col items-center justify-start p-6 text-center relative overflow-hidden">
                   {balanceWarning && (
                     <div className="w-full mb-4 animate-in slide-in-from-top-4 duration-300">
                        <div className="p-4 bg-rose-600/10 border border-rose-500/30 rounded-2xl flex items-center gap-4 text-left">
                           <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                              <Icons.XMark className="w-5 h-5 text-rose-500" />
                           </div>
                           <div>
                              <p className="text-xs font-bold text-rose-500 uppercase tracking-widest">Warning</p>
                              <p className="text-[10px] text-rose-300 font-medium">Insufficient balance to process withdrawal request.</p>
                           </div>
                        </div>
                     </div>
                   )}
                   {userWithdrawals.length > 0 ? (
                     <div className="w-full space-y-4">
                       {userWithdrawals.map(w => (
                         <div key={w.id} className="p-4 bg-[#0b1222] border border-white/5 rounded-2xl flex justify-between items-center animate-in fade-in duration-500">
                            <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                 w.status === WithdrawalStatus.APPROVED ? 'bg-emerald-500/10 text-emerald-500' : 
                                 w.status === WithdrawalStatus.REJECTED ? 'bg-rose-500/10 text-rose-500' :
                                 'bg-amber-500/10 text-amber-500'
                               }`}>
                                 <Icons.Wallet className="w-5 h-5" />
                               </div>
                               <div className="text-left min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-black text-white uppercase truncate">{w.status} Request</p>
                                    {w.status === WithdrawalStatus.PENDING && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>}
                                  </div>
                                  <p className="text-[9px] text-slate-500 font-medium truncate">{new Date(w.createdAt).toLocaleDateString()} • {new Date(w.createdAt).toLocaleTimeString()}</p>
                               </div>
                            </div>
                            <div className="text-right ml-4 shrink-0">
                               <p className="text-sm font-black text-white">-{w.amount} Rs</p>
                               <p className={`text-[8px] font-black uppercase tracking-tighter ${
                                 w.status === WithdrawalStatus.APPROVED ? 'text-emerald-500' : 
                                 w.status === WithdrawalStatus.REJECTED ? 'text-rose-500' :
                                 'text-amber-500'
                               }`}>{w.status}</p>
                            </div>
                         </div>
                       ))}
                     </div>
                   ) : !balanceWarning && (
                     <div className="h-full flex-1 flex flex-col items-center justify-center gap-4 opacity-30 mt-10">
                        <div className="w-14 h-14 bg-slate-900 border border-white/5 rounded-2xl flex items-center justify-center shadow-lg">
                           <Icons.Briefcase className="w-7 h-7 text-slate-700" />
                        </div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">NO PAYOUTS FOUND</p>
                     </div>
                   )}
                </div>
              </div>
            </div>
          )}

          {view === 'jobs' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Event Opportunities</h2>
              <div className="flex flex-col gap-6 pb-10">
                {openJobs.map(job => {
                  const isEnrolled = enrollments.some(e => e.userId === user?.id && e.jobId === job.id);
                  return (
                    <div key={job.id} className="relative group">
                       <div className="absolute inset-x-0 -top-[2px] h-[3px] bg-indigo-500/50 rounded-full blur-[1px]"></div>
                       <Card className="p-0 overflow-hidden border-[#1e293b]">
                          <div className="p-6 space-y-5">
                            <div className="flex items-start justify-between">
                              <div className="min-w-0">
                                <h3 className="text-xl font-black text-white mb-1.5 tracking-tight uppercase truncate">{job.title}</h3>
                                <div className="flex items-center gap-2">
                                  <span className="text-[#6366f1] text-xs font-bold">{job.location}</span>
                                  <button onClick={() => openMap(job.location)} className="px-1.5 py-0.5 bg-[#1e293b] hover:bg-slate-700 text-slate-400 text-[9px] font-black uppercase rounded-[3px] transition-colors">MAP</button>
                                </div>
                              </div>
                              <span className="px-3 py-1 bg-[#052e16] text-[#22c55e] text-[10px] font-black uppercase rounded-full border border-[#14532d] shrink-0">
                                {job.status}
                              </span>
                            </div>
                            <div className="bg-[#101827] rounded-[20px] p-6 space-y-4 border border-white/5">
                               <div className="flex items-center justify-between">
                                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">DATE</span>
                                 <span className="text-base font-black text-white tracking-tight">{job.date}</span>
                               </div>
                               <div className="flex items-center justify-between">
                                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">PAYMENT</span>
                                 <span className="text-base font-black text-[#22c55e] tracking-tight">{job.pay} Rs</span>
                               </div>
                               <div className="flex items-center justify-between">
                                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">STAFF</span>
                                 <span className="text-base font-black text-white tracking-tight">{job.enrolledCount} / {job.maxWorkers}</span>
                               </div>
                            </div>
                            <button onClick={() => handleEnrollAttempt(job)} disabled={!isEnrolled && job.enrolledCount >= job.maxWorkers} className={`w-full py-4 rounded-[14px] text-base font-black uppercase tracking-[0.05em] transition-all shadow-xl active:scale-95 ${isEnrolled ? 'bg-rose-600 hover:bg-rose-700 text-white' : job.enrolledCount >= job.maxWorkers ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-[#6366f1] hover:bg-[#5558e3] text-white'}`}>
                              {isEnrolled ? 'CANCEL ENROLLMENT' : job.enrolledCount >= job.maxWorkers ? 'FULLY BOOKED' : 'ENROLL NOW'}
                            </button>
                          </div>
                       </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'enrolled' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">My Current Assignments</h2>
              <div className="flex flex-col gap-6 pb-10">
                {enrolledJobs.length > 0 ? enrolledJobs.map(job => (
                    <div key={job.id} className="relative group">
                       <div className="absolute inset-x-0 -top-[2px] h-[3px] bg-emerald-500/50 rounded-full blur-[1px]"></div>
                       <Card className="p-0 overflow-hidden border-emerald-500/10">
                          <div className="p-6 space-y-5">
                            <div className="flex items-start justify-between">
                              <div className="min-w-0">
                                <h3 className="text-xl font-black text-white mb-1.5 tracking-tight uppercase truncate">{job.title}</h3>
                                <div className="flex items-center gap-2">
                                  <span className="text-[#6366f1] text-xs font-bold">{job.location}</span>
                                  <button onClick={() => openMap(job.location)} className="px-1.5 py-0.5 bg-[#1e293b] hover:bg-slate-700 text-slate-400 text-[9px] font-black uppercase rounded-[3px] transition-colors">MAP</button>
                                </div>
                              </div>
                              <span className="px-3 py-1 bg-[#064e3b] text-[#34d399] text-[10px] font-black uppercase rounded-full border border-[#065f46] shrink-0">
                                ENROLLED
                              </span>
                            </div>
                            <div className="bg-[#101827] rounded-[20px] p-6 space-y-4 border border-white/5">
                               <div className="flex items-center justify-between">
                                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">DATE</span>
                                 <span className="text-base font-black text-white tracking-tight">{job.date}</span>
                               </div>
                               <div className="flex items-center justify-between">
                                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">REPORTING TIME</span>
                                 <span className="text-base font-black text-white tracking-tight">{job.time}</span>
                               </div>
                               <div className="flex items-center justify-between">
                                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">ESTIMATED PAY</span>
                                 <span className="text-base font-black text-[#22c55e] tracking-tight">{job.pay} Rs</span>
                               </div>
                            </div>
                            <button onClick={() => handleEnrollAttempt(job)} className="w-full py-4 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 rounded-[14px] text-base font-black uppercase tracking-[0.05em] transition-all active:scale-95">
                              CANCEL ENROLLMENT
                            </button>
                          </div>
                       </Card>
                    </div>
                )) : (
                  <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-[32px]">
                    <Icons.Check className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">No active assignments yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'contact' && (
            <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl mx-auto pb-10">
              <Card className="p-8 lg:p-10 text-center flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-8">
                   <Icons.Users className="w-10 h-10 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">DIRECT SUPPORT</h2>
                <p className="text-sm text-slate-400 font-medium mb-10 leading-relaxed max-w-xs mx-auto">
                  Having issues? Connect with our team directly for immediate assistance.
                </p>
                <div className="w-full space-y-4">
                  <button onClick={handleEmailSupport} className="w-full py-5 bg-[#1e293b] hover:bg-[#2d3a4f] text-white text-xs font-black uppercase rounded-2xl transition-all shadow-xl active:scale-95 tracking-widest">EMAIL SUPPORT</button>
                  <button onClick={handleWhatsAppSupport} className="w-full py-5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-black uppercase rounded-2xl transition-all shadow-xl active:scale-95 tracking-widest">WHATSAPP CHAT</button>
                </div>
              </Card>
              <Card className="p-8 lg:p-10 text-center flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-8">
                   <Icons.Users className="w-10 h-10 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">JOIN WORKER COMMUNITY</h2>
                <p className="text-sm text-slate-400 font-medium mb-10 leading-relaxed max-w-xs mx-auto">
                  Get real-time updates on new jobs, event changes, and interact with other crew members.
                </p>
                <button onClick={handleJoinCommunity} className="w-full py-5 bg-[#6366f1] hover:bg-[#5558e3] text-white text-xs font-black uppercase rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 tracking-widest">
                  JOIN OUR WHATSAPP COMMUNITY <Icons.Plus className="w-4 h-4" />
                </button>
              </Card>
            </div>
          )}

          {view === 'payout_hist' && (
            <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto pb-10">
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Finalized Payouts</h2>
              <div className="space-y-4">
                 {finalPayouts.length > 0 ? finalPayouts.map(w => (
                   <div key={w.id} className="p-5 bg-[#0b1222] border border-white/5 rounded-3xl flex justify-between items-center shadow-xl">
                      <div className="flex items-center gap-4 min-w-0">
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                           w.status === WithdrawalStatus.APPROVED ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                         }`}>
                           <Icons.Wallet className="w-6 h-6" />
                         </div>
                         <div className="text-left min-w-0">
                            <p className="text-sm font-black text-white uppercase truncate">{w.status} TRANSACTION</p>
                            <p className="text-[10px] text-slate-500 font-bold">{new Date(w.createdAt).toLocaleDateString()} • {new Date(w.createdAt).toLocaleTimeString()}</p>
                         </div>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                         <p className={`text-base font-black ${w.status === WithdrawalStatus.APPROVED ? 'text-emerald-400' : 'text-rose-400'}`}>
                           {w.status === WithdrawalStatus.APPROVED ? '-' : ''}{w.amount} Rs
                         </p>
                         <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                           w.status === WithdrawalStatus.APPROVED ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/5 text-rose-500 border-rose-500/20'
                         }`}>{w.status}</span>
                      </div>
                   </div>
                 )) : (
                   <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-[32px] bg-[#0b1222]/30">
                     <Icons.Dashboard className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
                     <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">No finalized payout records yet.</p>
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>

        <nav className="lg:hidden h-[60px] bg-[#0b101c] border-t border-white/5 flex items-stretch justify-around fixed bottom-0 left-0 right-0 z-[100] shadow-[0_-8px_30px_rgb(0,0,0,0.5)]">
          <NavItem isMobile icon={<Icons.Dashboard />} label="Home" active={view === 'home'} onClick={() => setView('home')} />
          <NavItem isMobile icon={<Icons.Briefcase />} label="Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
          <NavItem isMobile icon={<Icons.Wallet />} label="Wallet" active={view === 'wallet'} onClick={() => setView('wallet')} />
          <NavItem isMobile icon={<Icons.Check />} label="Enrolled" active={view === 'enrolled'} onClick={() => setView('enrolled')} />
          <NavItem isMobile icon={<Icons.Users />} label="Contact" active={view === 'contact'} onClick={() => setView('contact')} />
          <NavItem isMobile icon={<Icons.Dashboard />} label="Payout Hist." active={view === 'payout_hist'} onClick={() => setView('payout_hist')} />
          <NavItem isMobile icon={<Icons.Logout />} label="Exit" active={false} onClick={() => setShowLogoutConfirm(true)} />
        </nav>
      </main>

      {showEnrollConfirm && (
        <Modal centered title="Confirm Enrollment" onClose={() => setShowEnrollConfirm(false)}>
           <div className="text-center">
              <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed px-4">
                Are you sure you want to enroll in <span className="text-white font-black">{selectedJobForEnroll?.title}</span>? 
                Please ensure you are available on <span className="text-white font-black">{selectedJobForEnroll?.date}</span>.
              </p>
              <div className="flex gap-3">
                 <button onClick={() => setShowEnrollConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">CANCEL</button>
                 <button onClick={() => handleEnrollConfirm()} className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95">CONFIRM</button>
              </div>
           </div>
        </Modal>
      )}

      {showWithdrawConfirm && (
        <Modal centered title="Confirm Payout" onClose={() => setShowWithdrawConfirm(false)}>
           <div className="text-center">
              <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed px-4">
                Are you sure you want to withdraw <span className="text-white font-black">{withdrawalAmount} Rs</span>? 
              </p>
              <div className="flex gap-3">
                 <button onClick={() => setShowWithdrawConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">CANCEL</button>
                 <button onClick={confirmWithdrawal} className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95">YES, PROCEED</button>
              </div>
           </div>
        </Modal>
      )}

      {showQrConfirmModal && (
        <Modal centered title="Confirm Upload" onClose={() => setShowQrConfirmModal(false)}>
           <div className="text-center">
              <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed">Confirm upload of this QR image? Our AI will validate it before linking.</p>
              <div className="flex gap-3">
                 <button onClick={() => { setQrFileToProcess(null); setShowQrConfirmModal(false); }} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">CANCEL</button>
                 <button onClick={processAndUploadQR} className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95">PROCEED</button>
              </div>
           </div>
        </Modal>
      )}

      {qrWarningMessage && (
        <Modal centered title="Invalid Image" onClose={() => setQrWarningMessage(null)}>
           <div className="text-center">
              <div className="w-12 h-12 bg-rose-600/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><Icons.XMark className="w-6 h-6 text-rose-500" /></div>
              <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed px-2">{qrWarningMessage}</p>
              <button onClick={() => setQrWarningMessage(null)} className="w-full py-3 bg-slate-800 text-white font-black rounded-xl text-[10px] uppercase tracking-widest active:scale-95">RETRY</button>
           </div>
        </Modal>
      )}

      {showLogoutConfirm && (
        <Modal centered title="Confirm Exit" onClose={() => setShowLogoutConfirm(false)}>
           <div className="text-center">
              <p className="text-xs text-slate-400 font-medium mb-8">Ready to end your current session?</p>
              <div className="flex gap-3">
                 <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">CANCEL</button>
                 <button onClick={handleLogout} className="flex-1 py-3 bg-rose-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95">LOGOUT</button>
              </div>
           </div>
        </Modal>
      )}
    </div>
  );
}
