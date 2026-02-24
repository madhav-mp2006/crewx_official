
import React, { useState, useEffect, useRef } from 'react';
import { User, Job, Enrollment, UserRole, JobStatus, WithdrawalStatus, WithdrawalRequest, AppView } from './types';
import { db } from './db';
import { Icons, APP_NAME } from './constants';
import { supabase } from './supabase';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

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
    <span className="text-2xl lg:text-4xl font-black tracking-tighter text-indigo-500 uppercase italic">
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
  <Card onClick={onClick} className="flex items-center gap-4 lg:gap-6 p-4 lg:p-5 w-full relative group">
    <div className={`w-12 h-12 lg:w-14 lg:h-14 shrink-0 flex items-center justify-center rounded-[16px] bg-slate-900/40 border border-white/5 ${color}`}>
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5 lg:w-6 lg:h-6' }) : icon}
    </div>
    <div className="flex flex-col min-w-0 flex-1">
      <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">{label}</p>
      <div className="flex items-baseline justify-between">
        <p className="text-xl lg:text-2xl font-black text-white tracking-tight truncate">{value}</p>
        {onClick && <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">VIEW</span>}
      </div>
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
  const [view, setView] = useState<AppView>('auth');
  const [loginRole, setLoginRole] = useState<UserRole>(UserRole.WORKER);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("Syncing Profile...");
  
  // Standard View Logic
  const isAdmin = user?.role === UserRole.ADMIN;

  // Confirmations & States
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [showEnrollConfirm, setShowEnrollConfirm] = useState(false);
  const [selectedJobForEnroll, setSelectedJobForEnroll] = useState<Job | null>(null);

  // Admin Specific Modals
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [viewingStaffForJob, setViewingStaffForJob] = useState<Job | null>(null);
  const [adminExpandedStaffJobId, setAdminExpandedStaffJobId] = useState<string | null>(null);
  const [jobStaff, setJobStaff] = useState<User[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [newJob, setNewJob] = useState<Partial<Job>>({
    title: '',
    date: '',
    time: '',
    location: '',
    pay: 0,
    maxWorkers: 0,
    status: JobStatus.OPEN
  });
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
  const [validatingPayout, setValidatingPayout] = useState<WithdrawalRequest | null>(null);
  const [payoutHistFilter, setPayoutHistFilter] = useState<'ALL' | WithdrawalStatus>('ALL');

  // Admin Auth Inputs
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const fetchData = async () => {
    console.log("Fetching data...");
    try {
      const [j, e, w, u] = await Promise.all([
        db.getJobs(),
        db.getEnrollments(),
        db.getWithdrawals(),
        db.getUsers()
      ]);
      console.log("Data fetched successfully");
      
      // Reconcile enrolledCount with actual enrollment records
      const reconciledJobs = (j || []).map(job => ({
        ...job,
        enrolledCount: (e || []).filter(enroll => enroll.jobId === job.id).length
      }));

      setJobs(reconciledJobs);
      setEnrollments(e || []);
      setWithdrawals(w || []);
      setWorkers(u || []);
    } catch (err) {
      console.error("Data Fetch Error:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      console.log("Initializing session...");
      // Safety timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        if (mounted && (isLoading || isSyncing)) {
          console.warn("Session initialization timed out, forcing loading to false");
          setIsLoading(false);
          setIsSyncing(false);
        }
      }, 6000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Session fetched:", session ? "User active" : "No user");
        
        if (!mounted) return;
        clearTimeout(timeout);

        if (session?.user) {
          await syncUserProfile(session.user);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Session Init Error:", err);
        if (mounted) {
          clearTimeout(timeout);
          setIsLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session ? "User active" : "No user");
      if (!mounted) return;

      if (session?.user) {
        await syncUserProfile(session.user);
      } else {
        // If not signed in, ensure loading is false
        setIsLoading(false);
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setView('auth');
        }
      }
    });

    initSession();

    // Realtime subscription for jobs
    const jobsChannel = supabase
      .channel('public:jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      supabase.removeChannel(jobsChannel);
    };
  }, []);

  const syncUserProfile = async (supabaseUserOrEmail: any) => {
    if (isSyncing) return; // Prevent concurrent syncs
    
    console.log("Syncing user profile...");
    setIsSyncing(true);
    try {
      const isEmail = typeof supabaseUserOrEmail === 'string';
      const email = isEmail ? supabaseUserOrEmail : supabaseUserOrEmail.email;
      console.log("Syncing for email:", email);
      
      let profile = null;
      try {
        profile = await db.getUserByEmail(email!);
        console.log("Profile fetched:", profile ? "Found" : "Not found");
      } catch (dbErr) {
        console.error("DB Fetch Error in Sync:", dbErr);
        // Continue to create profile if fetch fails but we have an email
      }
      
      if (!profile) {
        console.log("Creating new profile for:", email);
        profile = {
          id: isEmail ? (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)) : supabaseUserOrEmail.id,
          name: isEmail ? 'Madhav P' : (supabaseUserOrEmail.user_metadata?.full_name || 'Worker'),
          email: email!,
          role: UserRole.WORKER,
          balance: 0,
        };
        await db.saveUser(profile);
      }

      const verifiedProfile = await db.getUserByEmail(email!);
      if (verifiedProfile) {
        console.log("Profile verified, setting user and view");
        setUser(verifiedProfile);
        // Don't await fetchData here to speed up initial UI render
        fetchData().catch(err => console.error("Initial fetchData error:", err));
        setView(verifiedProfile.role === UserRole.ADMIN ? 'admin_dashboard' : 'home');
      } else {
        console.warn("Profile sync completed but verifiedProfile is null");
      }
    } catch (err) {
      console.error("Profile Sync Error:", err);
      setLoginError(true);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
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
    if (!job) {
      setShowEnrollConfirm(false);
      return;
    }

    setIsSyncing(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        alert("Authentication required. Please sign in.");
        setView('auth');
        return;
      }

      // 1. Correct way to check enrollment (Server-side check to prevent duplicates)
      const alreadyEnrolled = await db.checkEnrollment(authUser.id, job.id);
      
      setSyncMessage(alreadyEnrolled ? "Cancelling Enrollment..." : "Enrolling...");
      
      if (alreadyEnrolled) {
        // Handle Cancellation
        await db.deleteEnrollmentByUserAndJob(authUser.id, job.id);
        await db.updateJob(job.id, { enrolledCount: Math.max(0, job.enrolledCount - 1) });
        setSyncMessage("Enrollment Cancelled!");
      } else {
        // Handle New Enrollment
        // Double check capacity
        if (job.enrolledCount >= job.maxWorkers) {
           alert("This job is already full.");
           return;
        }

        await db.saveEnrollment({
          userId: authUser.id,
          jobId: job.id,
          enrolledAt: new Date().toISOString()
        });
        await db.updateJob(job.id, { enrolledCount: job.enrolledCount + 1 });
        setSyncMessage("Successfully Enrolled!");
      }
      
      // 2. Correct UI state update: Re-fetch all data to sync global state
      await fetchData();
      
      // Brief delay to show the success message
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (err: any) {
      console.error("Enrollment failed:", err);
      // 3. Proper Error Handling
      if (err.code === '23505') {
        alert("You are already enrolled in this job.");
      } else {
        alert("Action failed: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsSyncing(false);
      setShowEnrollConfirm(false);
      setSelectedJobForEnroll(null);
      setSyncMessage("Syncing Profile...");
    }
  };

  const handleEnrollAttempt = (job: Job) => {
    if (!user) {
       alert("Please sign in to enroll in events.");
       setView('auth');
       return;
    }

    // Check if worker has uploaded QR code
    if (!user.qrCode) {
      setIsSyncing(true);
      setSyncMessage("Please upload your QR code before enrolling.");
      setTimeout(() => {
        setIsSyncing(false);
        setView('home');
      }, 2500);
      return;
    }

    const isEnrolled = enrollments.some(e => e.userId === user.id && e.jobId === job.id);
    if (!isEnrolled && job.enrolledCount >= job.maxWorkers) {
      alert("This event is full.");
      return;
    }
    setSelectedJobForEnroll(job);
    setShowEnrollConfirm(true);
  };

  // --- Other Methods ---

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
        const img = new Image();
        img.onload = async () => {
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension 512px for faster processing
          const MAX_DIM = 512;
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Get compressed base64
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          const base64String = compressedDataUrl.split(',')[1];
          
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [
                { inlineData: { data: base64String, mimeType: 'image/jpeg' } },
                { text: "Is this a UPI/Payment QR code? Answer 'YES' or 'NO' only." }
              ]
            },
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
            }
          });
          const result = response.text?.trim().toUpperCase();
          if (result === 'YES') {
            // We still save the original dataUrl for better quality display, or use the compressed one?
            // Let's use the original for display but the compressed for AI.
            const originalDataUrl = reader.result as string;
            await db.updateUser(user.id, { qrCode: originalDataUrl });
            setUser({ ...user, qrCode: originalDataUrl });
            setQrWarningMessage(null);
            await fetchData();
          } else {
            setQrWarningMessage("Warning: Invalid Image. Please upload a clear image of your payment QR code only.");
          }
          setIsProcessingQR(false);
          setQrFileToProcess(null);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(qrFileToProcess);
    } catch (err) {
      console.error(err);
      setQrWarningMessage("Error processing image. Please try again.");
      setIsProcessingQR(false);
      setQrFileToProcess(null);
    }
  };

  const handleDeleteJob = async (job: Job) => {
    setActionConfirm({
      title: "Delete Work?",
      message: `Are you sure you want to delete '${job.title}'? All data related to this work will be permanently removed from the database.`,
      onConfirm: async () => {
        await db.deleteJob(job.id);
        await fetchData();
        setActionConfirm(null);
      }
    });
  };

  const handleToggleJobStatus = async (job: Job) => {
    const isCurrentlyOpen = job.status === JobStatus.OPEN;
    const nextStatus = isCurrentlyOpen ? JobStatus.CLOSED : JobStatus.OPEN;
    
    setActionConfirm({
      title: isCurrentlyOpen ? "Close Job?" : "Re-open Job?",
      message: `Confirm switching '${job.title}' to ${nextStatus.toLowerCase()} status?`,
      onConfirm: async () => {
        await db.updateJob(job.id, { status: nextStatus });
        await fetchData();
        setActionConfirm(null);
      }
    });
  };

  const handleFinishJob = async (job: Job) => {
    setActionConfirm({
      title: "Finish Job?",
      message: `Mark '${job.title}' as completed? Completed jobs will stay in the list but move to the bottom.`,
      onConfirm: async () => {
        await db.updateJob(job.id, { status: JobStatus.COMPLETED });
        await fetchData();
        setActionConfirm(null);
      }
    });
  };

  const handleExpandStaff = async (jobId: string) => {
    if (adminExpandedStaffJobId === jobId) {
      setAdminExpandedStaffJobId(null);
      setJobStaff([]);
      return;
    }
    
    setAdminExpandedStaffJobId(jobId);
    setIsLoadingStaff(true);
    try {
      const staff = await db.getStaffByJob(jobId);
      setJobStaff(staff);
    } catch (err) {
      console.error("Failed to fetch staff:", err);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.title || !newJob.date || !newJob.time || !newJob.location || !newJob.pay || !newJob.maxWorkers) {
      alert("Please fill all fields");
      return;
    }

    setIsSyncing(true);
    try {
      const jobToSave: Job = {
        id: crypto.randomUUID(),
        title: newJob.title!,
        date: newJob.date!,
        time: newJob.time!,
        location: newJob.location!,
        pay: Number(newJob.pay),
        maxWorkers: Number(newJob.maxWorkers),
        enrolledCount: 0,
        status: JobStatus.OPEN
      };

      await db.saveJob(jobToSave);
      await fetchData();
      setShowCreateJobModal(false);
      setNewJob({
        title: '',
        date: '',
        time: '',
        location: '',
        pay: 0,
        maxWorkers: 0,
        status: JobStatus.OPEN
      });
    } catch (err) {
      console.error("Error creating job:", err);
      alert("Failed to create job. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateJobDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    setActionConfirm({
      title: "Confirm Edit",
      message: "Are you sure you want to update the details of this work?",
      onConfirm: async () => {
        await db.updateJob(editingJob.id, editingJob);
        await fetchData();
        setEditingJob(null);
        setActionConfirm(null);
      }
    });
  };

  const handleAddWorkerPay = async (worker: User, amount: number, jobId: string) => {
    setActionConfirm({
      title: "Add Payment?",
      message: `Are you sure you want to add ${amount} Rs to ${worker.name}'s account balance?`,
      onConfirm: async () => {
        const newBalance = (worker.balance || 0) + amount;
        await db.updateUser(worker.id, { balance: newBalance });
        await db.markEnrollmentAsPaid(worker.id, jobId);
        await fetchData();
        // Refresh local worker list if modal is open
        const updatedWorkers = await db.getUsers();
        setWorkers(updatedWorkers);
        setActionConfirm(null);
      }
    });
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

  const handleApproveWithdrawal = async (w: WithdrawalRequest) => {
    try {
      await db.updateWithdrawal(w.id, WithdrawalStatus.APPROVED);
      await fetchData();
    } catch (err) { console.error(err); }
  };

  const handleRejectWithdrawal = async (w: WithdrawalRequest) => {
    try {
      await db.updateWithdrawal(w.id, WithdrawalStatus.REJECTED);
      const worker = workers.find(wr => wr.id === w.userId);
      if (worker) {
        await db.updateUser(worker.id, { balance: worker.balance + w.amount });
      }
      await fetchData();
    } catch (err) { console.error(err); }
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
  
  const finalPayoutsLog = (isAdmin ? withdrawals : userWithdrawals)
    .filter(w => payoutHistFilter === 'ALL' ? true : w.status === payoutHistFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const recentWithdrawal = userWithdrawals[0];
  const pendingWithdrawals = withdrawals.filter(w => w.status === WithdrawalStatus.PENDING);
  const activeWorkers = workers
    .filter(w => w.role === UserRole.WORKER)
    .filter(w => w.name.toLowerCase().includes(staffSearch.toLowerCase()) || (w.email || "").toLowerCase().includes(staffSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const adminJobsDisplay = [...jobs].sort((a, b) => {
    if (a.status === JobStatus.COMPLETED && b.status !== JobStatus.COMPLETED) return 1;
    if (a.status !== JobStatus.COMPLETED && b.status === JobStatus.COMPLETED) return -1;
    return 0;
  });

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-5 overflow-hidden relative">
        {isSyncing && <LoadingOverlay message={syncMessage} />}
        <Card className="max-w-md w-full p-6 lg:p-10 text-center border-slate-800 relative z-10">
          <Logo className="mb-8 justify-center" />
          <div className="flex bg-[#080C17] p-1 rounded-xl mb-8 border border-slate-800">
            <button onClick={() => setLoginRole(UserRole.WORKER)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${loginRole === UserRole.WORKER ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Worker</button>
            <button onClick={() => setLoginRole(UserRole.ADMIN)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${loginRole === UserRole.ADMIN ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Admin</button>
          </div>
          {loginRole === UserRole.WORKER ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col items-center w-full">
              <h2 className="text-xl font-bold text-white mb-2">Worker Portal</h2>
              <p className="text-slate-400 text-[10px] lg:text-sm mb-8 uppercase tracking-widest font-medium text-center">Identity Verification Required</p>
              
              <button onClick={handleGoogleLogin} className="w-full bg-white hover:bg-slate-100 text-slate-950 font-black py-4 rounded-xl shadow-lg transition-all mb-4 uppercase tracking-widest text-xs active:scale-95 flex items-center justify-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="w-full flex items-center gap-4 my-6">
                <div className="h-[1px] flex-1 bg-white/5"></div>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">OR</span>
                <div className="h-[1px] flex-1 bg-white/5"></div>
              </div>

              <button 
                onClick={handleDirectAccess} 
                className="w-full bg-transparent border border-indigo-500/30 hover:bg-indigo-500/5 text-indigo-400 font-bold py-4 rounded-xl shadow-lg transition-all mb-4 uppercase tracking-[0.2em] text-[10px] active:scale-95 flex items-center justify-center gap-3 group"
              >
                <Icons.Check className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Direct Dashboard Access
              </button>
              
              <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest mt-2">Reserved for: mp.madhav.2006@gmail.com</p>
              
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
      {isSyncing && <LoadingOverlay message={syncMessage} />}
      <aside className="hidden lg:flex w-[260px] bg-[#050914] border-r border-white/5 flex-col shrink-0">
        <div className="p-8 mb-4"><Logo /></div>
        <nav className="flex-1 px-4 flex flex-col gap-1">
          {isAdmin ? (
            <>
              <NavItem icon={<Icons.Dashboard />} label="Home" active={view === 'admin_dashboard'} onClick={() => setView('admin_dashboard')} />
              <NavItem icon={<Icons.Briefcase />} label="Jobs" active={view === 'admin_jobs'} onClick={() => setView('admin_jobs')} />
              <NavItem icon={<Icons.Users />} label="Staff" active={view === 'admin_workers'} onClick={() => setView('admin_workers')} />
              <NavItem icon={<Icons.Check />} label="History" active={view === 'history'} onClick={() => setView('history')} />
              <NavItem icon={<Icons.Plus />} label="Payouts" active={view === 'admin_payouts'} onClick={() => setView('admin_payouts')} />
              <NavItem icon={<Icons.Wallet />} label="Payout Hist." active={view === 'payout_hist'} onClick={() => setView('payout_hist')} />
            </>
          ) : (
            <>
              <NavItem icon={<Icons.Dashboard />} label="Home" active={view === 'home'} onClick={() => setView('home')} />
              <NavItem icon={<Icons.Briefcase />} label="Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
              <NavItem icon={<Icons.Check />} label="Your Enrollments" active={view === 'history'} onClick={() => setView('history')} />
              <NavItem icon={<Icons.Plus />} label="Wallet" active={view === 'wallet'} onClick={() => setView('wallet')} />
              <NavItem icon={<Icons.Wallet />} label="Payout Hist." active={view === 'payout_hist'} onClick={() => setView('payout_hist')} />
              <NavItem icon={<Icons.Users />} label="Contact Us" active={view === 'contact'} onClick={() => setView('contact')} />
            </>
          )}
          <div className="mt-4"><NavItem icon={<Icons.Logout />} label="Exit" active={false} onClick={() => setShowLogoutConfirm(true)} /></div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <header className="h-[70px] lg:h-[90px] flex items-center justify-between px-6 lg:px-10 shrink-0 border-b border-white/5 bg-[#020617]/95 backdrop-blur-md z-[50]">
          <div className="flex flex-col">
            <Logo className="scale-75 origin-left -mb-1 opacity-80" />
            <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight uppercase">
              {view === 'payout_hist' || view === 'admin_jobs' || view === 'admin_workers' || view === 'history' || view === 'admin_payouts' || view === 'jobs' ? null : 
               isAdmin ? 'ADMIN CONTROL PANEL' : 
               view === 'home' ? 'Dashboard Overview' : 
               view === 'contact' ? 'Contact Us' : 
               view === 'wallet' ? 'Wallet' : 
               (view as string).toUpperCase()}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            {view === 'admin_jobs' && (
              <button 
                onClick={() => setShowCreateJobModal(true)}
                className="px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95"
              >
                 <Icons.Plus className="w-4 h-4" /> NEW JOB
              </button>
            )}
            {!isAdmin && (
              <button className="text-slate-400 hover:text-white transition-colors relative">
                <Icons.Bell className="w-6 h-6" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full border border-[#020617]"></span>
              </button>
            )}
            <Avatar name={user?.name || 'E'} />
          </div>
        </header>

        <div className="p-6 lg:p-10 overflow-y-auto flex-1 scrollbar-hide max-w-4xl mx-auto w-full pb-24 lg:pb-10">
          {/* Admin Specific Views */}
          {isAdmin && view === 'admin_dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <StatCard label="OPEN JOBS" value={openJobs.length.toString()} icon={<Icons.Briefcase />} color="text-indigo-400" onClick={() => setView('admin_jobs')} />
                <StatCard label="TOTAL WORKERS" value={activeWorkers.length.toString()} icon={<Icons.Users />} color="text-emerald-400" onClick={() => setView('admin_workers')} />
                <StatCard label="PENDING PAYOUTS" value={pendingWithdrawals.length.toString()} icon={<Icons.Wallet />} color="text-amber-400" onClick={() => setView('admin_payouts')} />
              </div>
              <Card className="p-8">
                <h3 className="text-base font-black text-white uppercase mb-6 flex items-center gap-2"><Icons.Wallet className="w-5 h-5 text-amber-500" /> Recent Payout Requests</h3>
                <div className="space-y-4">
                  {pendingWithdrawals.length > 0 ? pendingWithdrawals.map(w => {
                    const worker = workers.find(wr => wr.id === w.userId);
                    return (
                      <div key={w.id} className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         <div className="flex items-center gap-4">
                            <Avatar name={worker?.name || 'W'} size="w-8 h-8" />
                            <div className="text-left">
                               <p className="text-xs font-black text-white">{worker?.name || 'Unknown Worker'}</p>
                               <p className="text-[9px] text-slate-500 uppercase tracking-widest">{new Date(w.createdAt).toLocaleDateString()}</p>
                            </div>
                         </div>
                         <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                            <p className="text-sm font-black text-indigo-400">{w.amount} Rs</p>
                            <div className="flex gap-2">
                               <button onClick={() => handleApproveWithdrawal(w)} className="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-lg transition-all"><Icons.Check className="w-4 h-4" /></button>
                               <button onClick={() => handleRejectWithdrawal(w)} className="p-2 bg-rose-600/20 hover:bg-rose-600 text-rose-500 hover:text-white rounded-lg transition-all"><Icons.XMark className="w-4 h-4" /></button>
                            </div>
                         </div>
                      </div>
                    );
                  }) : <div className="py-10 text-center opacity-30 italic text-xs uppercase font-black tracking-widest">No pending payout requests</div>}
                </div>
              </Card>
            </div>
          )}

          {isAdmin && view === 'admin_jobs' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <h2 className="text-2xl font-black text-white uppercase tracking-tight">Event Opportunities</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                 {adminJobsDisplay.map(job => (
                   <Card key={job.id} className="p-0 overflow-hidden border-slate-800">
                      <div className="p-6 space-y-5">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <h3 className="text-xl font-black text-white mb-1 tracking-tight uppercase truncate">{job.title}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-[#6366f1] text-[11px] font-bold uppercase">{job.location}</span>
                              <button onClick={() => openMap(job.location)} className="px-1.5 py-0.5 bg-[#1e293b] hover:bg-slate-700 text-slate-400 text-[9px] font-black uppercase rounded-[3px] transition-colors">MAP</button>
                            </div>
                          </div>
                          <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-full border shrink-0 ${
                            job.status === JobStatus.COMPLETED ? 'bg-slate-800 text-slate-400 border-slate-700' :
                            job.status === JobStatus.CLOSED ? 'bg-rose-900/20 text-rose-500 border-rose-900/40' :
                            'bg-emerald-900/20 text-emerald-500 border-emerald-900/40'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        
                        <div className="bg-[#080c17] rounded-[18px] p-5 space-y-4 border border-white/5">
                           <div className="flex items-center justify-between">
                             <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">DATE</span>
                             <span className="text-xs font-black text-white tracking-tight">{job.date}</span>
                           </div>
                           <div className="flex items-center justify-between">
                             <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">PAYMENT</span>
                             <span className="text-xs font-black text-[#22c55e] tracking-tight">{job.pay} Rs</span>
                           </div>
                           <div className="flex items-center justify-between">
                             <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">STAFF</span>
                             <span className="text-xs font-black text-white tracking-tight">{job.enrolledCount} / {job.maxWorkers}</span>
                           </div>
                        </div>

                        <button 
                          onClick={() => handleExpandStaff(job.id)}
                          className="w-full bg-[#1e1b4b]/30 rounded-[12px] px-4 py-2.5 flex items-center justify-between border border-indigo-500/10 hover:bg-indigo-500/20 transition-all active:scale-[0.98]"
                        >
                           <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{adminExpandedStaffJobId === job.id ? 'HIDE STAFF' : 'VIEW STAFF'}</span>
                           <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{job.enrolledCount} STAFFS</span>
                        </button>

                        {adminExpandedStaffJobId === job.id && (
                          <div className="bg-[#080c17] rounded-[18px] p-4 border border-white/5 space-y-3 animate-in slide-in-from-top-2 duration-300">
                             <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ENROLLED WORKERS</span>
                             </div>
                             {isLoadingStaff ? (
                               <div className="py-4 text-center animate-pulse">
                                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Fetching staff list...</p>
                               </div>
                             ) : jobStaff.length > 0 ? (
                               jobStaff.map(worker => {
                                 const enroll = enrollments.find(e => e.userId === worker.id && e.jobId === job.id);
                                 return (
                                   <div key={worker.id} className="flex flex-col p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
                                       <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-2">
                                            <Avatar name={worker.name} size="w-8 h-8" />
                                            <div className="min-w-0">
                                               <p className="text-[10px] font-black text-white uppercase truncate">{worker.name}</p>
                                               <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest truncate">{worker.email}</p>
                                            </div>
                                         </div>
                                         <button 
                                           onClick={() => !enroll?.isPaid && handleAddWorkerPay(worker, job.pay, job.id)}
                                           className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${enroll?.isPaid ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-default' : 'bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20'}`}
                                         >
                                           {enroll?.isPaid ? 'PAID' : 'ADD PAY'}
                                         </button>
                                       </div>
                                       <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                          <div className="flex flex-col">
                                             <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">PHONE</span>
                                             <span className="text-[9px] font-bold text-slate-300">{worker.phone || 'N/A'}</span>
                                          </div>
                                          <div className="flex flex-col text-right">
                                             <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">AGE / EXP</span>
                                             <span className="text-[9px] font-bold text-slate-300">{worker.age || '?'}/{worker.experience || '?'}Y</span>
                                          </div>
                                       </div>
                                   </div>
                                 );
                               })
                             ) : (
                               <div className="py-4 text-center">
                                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No workers enrolled yet</p>
                               </div>
                             )}
                          </div>
                        )}

                        <div className="flex gap-2.5">
                           <button onClick={() => setEditingJob(job)} className="flex-[2] py-2.5 bg-[#1e293b] hover:bg-[#2d3a4f] text-slate-300 text-[10px] font-black uppercase rounded-xl transition-all shadow-md active:scale-95 border border-white/5">
                             EDIT
                           </button>
                           <button 
                             onClick={() => handleToggleJobStatus(job)}
                             className="flex-[3] py-2.5 bg-[#1e293b] hover:bg-[#2d3a4f] text-slate-300 text-[10px] font-black uppercase rounded-xl transition-all shadow-md active:scale-95 border border-white/5"
                           >
                             {job.status === JobStatus.OPEN ? 'CLOSE' : 'REOPEN'}
                           </button>
                           {job.status !== JobStatus.COMPLETED && (
                             <button 
                               onClick={() => handleFinishJob(job)}
                               className="flex-[2] py-2.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-500 hover:text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-md active:scale-95 border border-emerald-500/20"
                             >
                               FINISH
                             </button>
                           )}
                           <button 
                             onClick={() => handleDeleteJob(job)}
                             className="w-11 h-11 bg-[#f43f5e] hover:bg-[#e11d48] text-white rounded-xl transition-all flex items-center justify-center shrink-0 shadow-lg active:scale-95"
                           >
                             <Icons.Trash className="w-5 h-5" />
                           </button>
                        </div>
                      </div>
                   </Card>
                 ))}
               </div>
            </div>
          )}

          {isAdmin && view === 'admin_workers' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">Staff Directory</h2>
                  <div className="relative w-full md:w-64">
                    <Icons.Dashboard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Search workers..." 
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="w-full bg-[#0b1222] border border-white/5 text-white text-[11px] font-bold rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-1 focus:ring-indigo-500/30"
                    />
                  </div>
               </div>

               <div className="flex items-center gap-4 py-2">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-1 rounded-md">A-Z SORTED</span>
                  <div className="h-[1px] flex-1 bg-white/5"></div>
               </div>

               <div className="bg-[#0b1222] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                 <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">WORKER NAME</span>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">ACTION</span>
                 </div>
                 <div className="divide-y divide-white/5">
                   {activeWorkers.map(worker => (
                     <div key={worker.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-4">
                           <Avatar name={worker.name} size="w-12 h-12" className="bg-indigo-500/20 text-indigo-400 text-lg" />
                           <div className="min-w-0">
                              <p className="font-bold text-white text-base tracking-tight">{worker.name}</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{worker.email}</p>
                           </div>
                        </div>
                        <button 
                          onClick={() => setViewingWorkerHistory(worker)}
                          className="w-full sm:w-auto px-5 py-2.5 bg-transparent hover:bg-white/5 text-slate-400 hover:text-white text-[10px] font-black uppercase rounded-xl border border-white/10 transition-all active:scale-95"
                        >
                           HISTORY
                        </button>
                     </div>
                   ))}
                 </div>
                 {activeWorkers.length === 0 && (
                   <div className="py-20 text-center opacity-30 italic text-xs uppercase font-black tracking-widest">No matching workers found</div>
                 )}
               </div>
            </div>
          )}

          {((view as string) === 'history') && (
             <div className="space-y-6 animate-in fade-in duration-500">
               <h2 className="text-2xl font-black text-white uppercase tracking-tight">{isAdmin ? 'Enrollment History' : 'My Enrollment History'}</h2>
               <div className="bg-[#0b1222] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="hidden md:grid px-6 py-4 grid-cols-3 border-b border-white/5 text-slate-500">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">WORKER</span>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">EVENT</span>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-right">DATE</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {(isAdmin ? enrollments : userEnrollments).slice().reverse().map(enroll => {
                      const worker = workers.find(w => w.id === enroll.userId);
                      const job = jobs.find(j => j.id === enroll.jobId);
                      return (
                        <div key={enroll.id} className="px-6 py-5 flex flex-col md:grid md:grid-cols-3 md:items-center gap-4 md:gap-0 group hover:bg-white/[0.02] transition-colors">
                           <div className="flex items-center gap-3">
                              <Avatar name={worker?.name || '?'} size="w-9 h-9" className="text-xs" />
                              <div className="min-w-0">
                                <span className="font-bold text-white text-sm truncate block uppercase tracking-tight">{worker?.name || 'Unknown'}</span>
                              </div>
                           </div>
                           <div className="min-w-0 flex flex-col">
                             <span className="text-sm font-medium text-slate-400 truncate block uppercase tracking-tight">{job?.title || 'Unknown Event'}</span>
                             <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-tighter">{job?.location || 'N/A'} • {job?.pay || 0} Rs</span>
                           </div>
                           <div className="flex items-center justify-between w-full md:w-auto md:justify-end">
                             <span className="md:hidden text-[9px] font-black text-slate-600 uppercase tracking-widest">DATE</span>
                             <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                {new Date(enroll.enrolledAt).toLocaleDateString('en-GB')}
                             </span>
                           </div>
                        </div>
                      );
                    })}
                  </div>
                  {(isAdmin ? enrollments : userEnrollments).length === 0 && (
                    <div className="py-20 text-center opacity-30 italic text-xs uppercase font-black tracking-widest">No enrollment records yet</div>
                  )}
               </div>
             </div>
          )}

          {isAdmin && view === 'admin_payouts' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <h2 className="text-2xl font-black text-white uppercase tracking-tight">Payout Requests</h2>
               <div className="space-y-4">
                  {pendingWithdrawals.map(w => {
                    const worker = workers.find(wr => wr.id === w.userId);
                    return (
                      <Card key={w.id} className="p-6">
                         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                               <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center shadow-inner">
                                  {worker?.qrCode ? (
                                    <img src={worker.qrCode} className="w-full h-full object-cover rounded-2xl" />
                                  ) : (
                                    <Icons.Users className="w-7 h-7 text-indigo-400" />
                                  )}
                               </div>
                               <div>
                                  <p className="font-black text-white uppercase text-base">{worker?.name}</p>
                                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">{worker?.email}</p>
                               </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8 w-full md:w-auto">
                               <div className="text-left sm:text-center md:text-right">
                                  <p className="text-2xl font-black text-emerald-400">{w.amount} Rs</p>
                                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">REQUESTED AMOUNT</p>
                               </div>
                               <div className="flex gap-3 w-full sm:w-auto">
                                  <button 
                                    onClick={() => setValidatingPayout(w)} 
                                    className="flex-1 sm:flex-none px-7 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                  >
                                    VALIDATE QR <Icons.Check className="w-3 h-3" />
                                  </button>
                               </div>
                            </div>
                         </div>
                      </Card>
                    );
                  })}
                  {pendingWithdrawals.length === 0 && (
                    <div className="text-center py-20 opacity-20 border-2 border-dashed border-slate-800 rounded-3xl uppercase font-black tracking-widest text-xs">
                      No active payout requests
                    </div>
                  )}
               </div>
            </div>
          )}

          {view === 'payout_hist' && (
            <div className="space-y-8 animate-in fade-in duration-500 w-full max-w-6xl mx-auto px-4 py-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <h2 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tight text-center lg:text-left">
                   ALL PAYOUT HISTORY
                </h2>
                
                <div className="bg-[#0f172a] border border-white/5 rounded-full p-1.5 flex items-center shadow-2xl overflow-x-auto scrollbar-hide mx-auto lg:mx-0">
                  {(['ALL', WithdrawalStatus.APPROVED, WithdrawalStatus.PENDING, WithdrawalStatus.REJECTED] as const).map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setPayoutHistFilter(tab)}
                      className={`px-4 lg:px-6 py-2 lg:py-2.5 text-[9px] lg:text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300 whitespace-nowrap ${
                        payoutHistFilter === tab 
                          ? 'bg-[#5850ec] text-white shadow-[0_0_20px_rgba(88,80,236,0.3)]' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0b1222]/50 backdrop-blur-xl border border-white/5 rounded-[24px] lg:rounded-[32px] overflow-hidden shadow-2xl">
                 <div className="hidden md:grid px-10 py-6 grid-cols-4 border-b border-white/5 text-slate-500">
                    <span className="text-[11px] font-black uppercase tracking-[0.25em]">WORKER</span>
                    <span className="text-[11px] font-black uppercase tracking-[0.25em] text-center">AMOUNT</span>
                    <span className="text-[11px] font-black uppercase tracking-[0.25em] text-center">STATUS</span>
                    <span className="text-[11px] font-black uppercase tracking-[0.25em] text-right">DATE</span>
                 </div>
                 
                 <div className="divide-y divide-white/5">
                    {finalPayoutsLog.length > 0 ? (
                       finalPayoutsLog.map(w => {
                          const worker = workers.find(wr => wr.id === w.userId);
                          return (
                            <div key={w.id} className="px-6 lg:px-10 py-5 lg:py-7 flex flex-col md:grid md:grid-cols-4 md:items-center gap-4 md:gap-0 group hover:bg-white/[0.02] transition-all duration-300">
                               <div className="flex items-center gap-4 min-w-0">
                                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs shrink-0">
                                     {worker?.name?.charAt(0) || '?'}
                                  </div>
                                  <span className="font-bold text-white text-base truncate tracking-tight">{worker?.name || 'Unknown'}</span>
                               </div>
                               <div className="flex items-center justify-between md:justify-center">
                                  <span className="md:hidden text-[9px] font-black text-slate-600 uppercase tracking-widest">AMOUNT</span>
                                  <span className="text-base lg:text-lg font-black text-white tracking-tight">{w.amount} Rs</span>
                               </div>
                               <div className="flex items-center justify-between md:justify-center">
                                  <span className="md:hidden text-[9px] font-black text-slate-600 uppercase tracking-widest">STATUS</span>
                                  <span className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-full border transition-all duration-300 ${
                                     w.status === WithdrawalStatus.APPROVED ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/10' :
                                     w.status === WithdrawalStatus.PENDING ? 'bg-amber-500/5 text-amber-500 border-amber-500/10' :
                                     'bg-rose-500/5 text-rose-500 border-rose-500/10'
                                  }`}>
                                     {w.status}
                                  </span>
                               </div>
                               <div className="flex items-center justify-between md:justify-end">
                                  <span className="md:hidden text-[9px] font-black text-slate-600 uppercase tracking-widest">DATE</span>
                                  <span className="text-xs lg:text-sm font-bold text-slate-500 tracking-tight">
                                     {new Date(w.createdAt).toLocaleDateString('en-GB')}
                                  </span>
                               </div>
                            </div>
                          );
                       })
                    ) : (
                      <div className="py-32 flex flex-col items-center justify-center gap-4 opacity-20">
                         <Icons.Briefcase className="w-12 h-12 text-slate-500" />
                         <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.4em] italic">NO RECORDS FOUND</p>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          )}

          {/* Worker Dashboard Views */}
          {!isAdmin && view === 'home' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex flex-col gap-4">
                <StatCard label="MY WALLET" value={`${user?.balance?.toFixed(0) || '0'} Rs`} icon={<Icons.Wallet />} color="text-emerald-400" onClick={() => setView('wallet')} />
                <StatCard label="ENROLLED" value={userEnrollments.length.toString()} icon={<Icons.Check />} color="text-indigo-400" onClick={() => setView('history')} />
                <StatCard label="AVAILABLE JOBS" value={openJobs.length.toString()} icon={<Icons.Briefcase />} color="text-indigo-400" onClick={() => setView('jobs')} />
              </div>
              <Card className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-indigo-500/10 bg-[#0b1222]">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/10 shrink-0"><Icons.Wallet className="w-5 h-5" /></div>
                  <div className="flex flex-col min-w-0"><p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">RECENT PAYOUT SUMMARY</p><p className="text-[10px] text-slate-500 font-medium italic truncate leading-tight">{recentWithdrawal ? `Request: ${recentWithdrawal.amount} Rs is ${recentWithdrawal.status}.` : "No completed payouts recorded yet."}</p></div>
                </div>
                <button onClick={() => setView('payout_hist')} className="w-full sm:w-auto px-4 py-2.5 bg-[#6366f1] hover:bg-[#5558e3] text-white text-[9px] font-black uppercase rounded-[10px] transition-all flex items-center justify-center gap-1.5 shadow-lg active:scale-95 shrink-0 h-fit">VIEW ALL <Icons.Check className="w-3 h-3" /></button>
              </Card>
              <Card className="p-8 flex flex-col items-center">
                  <h3 className="text-base font-black text-white uppercase mb-8">Payment Gateway</h3>
                  <div className="w-full max-w-[280px] border border-dashed border-slate-800 rounded-[35px] p-8 flex flex-col items-center justify-center gap-6 group">
                    <div className="w-20 h-20 rounded-[28px] bg-slate-900 border border-white/5 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl transition-transform hover:scale-105">{user?.qrCode ? (<img src={user.qrCode} alt="Linked QR" className="w-full h-full object-cover" />) : (<Icons.Wallet className="w-9 h-9 text-slate-700" />)}</div>
                    <div className="text-center"><p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">{user?.qrCode ? "UPI QR LINKED" : "No QR Linked"}</p>{user?.qrCode && <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest animate-pulse">VERIFIED</p>}</div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleQrFileSelected} />
                    <button disabled={isProcessingQR} onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black uppercase rounded-xl shadow-xl transition-all tracking-widest active:scale-95">{isProcessingQR ? "VALIDATING.." : user?.qrCode ? "UPDATE QR" : "LINK UPI QR"}</button>
                  </div>
              </Card>
            </div>
          )}

          {!isAdmin && view === 'wallet' && (
            <div className="space-y-10 animate-in fade-in duration-500 max-w-2xl mx-auto">
              <div className="relative rounded-[32px] p-10 bg-gradient-to-br from-[#4f46e5] to-[#1e1b4b] overflow-hidden shadow-2xl border border-white/10 flex flex-col items-center text-center">
                 <Icons.Wallet className="absolute -right-8 -bottom-8 w-64 h-64 text-white/5 rotate-12 pointer-events-none" />
                 <span className="text-xs font-black text-indigo-200/60 uppercase tracking-[0.2em] mb-4">AVAILABLE BALANCE</span>
                 <h2 className="text-[64px] font-black text-white leading-none tracking-tighter mb-12">{user?.balance?.toFixed(0) || '0'} Rs</h2>
                 <div className="w-full space-y-4 relative z-10"><div className="relative"><input type="number" value={withdrawalAmount} onChange={(e) => { setWithdrawalAmount(e.target.value); setBalanceWarning(null); }} placeholder="Enter Amount" className="w-full bg-[#1e1b4b]/60 border border-white/10 rounded-[20px] py-5 px-8 text-white text-lg font-bold placeholder:text-indigo-300/40 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-center" /></div><button onClick={handleWithdrawalAttempt} disabled={isSubmittingWithdrawal || !withdrawalAmount} className="w-full bg-[#059669] hover:bg-[#047857] disabled:bg-slate-700 text-white py-5 rounded-[20px] text-base font-black uppercase tracking-[0.1em] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">{isSubmittingWithdrawal ? "PROCESSING..." : "WITHDRAW"}</button></div>
              </div>
              <div ref={activityListRef} className="space-y-6 scroll-mt-20"><div className="flex items-center justify-between px-2"><h3 className="text-sm font-black text-white uppercase tracking-[0.15em]">RECENT ACTIVITY</h3><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{userWithdrawals.length} TOTAL</span></div><div className="min-h-[200px] border-2 border-dashed border-slate-800/50 rounded-[32px] flex flex-col items-center justify-start p-6 text-center relative overflow-hidden">{balanceWarning && (<div className="w-full mb-4 animate-in slide-in-from-top-4 duration-300"><div className="p-4 bg-rose-600/10 border border-rose-500/30 rounded-2xl flex items-center gap-4 text-left"><div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0"><Icons.XMark className="w-5 h-5 text-rose-500" /></div><div><p className="text-xs font-bold text-rose-500 uppercase tracking-widest">Warning</p><p className="text-[10px] text-rose-300 font-medium">Insufficient balance to process withdrawal request.</p></div></div></div>)}{userWithdrawals.length > 0 ? (<div className="w-full space-y-4">{userWithdrawals.map(w => (<div key={w.id} className="p-4 bg-[#0b1222] border border-white/5 rounded-2xl flex justify-between items-center animate-in fade-in duration-500"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${w.status === WithdrawalStatus.APPROVED ? 'bg-emerald-500/10 text-emerald-500' : w.status === WithdrawalStatus.REJECTED ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}><Icons.Wallet className="w-5 h-5" /></div><div className="text-left min-w-0"><div className="flex items-center gap-2"><p className="text-xs font-black text-white uppercase truncate">{w.status} Request</p>{w.status === WithdrawalStatus.PENDING && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>}</div><p className="text-[9px] text-slate-500 font-medium truncate">{new Date(w.createdAt).toLocaleDateString()} • {new Date(w.createdAt).toLocaleTimeString()}</p></div></div><div className="text-right ml-4 shrink-0"><p className="text-sm font-black text-white">-{w.amount} Rs</p><p className={`text-[8px] font-black uppercase tracking-tighter ${w.status === WithdrawalStatus.APPROVED ? 'text-emerald-500' : w.status === WithdrawalStatus.REJECTED ? 'text-rose-500' : 'text-amber-500'}`}>{w.status}</p></div></div>))}</div>) : !balanceWarning && (<div className="h-full flex-1 flex flex-col items-center justify-center gap-4 opacity-30 mt-10"><div className="w-14 h-14 bg-slate-900 border border-white/5 rounded-2xl flex items-center justify-center shadow-lg"><Icons.Briefcase className="w-7 h-7 text-slate-700" /></div><p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">NO PAYOUTS FOUND</p></div>)}</div></div>
            </div>
          )}

          {!isAdmin && view === 'jobs' && (
            <div className="space-y-6 animate-in fade-in duration-500"><h2 className="text-2xl font-black text-white tracking-tight uppercase">Event Opportunities</h2><div className="flex flex-col gap-6 pb-10">{openJobs.map(job => {
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
                            <span className="px-3 py-1 bg-[#052e16] text-[#22c55e] text-[10px] font-black uppercase rounded-full border border-[#14532d] shrink-0">{job.status}</span>
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
                          
                          {isEnrolled ? (
                            <div className="flex gap-3">
                              <button disabled className="flex-[2] py-4 bg-emerald-600 text-white text-base font-black uppercase rounded-[14px] shadow-xl cursor-default">ENROLL</button>
                              <button onClick={() => handleEnrollAttempt(job)} className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white text-base font-black uppercase rounded-[14px] shadow-xl transition-all active:scale-95">CANCEL</button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleEnrollAttempt(job)} 
                              disabled={job.enrolledCount >= job.maxWorkers} 
                              className={`w-full py-4 rounded-[14px] text-base font-black uppercase tracking-[0.05em] transition-all shadow-xl active:scale-95 ${job.enrolledCount >= job.maxWorkers ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-[#6366f1] hover:bg-[#5558e3] text-white'}`}
                            >
                              {job.enrolledCount >= job.maxWorkers ? 'FULLY BOOKED' : 'ENROLL'}
                            </button>
                          )}
                        </div>
                      </Card>
                    </div>
                  );
                })}</div></div>
          )}

          {!isAdmin && view === 'contact' && (
            <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl mx-auto pb-10"><Card className="p-8 lg:p-10 text-center flex flex-col items-center"><div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-8"><Icons.Users className="w-10 h-10 text-indigo-400" /></div><h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">DIRECT SUPPORT</h2><p className="text-sm text-slate-400 font-medium mb-10 leading-relaxed max-w-xs mx-auto">Having issues? Connect with our team directly for immediate assistance.</p><div className="w-full space-y-4"><button onClick={handleEmailSupport} className="w-full py-5 bg-[#1e293b] hover:bg-[#2d3a4f] text-white text-xs font-black uppercase rounded-2xl transition-all shadow-xl active:scale-95 tracking-widest">EMAIL SUPPORT</button><button onClick={handleWhatsAppSupport} className="w-full py-5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-black uppercase rounded-2xl transition-all shadow-xl active:scale-95 tracking-widest">WHATSAPP CHAT</button></div></Card><Card className="p-8 lg:p-10 text-center flex flex-col items-center"><div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-8"><Icons.Users className="w-10 h-10 text-indigo-400" /></div><h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">JOIN WORKER COMMUNITY</h2><p className="text-sm text-slate-400 font-medium mb-10 leading-relaxed max-w-xs mx-auto">Get real-time updates on new jobs, event changes, and interact with other crew members.</p><button onClick={handleJoinCommunity} className="w-full py-5 bg-[#6366f1] hover:bg-[#5558e3] text-white text-xs font-black uppercase rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 tracking-widest">JOIN OUR WHATSAPP COMMUNITY <Icons.Plus className="w-4 h-4" /></button></Card></div>
          )}
        </div>

        <nav className="lg:hidden h-[60px] bg-[#0b101c] border-t border-white/5 flex items-stretch justify-around fixed bottom-0 left-0 right-0 z-[100] shadow-[0_-8px_30px_rgb(0,0,0,0.5)] overflow-x-auto scrollbar-hide">
          {isAdmin ? (
            <>
              <NavItem isMobile icon={<Icons.Dashboard />} label="Dash" active={view === 'admin_dashboard'} onClick={() => setView('admin_dashboard')} />
              <NavItem isMobile icon={<Icons.Briefcase />} label="Jobs" active={view === 'admin_jobs'} onClick={() => setView('admin_jobs')} />
              <NavItem isMobile icon={<Icons.Users />} label="Staff" active={view === 'admin_workers'} onClick={() => setView('admin_workers')} />
              <NavItem isMobile icon={<Icons.Check />} label="Hist" active={view === 'history'} onClick={() => setView('history')} />
              <NavItem isMobile icon={<Icons.Plus />} label="Payouts" active={view === 'admin_payouts'} onClick={() => setView('admin_payouts')} />
              <NavItem isMobile icon={<Icons.Wallet />} label="Payout Hist." active={view === 'payout_hist'} onClick={() => setView('payout_hist')} />
            </>
          ) : (
            <>
              <NavItem isMobile icon={<Icons.Dashboard />} label="Home" active={view === 'home'} onClick={() => setView('home')} />
              <NavItem isMobile icon={<Icons.Briefcase />} label="Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
              <NavItem isMobile icon={<Icons.Check />} label="Enrollments" active={view === 'history'} onClick={() => setView('history')} />
              <NavItem isMobile icon={<Icons.Plus />} label="Wallet" active={view === 'wallet'} onClick={() => setView('wallet')} />
              <NavItem isMobile icon={<Icons.Wallet />} label="Payout Hist." active={view === 'payout_hist'} onClick={() => setView('payout_hist')} />
              <NavItem isMobile icon={<Icons.Users />} label="Contact" active={view === 'contact'} onClick={() => setView('contact')} />
            </>
          )}
          <NavItem isMobile icon={<Icons.Logout />} label="Exit" active={false} onClick={() => setShowLogoutConfirm(true)} />
        </nav>
      </main>

      {/* --- Admin Overlays --- */}

      {/* Action Confirmation Modal */}
      {actionConfirm && (
        <Modal centered title={actionConfirm.title} onClose={() => setActionConfirm(null)}>
           <div className="text-center">
              <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed px-4">{actionConfirm.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setActionConfirm(null)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">CANCEL</button>
                <button onClick={actionConfirm.onConfirm} className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95">YES, CONFIRM</button>
              </div>
           </div>
        </Modal>
      )}

      {/* Validate Payout QR Modal */}
      {validatingPayout && (
        <Modal centered title="Validate Payout QR" onClose={() => setValidatingPayout(null)}>
          <div className="p-6 flex flex-col items-center">
            <div className="w-full mb-6 p-4 bg-slate-900 border border-white/5 rounded-2xl flex items-center gap-4">
               <Avatar name={workers.find(w => w.id === validatingPayout.userId)?.name || '?'} size="w-12 h-12" />
               <div>
                  <p className="text-sm font-black text-white uppercase">{workers.find(w => w.id === validatingPayout.userId)?.name}</p>
                  <p className="text-xs font-bold text-emerald-400">{validatingPayout.amount} Rs Request</p>
               </div>
            </div>
            
            <div className="w-full aspect-square max-w-[300px] bg-slate-900 border border-dashed border-slate-800 rounded-[40px] p-8 flex flex-col items-center justify-center mb-8">
               <div className="w-full h-full rounded-[30px] bg-slate-950 border border-white/5 flex items-center justify-center overflow-hidden shadow-2xl">
                  {workers.find(w => w.id === validatingPayout.userId)?.qrCode ? (
                    <img 
                      src={workers.find(w => w.id === validatingPayout.userId)?.qrCode} 
                      alt="Worker QR" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-30">
                       <Icons.Wallet className="w-12 h-12 text-slate-700" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No QR Uploaded</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="flex gap-4 w-full">
               <button 
                 onClick={() => {
                   handleRejectWithdrawal(validatingPayout);
                   setValidatingPayout(null);
                 }}
                 className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
               >
                 REJECT
               </button>
               <button 
                 onClick={() => {
                   handleApproveWithdrawal(validatingPayout);
                   setValidatingPayout(null);
                 }}
                 className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
               >
                 APPROVE
               </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Job Modal */}
      {showCreateJobModal && (
        <Modal title="Post New Event" onClose={() => setShowCreateJobModal(false)} maxWidth="max-w-md">
           <form onSubmit={handleCreateJob} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Event Title</label>
                <input required type="text" value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} placeholder="e.g. Wedding Catering" className="w-full bg-[#080c17] border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 focus:ring-indigo-500/30" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Date</label>
                  <input required type="date" value={newJob.date} onChange={e => setNewJob({...newJob, date: e.target.value})} className="w-full bg-[#080c17] border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 focus:ring-indigo-500/30" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Time</label>
                  <input required type="text" value={newJob.time} onChange={e => setNewJob({...newJob, time: e.target.value})} placeholder="e.g. 10:00 AM" className="w-full bg-[#080c17] border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 focus:ring-indigo-500/30" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Location</label>
                <input required type="text" value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} placeholder="e.g. Kochi, Kerala" className="w-full bg-[#080c17] border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 focus:ring-indigo-500/30" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Payment (Rs)</label>
                  <input required type="number" value={newJob.pay || ''} onChange={e => setNewJob({...newJob, pay: parseFloat(e.target.value)})} placeholder="e.g. 500" className="w-full bg-[#080c17] border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 focus:ring-indigo-500/30" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Max Staff</label>
                  <input required type="number" value={newJob.maxWorkers || ''} onChange={e => setNewJob({...newJob, maxWorkers: parseInt(e.target.value)})} placeholder="e.g. 10" className="w-full bg-[#080c17] border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 focus:ring-indigo-500/30" />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg mt-4 transition-all active:scale-95">POST EVENT</button>
           </form>
        </Modal>
      )}

      {/* Edit Job Modal */}
      {editingJob && !actionConfirm && (
        <Modal title="Edit Work Details" onClose={() => setEditingJob(null)} maxWidth="max-w-md">
           <form onSubmit={handleUpdateJobDetails} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Work Title</label>
                <input required type="text" value={editingJob.title} onChange={e => setEditingJob({...editingJob, title: e.target.value})} className="w-full bg-[#080c17] border border-white/5 rounded-xl px-4 py-3 text-white text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Date</label>
                  <input required type="date" value={editingJob.date} onChange={e => setEditingJob({...editingJob, date: e.target.value})} className="w-full bg-[#080c17] border border-white/5 rounded-xl px-4 py-3 text-white text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Pay (Rs)</label>
                  <input required type="number" value={editingJob.pay} onChange={e => setEditingJob({...editingJob, pay: parseFloat(e.target.value)})} className="w-full bg-[#080c17] border border-white/5 rounded-xl px-4 py-3 text-white text-xs" />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg mt-4 transition-all active:scale-95">SAVE UPDATES</button>
           </form>
        </Modal>
      )}

      {/* View Staff Enrolled Modal (Only for Workers now) */}
      {viewingStaffForJob && !isAdmin && (
        <Modal title={`Staff Enrolled: ${viewingStaffForJob.title}`} onClose={() => setViewingStaffForJob(null)} maxWidth="max-w-md">
           <div className="space-y-4">
              {enrollments.filter(e => e.jobId === viewingStaffForJob.id).length > 0 ? (
                enrollments.filter(e => e.jobId === viewingStaffForJob.id).map(enroll => {
                  const worker = workers.find(w => w.id === enroll.userId);
                  if (!worker) return null;
                  return (
                    <div key={enroll.id} className="flex flex-col p-4 bg-[#080c17] border border-white/5 rounded-2xl group hover:bg-[#0c1426] transition-colors space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <Avatar name={worker.name} size="w-10 h-10" />
                             <div className="min-w-0">
                                <p className="text-xs font-black text-white uppercase truncate">{worker.name}</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{worker.email}</p>
                             </div>
                          </div>
                        </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center opacity-30 italic text-xs uppercase font-black tracking-widest">No workers enrolled for this work</div>
              )}
           </div>
        </Modal>
      )}

      {/* Worker History Modal */}
      {viewingWorkerHistory && (
        <Modal title={`${viewingWorkerHistory.name}'s History`} onClose={() => setViewingWorkerHistory(null)} maxWidth="max-w-md">
           <div className="space-y-4">
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-2">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">TOTAL BALANCE</p>
                <p className="text-2xl font-black text-white">{viewingWorkerHistory.balance || 0} Rs</p>
              </div>
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">COMPLETED & ENROLLED WORKS</h4>
              {enrollments.filter(e => e.userId === viewingWorkerHistory.id).length > 0 ? (
                <div className="space-y-3">
                  {enrollments.filter(e => e.userId === viewingWorkerHistory.id).map(enroll => {
                    const job = jobs.find(j => j.id === enroll.jobId);
                    return (
                      <div key={enroll.id} className="p-4 bg-[#080c17] border border-white/5 rounded-2xl flex justify-between items-center">
                        <div>
                           <p className="text-xs font-black text-white uppercase truncate">{job?.title || 'Unknown Event'}</p>
                           <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">{job?.date || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-sm font-black text-indigo-400">{job?.pay || 0} Rs</p>
                           <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">{job?.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center opacity-30 italic text-xs uppercase font-black tracking-widest">No enrollment records for this worker</div>
              )}
           </div>
        </Modal>
      )}

      {/* --- Standard Overlays --- */}

      {showEnrollConfirm && (
        <Modal 
          centered 
          title={enrollments.some(e => e.userId === user?.id && e.jobId === selectedJobForEnroll?.id) ? "Cancel Enrollment" : "Confirm Enrollment"} 
          onClose={() => setShowEnrollConfirm(false)}
        >
           <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${enrollments.some(e => e.userId === user?.id && e.jobId === selectedJobForEnroll?.id) ? 'bg-rose-500/10' : 'bg-indigo-500/10'}`}>
                 {enrollments.some(e => e.userId === user?.id && e.jobId === selectedJobForEnroll?.id) ? (
                   <Icons.XMark className="w-8 h-8 text-rose-400" />
                 ) : (
                   <Icons.Check className="w-8 h-8 text-indigo-400" />
                 )}
              </div>
              <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed px-4">
                {enrollments.some(e => e.userId === user?.id && e.jobId === selectedJobForEnroll?.id) ? (
                  "Do you want to cancel enrollment?"
                ) : (
                  "Do you want to enroll?"
                )}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowEnrollConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">NO, GO BACK</button>
                <button 
                  onClick={() => handleEnrollConfirm()} 
                  className={`flex-1 py-3 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95 ${enrollments.some(e => e.userId === user?.id && e.jobId === selectedJobForEnroll?.id) ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                >
                  YES, CONFIRM
                </button>
              </div>
           </div>
        </Modal>
      )}

      {showWithdrawConfirm && (
        <Modal centered title="Confirm Payout" onClose={() => setShowWithdrawConfirm(false)}>
           <div className="text-center">
              <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed px-4">Are you sure you want to withdraw <span className="text-white font-black">{withdrawalAmount} Rs</span>? </p>
              <div className="flex gap-3"><button onClick={() => setShowWithdrawConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">CANCEL</button><button onClick={confirmWithdrawal} className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95">YES, PROCEED</button></div>
           </div>
        </Modal>
      )}

      {showQrConfirmModal && (
        <Modal centered title="Confirm Upload" onClose={() => setShowQrConfirmModal(false)}>
           <div className="text-center">
              <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed">Confirm upload of this QR image? Our AI will validate it before linking.</p>
              <div className="flex gap-3"><button onClick={() => { setQrFileToProcess(null); setShowQrConfirmModal(false); }} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">CANCEL</button><button onClick={processAndUploadQR} className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95">PROCEED</button></div>
           </div>
        </Modal>
      )}

      {qrWarningMessage && (
        <Modal centered title="Invalid Image" onClose={() => setQrWarningMessage(null)}>
           <div className="text-center"><div className="w-12 h-12 bg-rose-600/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><Icons.XMark className="w-6 h-6 text-rose-500" /></div><p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed px-2">{qrWarningMessage}</p><button onClick={() => setQrWarningMessage(null)} className="w-full py-3 bg-slate-800 text-white font-black rounded-xl text-[10px] uppercase tracking-widest active:scale-95">RETRY</button></div>
        </Modal>
      )}

      {showLogoutConfirm && (
        <Modal centered title="Confirm Exit" onClose={() => setShowLogoutConfirm(false)}>
           <div className="text-center"><p className="text-xs text-slate-400 font-medium mb-8">Ready to end your current session?</p><div className="flex gap-3"><button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95">CANCEL</button><button onClick={handleLogout} className="flex-1 py-3 bg-rose-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95">LOGOUT</button></div></div>
        </Modal>
      )}
    </div>
  );
}
