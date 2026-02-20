
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
    <div className={`${size} rounded-full flex items-center justify-center font-bold text-sm bg-indigo-900/40 text-indigo-400 border border-indigo-500/30 uppercase shadow-lg shrink-0 ${className}`}>
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
      <div className="p-6 lg:p-8 max-h-[85vh] overflow-y-auto">
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
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' }) : icon}
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
  const [view, setView] = useState<AppView | 'onboarding'>('auth');
  const [loginRole, setLoginRole] = useState<UserRole>(UserRole.WORKER);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Standard View Logic
  const isAdmin = user?.role === UserRole.ADMIN;

  // Confirmations & States
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [showEnrollConfirm, setShowEnrollConfirm] = useState(false);
  const [selectedJobForEnroll, setSelectedJobForEnroll] = useState<Job | null>(null);

  // Admin Specific Modals
  const [viewingStaffForJob, setViewingStaffForJob] = useState<Job | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [viewingWorkerHistory, setViewingWorkerHistory] = useState<User | null>(null);
  const [actionConfirm, setActionConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [qrFileToProcess, setQrFileToProcess] = useState<File | null>(null);
  const [showQrConfirmModal, setShowQrConfirmModal] = useState(false);
  const [qrWarningMessage, setQrWarningMessage] = useState<string | null>(null);

  const [loginError, setLoginError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activityListRef = useRef<HTMLDivElement>(null);

  // App Data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [workers, setWorkers] = useState<User[]>([]);
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState('');

  // Admin Auth Inputs
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Onboarding State
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    phone: '',
    age: '',
    experience: '',
    place: ''
  });

  const fetchData = async () => {
    try {
      const [j, e, w, u] = await Promise.all([
        db.getJobs(),
        db.getEnrollments(),
        db.getWithdrawals(),
        db.getUsers()
      ]);
      setJobs(j || []);
      setEnrollments(e || []);
      setWithdrawals(w || []);
      setWorkers(u || []);
    } catch (err) {
      console.error("Data Fetch Error:", err);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await syncUserProfile(session.user);
      } else {
        setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        await syncUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setView('auth');
        setIsLoading(false);
      }
    });

    initSession();
    return () => subscription.unsubscribe();
  }, []);

  const syncUserProfile = async (supabaseUserOrEmail: any) => {
    setIsSyncing(true);
    try {
      const email = typeof supabaseUserOrEmail === 'string' ? supabaseUserOrEmail : supabaseUserOrEmail.email;
      let profile = await db.getUserByEmail(email!);
      
      if (!profile) {
        profile = {
          id: typeof supabaseUserOrEmail === 'string' ? '00000000-0000-0000-0000-000000000001' : supabaseUserOrEmail.id,
          name: typeof supabaseUserOrEmail === 'string' ? 'Madhav P' : (supabaseUserOrEmail.user_metadata?.full_name || 'Worker'),
          email: email!,
          role: UserRole.WORKER,
          balance: 0,
        };
        await db.saveUser(profile);
      }

      const verifiedProfile = await db.getUserByEmail(email!);
      if (verifiedProfile) {
        setUser(verifiedProfile);
        await fetchData();
        
        if (verifiedProfile.role === UserRole.ADMIN) {
          setView('admin_dashboard');
        } else {
          const employeeDetails = await db.getEmployeeDetails(verifiedProfile.id);
          
          if (!employeeDetails) {
            setOnboardingData({
              name: verifiedProfile.name || '',
              phone: '',
              age: '',
              experience: '',
              place: ''
            });
            setView('onboarding');
          } else {
            setUser({
              ...verifiedProfile,
              phone: employeeDetails.phone_number,
              age: employeeDetails.age,
              experience: employeeDetails.experience_works,
              place: employeeDetails.place
            });
            setView('home');
          }
        }
      }
    } catch (err) {
      console.error("Profile Sync Error:", err);
      setLoginError(true);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSyncing(true);
    try {
      const details = {
        user_id: user.id,
        name: onboardingData.name,
        email: user.email,
        phone_number: onboardingData.phone,
        age: parseInt(onboardingData.age),
        experience_works: parseInt(onboardingData.experience) || 0,
        place: onboardingData.place
      };
      
      await db.saveEmployeeDetails(details);
      
      setUser({
        ...user,
        name: details.name,
        phone: details.phone_number,
        age: details.age,
        experience: details.experience_works,
        place: details.place
      });
      setView('home');
      await fetchData();
    } catch (err) {
      console.error("Onboarding failed:", err);
      alert("Error saving profile details.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoginError(false);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error("Google Auth Error:", err);
      setLoginError(true);
    }
  };

  const handleDirectAccess = async () => {
    const directEmail = "mp.madhav.2006@gmail.com";
    await syncUserProfile(directEmail);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    setIsSyncing(true);
    const emailToVerify = adminEmail.trim().toLowerCase();
    const passToVerify = adminPassword.trim();
    try {
      const isValid = await db.verifyAdmin(emailToVerify, passToVerify);
      if (isValid) {
        let profile = await db.getUserByEmail(emailToVerify);
        if (!profile) {
          profile = { id: crypto.randomUUID(), name: 'Admin', email: emailToVerify, role: UserRole.ADMIN, balance: 0 };
          await db.saveUser(profile);
        }
        setUser(profile);
        setView('admin_dashboard');
        await fetchData();
      } else {
        setLoginError(true);
      }
    } catch (err) {
      console.error("Admin Login Error:", err);
      setLoginError(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEnrollConfirm = async (jobOverride?: Job) => {
    const job = jobOverride || selectedJobForEnroll;
    if (!user || !job) {
      setShowEnrollConfirm(false);
      return;
    }

    setIsSyncing(true);
    try {
      const isEnrolled = enrollments.some(e => e.userId === user.id && e.jobId === job.id);
      if (isEnrolled) {
        await db.deleteEnrollmentByUserAndJob(user.id, job.id);
        await db.updateJob(job.id, { enrolledCount: Math.max(0, job.enrolledCount - 1) });
      } else {
        await db.saveEnrollment({
          userId: user.id,
          jobId: job.id,
          enrolledAt: new Date().toISOString()
        });
        await db.updateJob(job.id, { enrolledCount: job.enrolledCount + 1 });
      }
      await fetchData();
    } catch (err) {
      console.error("Enrollment failed:", err);
      alert("Failed to update enrollment.");
    } finally {
      setIsSyncing(false);
      setShowEnrollConfirm(false);
      setSelectedJobForEnroll(null);
    }
  };

  const handleEnrollAttempt = (job: Job) => {
    if (!user) {
       alert("Please sign in to enroll.");
       setView('auth');
       return;
    }
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
              { text: "Examine this image. Is it a clear UPI/Payment QR code? Answer only 'YES' or 'NO'." }
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
          setQrWarningMessage("Invalid QR code detected.");
        }
        setIsProcessingQR(false);
        setQrFileToProcess(null);
      };
      reader.readAsDataURL(qrFileToProcess);
    } catch (err) {
      console.error(err);
      setQrWarningMessage("Error processing image.");
      setIsProcessingQR(false);
      setQrFileToProcess(null);
    }
  };

  const openMap = (location: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    window.open(url, '_blank');
  };

  if (isLoading) return <LoadingOverlay message="initializing CREWX..." />;

  const openJobs = jobs.filter(j => j.status === JobStatus.OPEN);
  const userWithdrawals = withdrawals.filter(w => w.userId === user?.id);

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-5 relative overflow-hidden">
        {isSyncing && <LoadingOverlay message="Authenticating..." />}
        <Card className="max-w-md w-full p-6 lg:p-10 text-center border-slate-800 relative z-10">
          <Logo className="mb-8 justify-center" />
          <div className="flex bg-[#080C17] p-1 rounded-xl mb-8 border border-slate-800">
            <button onClick={() => setLoginRole(UserRole.WORKER)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${loginRole === UserRole.WORKER ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Worker</button>
            <button onClick={() => setLoginRole(UserRole.ADMIN)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${loginRole === UserRole.ADMIN ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Admin</button>
          </div>
          {loginRole === UserRole.WORKER ? (
            <div className="flex flex-col items-center w-full">
              <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Staff Entrance</h2>
              <p className="text-slate-400 text-[10px] mb-8 uppercase tracking-widest font-medium text-center">Identity Verification Required</p>
              <button onClick={handleGoogleLogin} className="w-full bg-white hover:bg-slate-100 text-slate-950 font-black py-4 rounded-xl shadow-lg transition-all mb-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </button>
              <div className="w-full flex items-center gap-4 my-6"><div className="h-[1px] flex-1 bg-white/5"></div><span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">OR</span><div className="h-[1px] flex-1 bg-white/5"></div></div>
              <button onClick={handleDirectAccess} className="w-full bg-transparent border border-indigo-500/30 hover:bg-indigo-500/5 text-indigo-400 font-bold py-4 rounded-xl shadow-lg transition-all mb-4 uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 active:scale-95">
                <Icons.Check className="w-4 h-4" /> Guest Access (Demo)
              </button>
              {loginError && <p className="mt-4 text-[10px] font-black text-rose-500 uppercase tracking-widest">Sync Failed. Check your connection.</p>}
            </div>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4 text-left w-full">
              <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required placeholder="Admin Email" className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 outline-none text-xs" />
              <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required placeholder="Admin Password" className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 outline-none text-xs" />
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all text-xs uppercase tracking-widest active:scale-95">ADMIN LOGIN</button>
            </form>
          )}
        </Card>
      </div>
    );
  }

  if (view === 'onboarding') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-5 relative py-12">
        {isSyncing && <LoadingOverlay message="Creating Profile..." />}
        <Card className="max-w-md w-full p-8 lg:p-10 border-indigo-500/20">
          <Logo className="mb-6 justify-center" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-8">Worker Registration</h2>
          <form onSubmit={handleOnboardingSubmit} className="space-y-5">
            <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Full Name</label><input required type="text" value={onboardingData.name} onChange={e => setOnboardingData({...onboardingData, name: e.target.value})} className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 text-sm font-bold" /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Phone</label><input required type="tel" pattern="[0-9]{10}" value={onboardingData.phone} onChange={e => setOnboardingData({...onboardingData, phone: e.target.value})} className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 text-sm font-bold" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Age</label><input required type="number" min="18" value={onboardingData.age} onChange={e => setOnboardingData({...onboardingData, age: e.target.value})} className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 text-sm font-bold" /></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Works Done</label><input required type="number" min="0" value={onboardingData.experience} onChange={e => setOnboardingData({...onboardingData, experience: e.target.value})} className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 text-sm font-bold" /></div>
            </div>
            <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Current Place</label><input required type="text" value={onboardingData.place} onChange={e => setOnboardingData({...onboardingData, place: e.target.value})} className="w-full bg-[#080C17] border border-slate-800 text-white rounded-xl px-4 py-3 text-sm font-bold" /></div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest active:scale-95">COMPLETE REGISTRATION</button>
            <button type="button" onClick={handleLogout} className="w-full text-slate-600 text-[10px] font-bold uppercase tracking-widest hover:text-slate-400">Cancel & Exit</button>
          </form>
        </Card>
      </div>
    );
  }

  // Dashboard Main Layout (same as previous working version but cleaner)
  return (
    <div className="h-screen w-screen flex flex-col lg:flex-row bg-[#020617] text-slate-100 font-inter overflow-hidden">
      {isSyncing && <LoadingOverlay message="Synchronizing..." />}
      <aside className="hidden lg:flex w-[260px] bg-[#050914] border-r border-white/5 flex-col shrink-0 p-8">
        <Logo className="mb-12" />
        <nav className="flex-1 flex flex-col gap-2">
           {isAdmin ? (
             <>
               <NavItem icon={<Icons.Dashboard />} label="Admin Hub" active={view === 'admin_dashboard'} onClick={() => setView('admin_dashboard')} />
               <NavItem icon={<Icons.Briefcase />} label="Event Management" active={view === 'admin_jobs'} onClick={() => setView('admin_jobs')} />
               <NavItem icon={<Icons.Users />} label="Staff Registry" active={view === 'admin_workers'} onClick={() => setView('admin_workers')} />
             </>
           ) : (
             <>
               <NavItem icon={<Icons.Dashboard />} label="My Overview" active={view === 'home'} onClick={() => setView('home')} />
               <NavItem icon={<Icons.Briefcase />} label="Active Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
               <NavItem icon={<Icons.Check />} label="My History" active={view === 'history'} onClick={() => setView('history')} />
               <NavItem icon={<Icons.Wallet />} label="Earnings" active={view === 'wallet'} onClick={() => setView('wallet')} />
             </>
           )}
           <div className="mt-auto"><NavItem icon={<Icons.Logout />} label="Logout" active={false} onClick={() => setShowLogoutConfirm(true)} /></div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <header className="h-[70px] lg:h-[90px] flex items-center justify-between px-6 lg:px-10 border-b border-white/5 bg-[#020617]/95 backdrop-blur-md shrink-0">
          <h1 className="text-xl font-black text-white uppercase tracking-tight">{view.replace('admin_', '').replace('_', ' ')}</h1>
          <div className="flex items-center gap-4"><div className="text-right hidden sm:block"><p className="text-xs font-black text-white uppercase leading-none">{user?.name}</p><p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{user?.role}</p></div><Avatar name={user?.name || 'U'} /></div>
        </header>

        <div className="p-6 lg:p-10 overflow-y-auto flex-1 scrollbar-hide max-w-4xl mx-auto w-full pb-24 lg:pb-10">
           {!isAdmin && view === 'home' && (
             <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatCard label="WALLET BALANCE" value={`${user?.balance?.toFixed(0) || '0'} Rs`} icon={<Icons.Wallet />} color="text-emerald-400" onClick={() => setView('wallet')} />
                  <StatCard label="JOB OPPORTUNITIES" value={openJobs.length.toString()} icon={<Icons.Briefcase />} color="text-indigo-400" onClick={() => setView('jobs')} />
                </div>
                <Card className="p-8 flex flex-col items-center border-dashed border-white/10">
                  <h3 className="text-sm font-black text-white uppercase mb-8 tracking-widest">UPI QR VERIFICATION</h3>
                  <div className="w-full max-w-[280px] border border-slate-800 rounded-[35px] p-8 flex flex-col items-center gap-6 bg-[#080C17]">
                    <div className="w-24 h-24 rounded-[28px] bg-slate-900 border border-white/5 flex items-center justify-center overflow-hidden shadow-inner">
                      {user?.qrCode ? <img src={user.qrCode} className="w-full h-full object-cover" /> : <Icons.Wallet className="w-9 h-9 text-slate-700" />}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleQrFileSelected} />
                    <button disabled={isProcessingQR} onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow-xl active:scale-95">{isProcessingQR ? "AI SCANNING..." : "UPLOAD PAYMENT QR"}</button>
                  </div>
                </Card>
             </div>
           )}

           {!isAdmin && view === 'jobs' && (
             <div className="space-y-6">
                {openJobs.length > 0 ? openJobs.map(job => {
                  const isEnrolled = enrollments.some(e => e.userId === user?.id && e.jobId === job.id);
                  return (
                    <Card key={job.id} className="p-6 overflow-hidden">
                      <div className="flex justify-between items-start mb-6">
                        <div><h3 className="text-xl font-black text-white uppercase mb-1 tracking-tight">{job.title}</h3><p className="text-indigo-400 text-xs font-bold uppercase tracking-widest">{job.location}</p></div>
                        <button onClick={() => openMap(job.location)} className="px-3 py-1 bg-slate-800 text-white text-[9px] font-black uppercase rounded-[4px] hover:bg-slate-700 transition-colors">VIEW MAP</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-8 bg-[#080C17] p-4 rounded-2xl border border-white/5 text-center">
                        <div><p className="text-[8px] font-bold text-slate-600 mb-1 uppercase">DATE</p><p className="text-xs font-black">{job.date}</p></div>
                        <div><p className="text-[8px] font-bold text-slate-600 mb-1 uppercase">WAGE</p><p className="text-xs font-black text-emerald-500">{job.pay} Rs</p></div>
                        <div><p className="text-[8px] font-bold text-slate-600 mb-1 uppercase">VACANCY</p><p className="text-xs font-black">{job.enrolledCount}/{job.maxWorkers}</p></div>
                      </div>
                      <button onClick={() => handleEnrollAttempt(job)} className={`w-full py-4 rounded-xl font-black uppercase text-xs shadow-lg transition-all active:scale-95 ${isEnrolled ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'}`}>
                        {isEnrolled ? 'CANCEL REGISTRATION' : 'JOIN THIS EVENT'}
                      </button>
                    </Card>
                  );
                }) : <div className="py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">No events currently hiring</div>}
             </div>
           )}
        </div>

        <nav className="lg:hidden h-[60px] bg-[#0b101c] border-t border-white/5 flex items-stretch fixed bottom-0 left-0 right-0 z-[100]">
           {isAdmin ? (
             <>
               <NavItem isMobile icon={<Icons.Dashboard />} label="Admin" active={view === 'admin_dashboard'} onClick={() => setView('admin_dashboard')} />
               <NavItem isMobile icon={<Icons.Briefcase />} label="Events" active={view === 'admin_jobs'} onClick={() => setView('admin_jobs')} />
               <NavItem isMobile icon={<Icons.Users />} label="Staff" active={view === 'admin_workers'} onClick={() => setView('admin_workers')} />
             </>
           ) : (
             <>
               <NavItem isMobile icon={<Icons.Dashboard />} label="Home" active={view === 'home'} onClick={() => setView('home')} />
               <NavItem isMobile icon={<Icons.Briefcase />} label="Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
               <NavItem isMobile icon={<Icons.Check />} label="History" active={view === 'history'} onClick={() => setView('history')} />
               <NavItem isMobile icon={<Icons.Wallet />} label="Pay" active={view === 'wallet'} onClick={() => setView('wallet')} />
             </>
           )}
        </nav>
      </main>

      {showEnrollConfirm && (
        <Modal centered title="Enrollment Verification" onClose={() => setShowEnrollConfirm(false)}>
           <div className="text-center">
              <p className="text-xs text-slate-400 mb-8 px-4 leading-relaxed font-medium uppercase tracking-tight">Are you sure you want to register for <span className="text-white font-black">{selectedJobForEnroll?.title}</span>? Attendance is mandatory once enrolled.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowEnrollConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">CANCEL</button>
                <button onClick={() => handleEnrollConfirm()} className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95">CONFIRM</button>
              </div>
           </div>
        </Modal>
      )}

      {showLogoutConfirm && (
        <Modal centered title="End Session" onClose={() => setShowLogoutConfirm(false)}>
           <div className="text-center"><p className="text-xs text-slate-400 mb-8 font-medium uppercase tracking-widest">Securely logout from your account?</p><div className="flex gap-3"><button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">CANCEL</button><button onClick={handleLogout} className="flex-1 py-3 bg-rose-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95">LOGOUT</button></div></div>
        </Modal>
      )}
    </div>
  );
}
