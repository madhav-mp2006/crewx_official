
import React, { useState, useEffect, useRef } from 'react';
import { User, Job, Enrollment, UserRole, JobStatus, WithdrawalStatus, AppNotification, NotificationType, WithdrawalRequest } from './types';
import { db } from './db';
import { Icons, APP_NAME } from './constants';
import { supabase } from './supabase';
import { GoogleGenAI } from "@google/genai";

// --- AI Service ---
const validateQrWithAI = async (base64Data: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Strip metadata from base64 if present
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
    // Fail-safe: if AI fails, we might want to allow or block. 
    // Given the strict requirement, let's assume it needs validation.
    return false;
  }
};

// --- Shared Components ---

const LoadingOverlay: React.FC<{ message?: string }> = ({ message = "LOADING... PLEASE WAIT" }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-[4px] animate-in fade-in duration-200">
    <div className="bg-slate-900 p-6 rounded-2xl shadow-2xl text-center flex flex-col items-center gap-4 border border-slate-800">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <div>
        <p className="text-slate-100 font-bold text-sm tracking-wide uppercase">{message}</p>
        <p className="text-slate-500 text-[10px] mt-1 font-medium uppercase tracking-tighter">Securing with CrewX Cloud</p>
      </div>
    </div>
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

// Added id prop to Card component to fix "Property 'id' does not exist on type..." error
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

const openGoogleMaps = (location: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank');
};

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

// --- Notification UI Component ---

const NotificationItem: React.FC<{ notification: AppNotification, onRead: (id: string, eid?: string) => void, onDelete: (id: string) => void }> = ({ notification, onRead, onDelete }) => (
  <div 
    onClick={() => onRead(notification.id, notification.event_id)}
    className={`p-4 border-b border-slate-800 cursor-pointer transition-all hover:bg-slate-800/50 flex gap-4 relative group ${notification.is_read ? 'opacity-60' : 'bg-indigo-500/5 animate-pulse'}`}
  >
    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${notification.is_read ? 'bg-slate-700' : 'bg-indigo-500'}`} />
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-start">
        <h4 className={`font-bold text-sm text-slate-100 truncate pr-6 ${notification.is_read ? '' : 'text-indigo-300'}`}>{notification.title}</h4>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
          className="absolute right-4 top-4 p-1 text-slate-600 hover:text-rose-500 transition-colors lg:opacity-0 lg:group-hover:opacity-100"
        >
          <Icons.Trash className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{notification.message}</p>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
          {new Date(notification.created_at).toLocaleDateString()} {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {notification.event_id && (
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border border-indigo-900/50 px-2 py-0.5 rounded-md hover:bg-indigo-600 hover:text-white transition-colors">View Event</span>
        )}
      </div>
    </div>
  </div>
);

// --- Application Screens ---

type AppView = 'auth' | 'dashboard' | 'jobs' | 'wallet' | 'payout_history' | 'admin_payout_history' | 'admin_users' | 'admin_requests' | 'admin_history' | 'contact' | 'my_enrolled_jobs' | 'profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const isAdmin = user?.role === UserRole.ADMIN;
  const [view, setView] = useState<AppView>('auth');
  const [isSignup, setIsSignup] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<'form' | 'otp'>('form');
  const [loginRole, setLoginRole] = useState<UserRole>(UserRole.WORKER);
  const [isLoading, setIsLoading] = useState(true);
  const [dbTaskLoading, setDbTaskLoading] = useState(false);
  const [customLoadingMessage, setCustomLoadingMessage] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const [paidUserIds, setPaidUserIds] = useState<Set<string>>(new Set());

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQrWarning, setShowQrWarning] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [showEnrollConfirm, setShowEnrollConfirm] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Auth Form States
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [otpValue, setOtpValue] = useState('');
  
  const [loginAccountError, setLoginAccountError] = useState(false);
  const [signupAccountError, setSignupAccountError] = useState(false);

  // Forgot Password States
  const [forgotStep, setForgotStep] = useState<'details' | 'otp' | 'new_password'>('details');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

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
      
      const currentStoredUserString = localStorage.getItem('crewx_user');
      if (currentStoredUserString) {
        try {
          const currentStoredUser = JSON.parse(currentStoredUserString);
          if (currentStoredUser && currentStoredUser.id) {
            const freshUser = u.find(usr => String(usr.id) === String(currentStoredUser.id));
            if (freshUser) {
              setUser(freshUser);
              localStorage.setItem('crewx_user', JSON.stringify(freshUser));
              const n = await db.getNotifications(freshUser.id);
              setNotifications(n);
            }
          }
        } catch (e) {
          console.error("Parse stored user error", e);
        }
      }
    } catch (err) {
      console.error("Data Fetch Error:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchData();
      const stored = localStorage.getItem('crewx_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (u) {
            setUser(u);
            setView('dashboard');
            db.cleanupOldNotifications();
            if ("Notification" in window) {
              Notification.requestPermission();
            }
          }
        } catch(e) {}
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!user || user.role !== UserRole.WORKER) return;
    const reminderCheck = async () => {
      const myEnrollments = enrollments.filter(e => e.userId === user.id);
      const now = new Date();
      for (const en of myEnrollments) {
        const job = jobs.find(j => j.id === en.jobId);
        if (!job || job.status === JobStatus.COMPLETED) continue;
        const timePart = job.time.match(/(\d{1,2}:\d{2})/)?.[0] || '09:00';
        const eventStart = new Date(`${job.date}T${timePart}`);
        const diffMs = eventStart.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours > 0 && diffHours <= 24.1) {
          const key24 = `rem-24h-sent-${job.id}`;
          if (!localStorage.getItem(key24)) {
            await db.saveNotification({
              user_id: user.id,
              title: "Event Reminder",
              message: `Reminder: You are enrolled in '${job.title}' starting at ${job.time} in 24 hours.`,
              type: NotificationType.REMINDER,
              event_id: job.id
            });
            localStorage.setItem(key24, 'true');
            sendPushNotification("Event Reminder", `Shift starting in ~24h: ${job.title}`);
          }
        }
        if (diffHours > 0 && diffHours <= 1.1) {
          const key1h = `rem-1h-sent-${job.id}`;
          if (!localStorage.getItem(key1h)) {
            await db.saveNotification({
              user_id: user.id,
              title: "Event Reminder",
              message: `Reminder: You are enrolled in '${job.title}' starting at ${job.time} in 1 hour.`,
              type: NotificationType.REMINDER,
              event_id: job.id
            });
            localStorage.setItem(key1h, 'true');
            sendPushNotification("Event Reminder", `Shift starting in 1h: ${job.title}`);
          }
        }
      }
    };
    const timer = setInterval(reminderCheck, 300000);
    reminderCheck();
    return () => clearInterval(timer);
  }, [user, jobs, enrollments]);

  const sendPushNotification = (title: string, body: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('crewx-system-wide')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => fetchData(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
         if (user && payload.new.user_id === user.id) {
           const newNotif = payload.new as AppNotification;
           setNotifications(prev => [newNotif, ...prev]);
           if (user.role === UserRole.WORKER) {
             sendPushNotification(newNotif.title, newNotif.message);
           }
         }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
         if (user && payload.new.user_id === user.id) {
           db.getNotifications(user.id).then(setNotifications);
         }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, () => {
         if (user) db.getNotifications(user.id).then(setNotifications);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogin = async (email: string, password?: string) => {
    setLoginAccountError(false);
    setDbTaskLoading(true);
    setCustomLoadingMessage("VERIFYING...");
    try {
      const normalizedEmail = email.toLowerCase().trim();
      if (loginRole === UserRole.ADMIN) {
        if (!password) {
          setCustomLoadingMessage("INVALID PASSWORD");
          setTimeout(() => { setDbTaskLoading(false); setCustomLoadingMessage(null); }, 1500);
          return;
        }
        const isValid = await db.verifyAdmin(normalizedEmail, password);
        if (isValid) {
          let adminProfile = await db.getUserByEmail(normalizedEmail);
          if (!adminProfile) {
            adminProfile = {
              id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9),
              name: 'Admin User',
              email: normalizedEmail,
              password: password,
              role: UserRole.ADMIN,
              balance: 0
            };
            await db.saveUser(adminProfile);
          }
          setUser(adminProfile); 
          localStorage.setItem('crewx_user', JSON.stringify(adminProfile));
          setView('dashboard'); 
          setDbTaskLoading(false);
          setCustomLoadingMessage(null);
          return;
        } else {
          setCustomLoadingMessage("INVALID PASSWORD");
          setTimeout(() => { setDbTaskLoading(false); setCustomLoadingMessage(null); }, 1500);
          return;
        }
      }
      const found = await db.getUserByEmail(normalizedEmail);
      if (found && found.role === UserRole.WORKER) { 
        if (found.password === password) {
          setUser(found); 
          localStorage.setItem('crewx_user', JSON.stringify(found));
          setView('dashboard'); 
          setDbTaskLoading(false);
          setCustomLoadingMessage(null);
        } else {
          setCustomLoadingMessage("INVALID PASSWORD");
          setTimeout(() => { setDbTaskLoading(false); setCustomLoadingMessage(null); }, 1500);
        }
      } else { 
        setLoginAccountError(true);
        setDbTaskLoading(false);
        setCustomLoadingMessage(null);
      }
    } catch (e) {
      console.error(e);
      alert("Login failed.");
      setDbTaskLoading(false);
      setCustomLoadingMessage(null);
    }
  };

  const generateAndSendOtp = async (email: string, isResend = false) => {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    await db.saveOtp(email, newOtp);
    console.log(`[CrewX Security] OTP for ${email}: ${newOtp}`);
    
    if (isResend) {
      alert("otp is sended");
    } else {
      alert(`A verification code has been sent to ${email}`);
    }
  };

  const startRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || !isPhoneValid || !isPasswordValid || !isNameValid) return;
    
    setDbTaskLoading(true);
    try {
      const existing = await db.getUserByEmail(authEmail);
      if (existing) {
        setSignupAccountError(true);
        setDbTaskLoading(false);
        return;
      }
      await generateAndSendOtp(authEmail);
      setRegistrationStep('otp');
    } catch (err) {
      alert("Error starting registration.");
    } finally {
      setDbTaskLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbTaskLoading(true);
    setCustomLoadingMessage("VERIFYING...");
    try {
      const isValid = await db.verifyOtp(authEmail, otpValue);
      if (!isValid) {
        setCustomLoadingMessage("INVALID OTP");
        setTimeout(() => {
          setDbTaskLoading(false);
          setCustomLoadingMessage(null);
          setOtpValue('');
        }, 1500);
        return;
      }

      const newUser: User = { 
        id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9), 
        name: authName, 
        email: authEmail.toLowerCase().trim(), 
        phone: authPhone, 
        password: authPassword,
        role: UserRole.WORKER, 
        balance: 0 
      };
      await db.saveUser(newUser);
      await fetchData();
      
      setCustomLoadingMessage("REGISTERED SUCCESFULLY");
      
      setTimeout(() => {
        setIsSignup(false);
        setRegistrationStep('form');
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
        setAuthPhone('');
        setOtpValue('');
        setCustomLoadingMessage(null);
        setDbTaskLoading(false);
      }, 2000);

    } catch (err) {
      alert("Error during final registration.");
      setDbTaskLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('crewx_user');
    setUser(null); 
    setView('auth'); 
    setShowLogoutConfirm(false);
    setShowProfileMenu(false);
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setAuthPhone('');
    setOtpValue('');
    setRegistrationStep('form');
    setLoginAccountError(false);
    setSignupAccountError(false);
  };

  // --- Password Recovery Workflow ---

  const startPasswordRecovery = async () => {
    if (!forgotEmail.toLowerCase().includes('@gmail.com') || forgotPhone.length !== 10) {
      alert("Provide valid email and phone.");
      return;
    }
    setDbTaskLoading(true);
    try {
      const u = await db.getUserByEmail(forgotEmail);
      if (u && u.phone === forgotPhone) {
        await generateAndSendOtp(forgotEmail);
        setForgotStep('otp');
      } else {
        alert("Details do not match any account.");
      }
    } catch (e) {
      alert("Error initiating recovery.");
    } finally {
      setDbTaskLoading(false);
    }
  };

  const verifyRecoveryOtp = async () => {
    if (forgotOtp.length !== 6) return;
    setDbTaskLoading(true);
    setCustomLoadingMessage("VERIFYING...");
    try {
      const isValid = await db.verifyOtp(forgotEmail, forgotOtp);
      if (isValid) {
        setForgotStep('new_password');
        setDbTaskLoading(false);
        setCustomLoadingMessage(null);
      } else {
        setCustomLoadingMessage("INVALID OTP");
        setTimeout(() => {
          setDbTaskLoading(false);
          setCustomLoadingMessage(null);
          setForgotOtp('');
        }, 1500);
      }
    } catch (e) {
      alert("Verification error.");
      setDbTaskLoading(false);
      setCustomLoadingMessage(null);
    }
  };

  const finalizePasswordReset = async () => {
    if (newPass.length < 6) return;
    setDbTaskLoading(true);
    try {
      const u = await db.getUserByEmail(forgotEmail);
      if (u) {
        await db.updateUser(u.id, { password: newPass });
        setResetSuccess(true);
        setTimeout(() => {
          setShowForgotModal(false);
          setResetSuccess(false);
          setForgotEmail('');
          setForgotPhone('');
          setForgotOtp('');
          setNewPass('');
          setForgotStep('details');
        }, 2000);
      }
    } catch (e) {
      alert("Reset failed.");
    } finally {
      setDbTaskLoading(false);
    }
  };

  // --- Actions ---

  const handleQrUpload = async (file: File) => {
    if (!user) return;
    setDbTaskLoading(true);
    setCustomLoadingMessage("VALIDATING QR CODE...");
    try {
        const base64 = await toBase64(file);
        const isValid = await validateQrWithAI(base64);
        
        if (isValid) {
            await db.updateUser(user.id, { qrCode: base64 });
            await fetchData(true);
            setCustomLoadingMessage("UPLOAD SUCCESSFUL!");
            setTimeout(() => {
              setDbTaskLoading(false);
              setCustomLoadingMessage(null);
            }, 1500);
        } else {
            setCustomLoadingMessage("INVALID QR CODE. RETRY AGAIN.");
            setTimeout(() => {
              setDbTaskLoading(false);
              setCustomLoadingMessage(null);
            }, 2500);
        }
    } catch (e) { 
      alert("Error uploading QR Code."); 
      setDbTaskLoading(false);
      setCustomLoadingMessage(null);
    }
  };

  const enrollInJob = async (jobId: string) => {
    if (!user) return;
    if (user.role === UserRole.WORKER && !user.qrCode) {
        setShowQrWarning(true);
        return;
    }
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.status !== JobStatus.OPEN) return;
    setDbTaskLoading(true);
    try {
      const newEnrollment: Enrollment = { 
        id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9), 
        userId: user.id, 
        jobId: jobId, 
        enrolledAt: new Date().toISOString() 
      };
      const currentStaffCount = enrollments.filter(e => e.jobId === jobId).length;
      const newCount = currentStaffCount + 1;
      const newStatus = newCount >= job.maxWorkers ? JobStatus.CLOSED : job.status;
      await db.saveEnrollment(newEnrollment);
      await db.updateJob(jobId, { enrolledCount: newCount, status: newStatus });
      await fetchData(true);
      setShowEnrollConfirm(null);
    } catch (err) {
      alert("Error during enrollment.");
    } finally {
      setDbTaskLoading(false);
    }
  };

  const cancelEnrollment = async (jobId: string) => {
    if (!user) return;
    setDbTaskLoading(true);
    try {
      const job = jobs.find(j => j.id === jobId);
      await db.deleteEnrollmentByUserAndJob(user.id, jobId);
      if (job) {
        const currentStaffCount = enrollments.filter(e => e.jobId === jobId).length;
        const newCount = Math.max(0, currentStaffCount - 1);
        const newStatus = job.status === JobStatus.CLOSED ? JobStatus.OPEN : job.status;
        await db.updateJob(jobId, { enrolledCount: newCount, status: newStatus });
      }
      await fetchData(true);
      setShowCancelConfirm(null);
    } catch (err) {
      alert("Error cancelling enrollment.");
      await fetchData(true);
    } finally {
      setDbTaskLoading(false);
    }
  };

  const createJob = async (title: string, date: string, time: string, location: string, pay: number, max: number) => {
    setDbTaskLoading(true);
    try {
      const newJob: Job = { 
        id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9), 
        title, date, time, location, pay, maxWorkers: max, 
        enrolledCount: 0, status: JobStatus.OPEN 
      };
      await db.saveJob(newJob);
      await fetchData(true);
      alert("New event created!");
    } catch (err) { 
      alert("Error creating job."); 
    } finally {
      setDbTaskLoading(false);
    }
  };

  const updateJob = async (jobId: string, updates: Partial<Job>) => {
    setDbTaskLoading(true);
    try {
      await db.updateJob(jobId, updates);
      await fetchData(true);
    } catch (err) { 
      alert("Error updating job."); 
    } finally {
      setDbTaskLoading(false);
    }
  };

  const updateJobStatus = async (jobId: string, status: JobStatus) => {
    setDbTaskLoading(true);
    try {
      await db.updateJob(jobId, { status });
      await fetchData(true);
    } catch (err) { 
      alert("Error updating status."); 
    } finally {
      setDbTaskLoading(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    setDbTaskLoading(true);
    try {
      await db.deleteEnrollmentsByJob(jobId);
      await db.deleteJob(jobId);
      await fetchData(true);
    } catch (err) { 
      alert("Error deleting job."); 
    } finally {
      setDbTaskLoading(false);
    }
  };

  const requestWithdrawal = async (amount: number) => {
    if (!user || amount > user.balance) return;
    setDbTaskLoading(true);
    try {
      const request: WithdrawalRequest = { 
        id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9), 
        userId: user.id, amount, status: WithdrawalStatus.PENDING, 
        createdAt: new Date().toISOString() 
      };
      await db.saveWithdrawal(request);
      await fetchData(true);
      alert('Withdrawal request submitted.');
    } catch (err) { 
      alert("Error submitting request."); 
    } finally { 
      setDbTaskLoading(false); 
    }
  };

  const processWithdrawal = async (id: string, approve: boolean) => {
    const request = withdrawals.find(w => w.id === id);
    if (!request) return;
    setDbTaskLoading(true);
    try {
      const newStatus = approve ? WithdrawalStatus.APPROVED : WithdrawalStatus.REJECTED;
      if (approve) {
        const u = users.find(usr => usr.id === request.userId);
        if (u) {
          await db.updateUser(u.id, { balance: Math.max(0, u.balance - request.amount) });
        }
      }
      await db.updateWithdrawal(id, newStatus);
      await fetchData(true);
    } catch (err) { 
      alert("Error processing withdrawal."); 
    } finally {
      setDbTaskLoading(false);
    }
  };

  const addEarnings = async (userId: string, amount: number) => {
    const u = users.find(usr => String(usr.id) === String(userId));
    if (!u) return;
    setDbTaskLoading(true);
    try {
      await db.updateUser(userId, { balance: u.balance + amount });
      setPaidUserIds(prev => new Set(prev).add(userId));
      await fetchData(true);
    } catch (err) { 
      alert("Error adding pay."); 
    } finally {
      setDbTaskLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await db.markAllNotificationsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {}
  };

  const handleReadNotification = async (id: string, eventId?: string) => {
    try {
      await db.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      if (eventId) {
        setView('jobs');
        setShowNotifications(false);
      }
    } catch (e) {}
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await db.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {}
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-black uppercase tracking-widest">LOADING... PLEASE WAIT</p>
        </div>
      </div>
    );
  }

  const isEmailValid = authEmail.toLowerCase().includes('@gmail.com');
  const isPhoneValid = authPhone.length === 10;
  const isPasswordValid = authPassword.length >= 6;
  const isNameValid = authName.trim().length > 0;
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100">
      {dbTaskLoading && <LoadingOverlay message={customLoadingMessage || undefined} />}
      
      {showQrWarning && (
        <Modal title="Payment Setup Required" onClose={() => setShowQrWarning(false)}>
           <div className="text-center p-2">
              <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/30">
                 <Icons.Wallet className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-white uppercase mb-2">QR Code Missing</h4>
              <p className="text-slate-400 text-sm mb-8 leading-relaxed">To enroll in events and receive payments, you must upload your <strong>UPI Payment QR Code</strong> first. This allows admins to process your earnings efficiently.</p>
              <Button 
                variant="primary" 
                className="w-full py-4 font-black uppercase tracking-widest" 
                onClick={() => {
                  setShowQrWarning(false);
                  setView('dashboard');
                }}
              >
                GO TO DASHBOARD TO UPLOAD
              </Button>
           </div>
        </Modal>
      )}

      {showForgotModal && (
        <Modal title="Password Recovery" onClose={() => { setShowForgotModal(false); setForgotStep('details'); }}>
          <div className="space-y-4 min-h-[200px] flex flex-col justify-center">
            {resetSuccess ? (
              <div className="py-10 text-center animate-in zoom-in duration-300">
                 <Icons.Check className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                 <p className="font-bold text-slate-100">Password Changed Successfully!</p>
              </div>
            ) : forgotStep === 'details' ? (
              <>
                <p className="text-sm text-slate-400">Enter your linked Gmail and phone number to verify ownership.</p>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Email (@gmail.com)</label>
                  <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${forgotEmail.length > 0 && !forgotEmail.toLowerCase().includes('@gmail.com') ? 'border-rose-600' : 'border-slate-700'}`} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Phone (10 Digits)</label>
                  <input type="tel" value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${forgotEmail.length > 0 && forgotPhone.length !== 10 ? 'border-rose-600' : 'border-slate-700'}`} />
                </div>
                <Button variant="primary" className="w-full py-4 mt-4 font-black uppercase" onClick={startPasswordRecovery} disabled={dbTaskLoading}>Send Recovery Code</Button>
              </>
            ) : forgotStep === 'otp' ? (
              <div className="animate-in slide-in-from-right duration-300">
                <p className="text-sm text-slate-400 text-center mb-6">Enter code sent to <span className="text-indigo-400 font-bold">{forgotEmail}</span></p>
                <input 
                    type="text" 
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center tracking-[1em] text-2xl font-black py-4 bg-slate-800 border-2 border-indigo-500/30 rounded-xl text-white outline-none focus:border-indigo-500 transition-all mb-4"
                />
                <Button variant="primary" className="w-full py-4 font-black uppercase" onClick={verifyRecoveryOtp} disabled={dbTaskLoading || forgotOtp.length < 6}>Verify Code</Button>
                <button type="button" onClick={() => generateAndSendOtp(forgotEmail, true)} className="w-full text-[10px] font-black text-slate-500 uppercase mt-4 hover:text-indigo-400 tracking-widest">Resend Code</button>
              </div>
            ) : (
              <div className="animate-in slide-in-from-right duration-300">
                <p className="text-sm text-slate-400 mb-4">Set your new account password.</p>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">New Password (Min. 6 chars)</label>
                <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${newPass.length > 0 && newPass.length < 6 ? 'border-rose-600' : 'border-slate-700'}`} />
                <Button variant="primary" className="w-full py-4 mt-6 font-black uppercase" onClick={finalizePasswordReset} disabled={dbTaskLoading || newPass.length < 6}>Update Password</Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showLogoutConfirm && (
        <Modal title="Logout" onClose={() => setShowLogoutConfirm(false)}>
          <div className="text-center">
            <p className="text-slate-400 mb-6">Are you sure you want to logout?</p>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setShowLogoutConfirm(false)}>No</Button>
              <Button variant="danger" className="flex-1" onClick={handleLogout}>Yes, Logout</Button>
            </div>
          </div>
        </Modal>
      )}

      {view === 'auth' ? (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 w-full">
          <Card className="max-w-md w-full p-8 border-slate-800 bg-slate-900 shadow-2xl">
            <div className="text-center mb-10">
              <Logo className="mb-2" />
              <p className="text-slate-400 font-medium text-sm">
                {isSignup ? 'Create worker profile' : 'Catering Staff Management'}
              </p>
            </div>

            {!isSignup && (
              <div className="flex bg-slate-800 p-1 rounded-lg mb-6 border border-slate-700">
                <button onClick={() => setLoginRole(UserRole.WORKER)} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${loginRole === UserRole.WORKER ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-500 hover:text-slate-300'}`}>Worker</button>
                <button onClick={() => setLoginRole(UserRole.ADMIN)} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${loginRole === UserRole.ADMIN ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-500 hover:text-slate-300'}`}>Admin</button>
              </div>
            )}

            {isSignup && registrationStep === 'otp' ? (
              <form onSubmit={handleVerifyOtp} className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center">
                  <h3 className="font-black text-xl text-white tracking-tight mb-2 uppercase">Verify Identity</h3>
                  <p className="text-xs text-slate-400">Enter the 6-digit code sent to<br/><span className="text-indigo-400 font-bold">{authEmail}</span></p>
                </div>
                <div>
                  <input 
                    type="text" 
                    maxLength={6}
                    value={otpValue}
                    onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center tracking-[1em] text-2xl font-black py-4 bg-slate-800 border-2 border-indigo-500/30 rounded-xl text-white outline-none focus:border-indigo-500 transition-all placeholder:tracking-normal placeholder:opacity-20"
                    required
                  />
                </div>
                <div className="space-y-3">
                  <Button type="submit" disabled={dbTaskLoading || otpValue.length < 6} className="w-full py-4 text-lg font-black uppercase tracking-widest">
                    {dbTaskLoading ? 'VERIFYING...' : 'COMPLETE REGISTRATION'}
                  </Button>
                  <button 
                    type="button"
                    onClick={() => generateAndSendOtp(authEmail, true)}
                    className="w-full text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition-colors"
                  >
                    Didn't get a code? Resend
                  </button>
                </div>
                <button type="button" onClick={() => setRegistrationStep('form')} className="w-full text-xs text-slate-600 hover:text-slate-400 font-medium transition-colors underline underline-offset-4">
                  Edit information
                </button>
              </form>
            ) : (
              <form onSubmit={isSignup ? startRegistration : (e) => { e.preventDefault(); handleLogin(authEmail, authPassword); }}>
                <div className="space-y-4">
                  {isSignup && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Full Name</label>
                        <input value={authName} onChange={(e) => setAuthName(e.target.value)} type="text" className={`w-full px-4 py-3 rounded-lg bg-slate-800 border outline-none focus:ring-2 transition-all ${authName.length > 0 && !isNameValid ? 'border-rose-600' : 'border-slate-700'}`} required />
                        {authName.length > 0 && !isNameValid && <p className="text-[10px] text-rose-500 mt-1 font-bold italic">Full name is required</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Phone Number</label>
                        <input 
                          value={authPhone} 
                          onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                          type="tel" 
                          autoComplete="off"
                          className={`w-full px-4 py-3 rounded-lg bg-slate-800 border outline-none focus:ring-2 transition-all ${authPhone.length > 0 && !isPhoneValid ? 'border-rose-600' : 'border-slate-700'}`} 
                          required 
                        />
                        {authPhone.length > 0 && !isPhoneValid && <p className="text-[10px] text-rose-500 mt-1 font-bold italic">phone number should contain 10 digits</p>}
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Email Address</label>
                    <input 
                      value={authEmail} 
                      onChange={(e) => { setAuthEmail(e.target.value); setLoginAccountError(false); setSignupAccountError(false); }} 
                      type="email" 
                      autoComplete="off"
                      className={`w-full px-4 py-3 rounded-lg bg-slate-800 border outline-none focus:ring-2 transition-all ${authEmail.length > 0 && !isEmailValid ? 'border-rose-600' : 'border-slate-700'}`} 
                      required 
                    />
                    {authEmail.length > 0 && !isEmailValid && <p className="text-[10px] text-rose-500 mt-1 font-bold italic">email should include @gmail.com</p>}
                    {!isSignup && loginAccountError && <p className="text-[10px] text-rose-500 mt-1 font-bold">Account doesn't exist</p>}
                    {isSignup && signupAccountError && <p className="text-[10px] text-rose-500 mt-1 font-bold italic">Account already exists</p>}
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                      {!isSignup && loginRole === UserRole.WORKER && (
                        <button type="button" onClick={() => setShowForgotModal(true)} className="text-[10px] text-indigo-400 font-bold hover:underline">Forgot your password?</button>
                      )}
                    </div>
                    <input 
                      value={authPassword} 
                      onChange={(e) => setAuthPassword(e.target.value)} 
                      type="password" 
                      autoComplete="off"
                      className={`w-full px-4 py-3 rounded-lg bg-slate-800 border outline-none focus:ring-2 transition-all ${authPassword.length > 0 && !isPasswordValid ? 'border-rose-600' : 'border-slate-700'}`} 
                      required 
                    />
                    {authPassword.length > 0 && !isPasswordValid && <p className="text-[10px] text-rose-500 mt-1 font-bold italic">password should contain 6 characters</p>}
                  </div>
                  <Button type="submit" disabled={dbTaskLoading || (isSignup && (!isEmailValid || !isPhoneValid || !isPasswordValid || !isNameValid)) || (!isSignup && (!isEmailValid || !isPasswordValid))} className="w-full py-4 text-lg font-black mt-2 uppercase tracking-widest">
                    {dbTaskLoading ? 'VERIFYING...' : (isSignup ? 'SEND VERIFICATION' : 'Sign In')}
                  </Button>
                </div>
              </form>
            )}
            <div className="mt-6 text-center">
              <button onClick={() => { setIsSignup(!isSignup); setLoginRole(UserRole.WORKER); setRegistrationStep('form'); }} className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors text-sm underline underline-offset-4">
                {isSignup ? 'Already have an account? Sign In' : 'Need an account? Signup as Worker'}
              </button>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 md:relative md:w-64 md:border-t-0 md:border-r z-50">
            <div className="flex flex-row justify-around p-2 md:flex-col md:justify-start md:h-screen md:p-6">
              <div className="hidden md:flex mb-10 px-2 group cursor-pointer items-center justify-center" onClick={() => setView('dashboard')}>
                <Logo />
              </div>
              <div className="flex flex-row justify-around w-full md:flex-col md:gap-3">
                <NavButton icon={<Icons.Dashboard className="w-6 h-6"/>} label="Home" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                <NavButton icon={<Icons.Briefcase className="w-6 h-6"/>} label="Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
                {!isAdmin ? (
                    <>
                        <NavButton icon={<Icons.Wallet className="w-6 h-6"/>} label="Wallet" active={view === 'wallet'} onClick={() => setView('wallet')} />
                        <NavButton icon={<Icons.Check className="w-6 h-6"/>} label="Enrolled" active={view === 'my_enrolled_jobs'} onClick={() => setView('my_enrolled_jobs')} />
                        <NavButton icon={<Icons.Users className="w-6 h-6"/>} label="Contact" active={view === 'contact'} onClick={() => setView('contact')} />
                        <NavButton icon={<Icons.Dashboard className="w-6 h-6"/>} label="Payout Hist." active={view === 'payout_history'} onClick={() => setView('payout_history')} />
                    </>
                ) : (
                    <>
                        <NavButton icon={<Icons.Users className="w-6 h-6"/>} label="Staff" active={view === 'admin_users'} onClick={() => setView('admin_users')} />
                        <NavButton icon={<Icons.Check className="w-6 h-6"/>} label="History" active={view === 'admin_history'} onClick={() => setView('admin_history')} />
                        <NavButton icon={<Icons.Plus className="w-6 h-6"/>} label="Payouts" active={view === 'admin_requests'} onClick={() => setView('admin_requests')} />
                        <NavButton icon={<Icons.Wallet className="w-6 h-6"/>} label="Payout Hist." active={view === 'admin_payout_history'} onClick={() => setView('admin_payout_history')} />
                    </>
                )}
                <button onClick={() => setShowLogoutConfirm(true)} className="flex flex-col items-center justify-center p-2 text-slate-500 hover:text-rose-400 md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2 md:mt-auto md:rounded-lg md:hover:bg-rose-950/30 transition-all">
                  <Icons.Logout className="w-6 h-6"/><span className="text-[10px] md:text-sm font-semibold">Exit</span>
                </button>
              </div>
            </div>
          </nav>

          <main className="flex-1 pb-24 md:pb-0 overflow-y-auto max-h-screen bg-slate-950">
            <header className="sticky top-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between z-40">
              <h1 className="text-xl font-black capitalize tracking-tight text-slate-100">{formatViewName(view)}</h1>
              <div className="flex items-center gap-2 relative">
                <div className="relative" ref={notificationMenuRef}>
                  <button onClick={() => setShowNotifications(!showNotifications)} className={`p-2 rounded-full transition-all relative ${showNotifications ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <Icons.Bell className="w-6 h-6" />
                    {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse border-2 border-slate-900 shadow-lg">{unreadCount}</span>}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 top-full mt-4 w-80 max-w-[90vw] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-[60] animate-in slide-in-from-top-2 duration-200">
                      <div className="p-4 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-300">Notifications</h3>
                        {unreadCount > 0 && <button onClick={handleMarkAllRead} className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter hover:text-indigo-300 transition-colors">Mark all read</button>}
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length > 0 ? notifications.map(n => <NotificationItem key={n.id} notification={n} onRead={handleReadNotification} onDelete={handleDeleteNotification} />) : <div className="p-10 text-center"><Icons.Bell className="w-10 h-10 text-slate-700 mb-3 opacity-20 mx-auto" /><p className="text-xs text-slate-600 font-bold uppercase tracking-widest">No notifications yet</p></div>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 relative" ref={profileMenuRef}>
                  <Avatar name={user?.name || ''} onClick={() => setShowProfileMenu(!showProfileMenu)} />
                  {showProfileMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-[60] animate-in slide-in-from-top-2 duration-200">
                       <button onClick={() => setShowLogoutConfirm(true)} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2 transition-colors"><Icons.Logout className="w-4 h-4" /> Logout</button>
                    </div>
                  )}
                </div>
              </div>
            </header>
            <div className="p-6 max-w-5xl mx-auto">
              {view === 'dashboard' && user && <Dashboard user={user} jobs={jobs} enrollments={enrollments} isAdmin={isAdmin} setView={setView} withdrawals={withdrawals} users={users} onQrUpload={handleQrUpload} />}
              {view === 'jobs' && user && <JobsView user={user} jobs={jobs} enrollments={enrollments} users={users} isAdmin={isAdmin} onEnroll={(id) => setShowEnrollConfirm(id)} onCreate={createJob} onUpdateJob={updateJob} onStatusUpdate={updateJobStatus} onDelete={deleteJob} isSubmitting={dbTaskLoading} onAddEarnings={addEarnings} paidUserIds={paidUserIds} />}
              {view === 'my_enrolled_jobs' && user && <MyEnrolledJobsView user={user} jobs={jobs} enrollments={enrollments} onCancelEnroll={(id) => setShowCancelConfirm(id)} />}
              {view === 'wallet' && user && <WalletView user={user} withdrawals={withdrawals} onRequest={requestWithdrawal} isSubmitting={dbTaskLoading} />}
              {view === 'payout_history' && user && <PayoutHistoryView user={user} withdrawals={withdrawals} />}
              {view === 'admin_payout_history' && <AdminPayoutHistoryView withdrawals={withdrawals} users={users} />}
              {view === 'admin_users' && <AdminUsers users={users} jobs={jobs} enrollments={enrollments} onAddEarnings={addEarnings} paidUserIds={paidUserIds} />}
              {view === 'admin_history' && <AdminHistory enrollments={enrollments} users={users} jobs={jobs} />}
              {view === 'admin_requests' && <AdminWithdrawals withdrawals={withdrawals} users={users} onProcess={processWithdrawal} />}
              {view === 'contact' && user && <ContactUsView user={user} />}
            </div>
          </main>
        </>
      )}
    </div>
  );
}

// --- Sub-Views ---

const Dashboard: React.FC<{ 
  user: User, 
  jobs: Job[], 
  enrollments: Enrollment[], 
  isAdmin: boolean, 
  setView: (v: AppView) => void, 
  withdrawals: WithdrawalRequest[], 
  users: User[], 
  onQrUpload: (f: File) => void 
}> = ({ user, jobs, enrollments, isAdmin, setView, withdrawals, users, onQrUpload }) => {
  const myEnrollments = enrollments.filter(e => e.userId === user.id);
  const openJobsCount = jobs.filter(j => j.status === JobStatus.OPEN).length;
  const upcomingEvents = jobs.filter(j => myEnrollments.some(e => String(e.jobId) === String(j.id)) && j.status !== JobStatus.COMPLETED);
  const recentTransactions = withdrawals.filter(w => String(w.userId) === String(user.id)).slice(0, 3);
  const lastSuccessfulPayout = withdrawals.find(w => String(w.userId) === String(user.id) && w.status === WithdrawalStatus.APPROVED);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isAdmin ? (
          <>
            <StatCard onClick={() => setView('admin_users')} label="Total Staff" value={users.filter(u => u.role === UserRole.WORKER).length.toString()} icon={<Icons.Users className="text-indigo-400 w-8 h-8"/>}/>
            <StatCard onClick={() => setView('jobs')} label="Live Events" value={jobs.filter(j => j.status !== JobStatus.COMPLETED).length.toString()} icon={<Icons.Briefcase className="text-indigo-400 w-8 h-8"/>}/>
            <StatCard onClick={() => setView('admin_requests')} label="Pending Payouts" value={withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).length.toString()} icon={<Icons.Wallet className="text-rose-400 w-8 h-8"/>}/>
          </>
        ) : (
          <>
            <StatCard onClick={() => setView('wallet')} label="My Wallet" value={`${user.balance} Rs`} icon={<Icons.Wallet className="text-emerald-400 w-8 h-8"/>}/>
            <StatCard onClick={() => setView('my_enrolled_jobs')} label="Enrolled" value={myEnrollments.length.toString()} icon={<Icons.Check className="text-indigo-400 w-8 h-8"/>}/>
            <StatCard onClick={() => setView('jobs')} label="Available Jobs" value={openJobsCount.toString()} icon={<Icons.Briefcase className="text-indigo-400 w-8 h-8"/>}/>
          </>
        )}
      </div>

      {!isAdmin && (
        <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between group hover:bg-indigo-900/20 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/30 group-hover:scale-105 transition-transform">
              <Icons.Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-0.5">Recent Payout Summary</p>
              <p className="text-sm font-bold text-slate-100">
                {lastSuccessfulPayout ? (
                  <>Last payout of <span className="text-emerald-400">{lastSuccessfulPayout.amount} Rs</span> on {new Date(lastSuccessfulPayout.createdAt).toLocaleDateString()}</>
                ) : (
                  <span className="text-slate-500 italic font-medium">No completed payouts recorded yet.</span>
                )}
              </p>
            </div>
          </div>
          <button onClick={() => setView('payout_history')} className="flex items-center gap-2 text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-indigo-950/40">
            View All <Icons.Check className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {!isAdmin && (
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 text-slate-100 flex items-center gap-2">
                <Icons.Briefcase className="w-5 h-5 text-indigo-400" /> Upcoming Events
              </h3>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.map(event => (
                    <div key={event.id} className="p-4 bg-slate-800/40 rounded-xl flex justify-between items-center border border-slate-700/50">
                      <div><p className="font-bold text-sm text-slate-100">{event.title}</p><p className="text-[11px] text-slate-400 font-medium mt-0.5">{formatDate(event.date)}</p></div>
                      <Badge status={event.status} variant="blue" />
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-10 border-2 border-dashed border-slate-800/50 rounded-2xl text-xs text-slate-500 italic">No upcoming events.</div>}
            </Card>
          )}
          {!isAdmin && (
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 text-slate-100 flex items-center gap-2">
                <Icons.Wallet className="w-5 h-5 text-indigo-400" /> Recent Activity
              </h3>
              {recentTransactions.length > 0 ? (
                <div className="space-y-2">
                  {recentTransactions.map(w => (
                    <div key={w.id} className="p-3 bg-slate-800/20 flex justify-between items-center rounded-lg border border-slate-700/30">
                      <div><p className="font-black text-emerald-400">{w.amount} Rs</p><p className="text-[10px] text-slate-500 font-bold mt-0.5">{new Date(w.createdAt).toLocaleDateString()}</p></div>
                      <Badge status={w.status} variant={w.status === WithdrawalStatus.APPROVED ? 'green' : w.status === WithdrawalStatus.PENDING ? 'yellow' : 'red'} />
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-10 border-2 border-dashed border-slate-800/50 rounded-2xl text-xs text-slate-500 italic">No recent payout activity.</div>}
            </Card>
          )}
        </div>
        {!isAdmin && (
          <Card className="p-6 flex flex-col items-center justify-center text-center" id="qr-upload-section">
            <h3 className="font-bold text-lg mb-6 text-slate-100">Payment Gateway</h3>
            {user.qrCode ? (
              <div className="relative group p-3 bg-white rounded-2xl shadow-inner">
                <img src={user.qrCode} className="w-48 h-48 object-contain rounded-lg shadow-2xl" alt="UPI QR" />
                <label className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-2xl cursor-pointer text-white backdrop-blur-[2px]">
                   <Icons.Plus className="w-8 h-8 mb-2" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Update QR</span>
                   <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onQrUpload(e.target.files[0])} />
                </label>
              </div>
            ) : (
              <div className="p-10 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-900/30 hover:bg-slate-900/50 transition-all cursor-pointer group flex flex-col items-center">
                <Icons.Wallet className="w-16 h-16 text-slate-700 mx-auto mb-4 group-hover:text-indigo-400 transition-colors" />
                <p className="text-sm text-slate-500 font-bold mb-6 tracking-tight">No UPI QR Linked</p>
                <label className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer hover:bg-indigo-500 shadow-xl shadow-indigo-950/50 transition-all active:scale-95">
                  LINK UPI QR <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onQrUpload(e.target.files[0])} />
                </label>
              </div>
            )}
            <p className="mt-6 text-[10px] text-slate-500 font-medium max-w-[200px]">Ensure your UPI QR is clear for seamless payments.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, onClick }: { label: string, value: string, icon: React.ReactNode, onClick?: () => void }) => (
  <Card onClick={onClick} className="flex items-center gap-5 group border-slate-800/60 hover:bg-slate-800/40">
    <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/50 group-hover:scale-110 transition-all shadow-lg">{icon}</div>
    <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-0.5 group-hover:text-indigo-400 transition-colors">{label}</p><p className="text-3xl font-black text-slate-100 tracking-tight">{value}</p></div>
  </Card>
);

const JobsView: React.FC<{ 
  user: User, 
  jobs: Job[], 
  enrollments: Enrollment[], 
  users: User[], 
  isAdmin: boolean, 
  onEnroll: (id: string) => void, 
  onCreate: (t: string, d: string, tm: string, l: string, p: number, m: number) => Promise<void>, 
  onUpdateJob: (id: string, u: Partial<Job>) => void, 
  onStatusUpdate: (id: string, s: JobStatus) => void, 
  onDelete: (id: string) => void, 
  isSubmitting: boolean,
  onAddEarnings: (userId: string, amount: number) => void,
  paidUserIds: Set<string>
}> = ({ user, jobs, enrollments, users, isAdmin, onEnroll, onCreate, onUpdateJob, onStatusUpdate, onDelete, isSubmitting, onAddEarnings, paidUserIds }) => {
  const [showForm, setShowForm] = useState<'create' | 'edit' | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [payWorker, setPayWorker] = useState<User | null>(null);
  const [payAmountInput, setPayAmountInput] = useState('');
  const visibleJobs = isAdmin ? jobs : jobs.filter(j => j.status !== JobStatus.COMPLETED);
  const handleConfirmPay = () => {
    if (!payWorker) return;
    const amount = Number(payAmountInput);
    if (!isNaN(amount) && amount > 0) {
      onAddEarnings(payWorker.id, amount);
      setPayWorker(null);
      setPayAmountInput('');
    } else {
      alert("Please enter a valid amount.");
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-black tracking-tight">Event Opportunities</h2>{isAdmin && <Button onClick={() => setShowForm('create')} variant="primary" disabled={isSubmitting} className="font-black text-xs uppercase px-6"><Icons.Plus className="w-5 h-5"/> NEW JOB</Button>}</div>
      {showForm && (
        <Card className="border-indigo-900/50 bg-indigo-950/20 p-6 animate-in slide-in-from-top duration-300">
          <form className="space-y-4" onSubmit={async (e) => { 
            e.preventDefault(); 
            const f = e.currentTarget; 
            const title = (f.elements.namedItem('title') as HTMLInputElement).value; 
            const date = (f.elements.namedItem('date') as HTMLInputElement).value; 
            const time = (f.elements.namedItem('time') as HTMLInputElement).value; 
            const loc = (f.elements.namedItem('location') as HTMLInputElement).value; 
            const pay = Number((f.elements.namedItem('pay') as HTMLInputElement).value); 
            const max = Number((f.elements.namedItem('max') as HTMLInputElement).value); 
            if (showForm === 'edit' && editingJob) onUpdateJob(editingJob.id, { title, date, time, location: loc, pay, maxWorkers: max }); 
            else await onCreate(title, date, time, loc, pay, max); 
            setShowForm(null); setEditingJob(null); 
          }}>
            <h3 className="font-black text-xl mb-4 tracking-tight">{showForm === 'edit' ? 'Edit Event' : 'Create New Event'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-full"><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Title</label><input name="title" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 outline-none" defaultValue={editingJob?.title} /></div>
              <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Date</label><input name="date" type="date" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 outline-none" defaultValue={editingJob?.date} /></div>
              <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Time Range</label><input name="time" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 outline-none" defaultValue={editingJob?.time} /></div>
              <div className="col-span-full"><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Location</label><input name="location" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 outline-none" defaultValue={editingJob?.location} /></div>
              <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Payment (Rs)</label><input name="pay" type="number" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 outline-none" defaultValue={editingJob?.pay} /></div>
              <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Max Staff</label><input name="max" type="number" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 outline-none" defaultValue={editingJob?.maxWorkers} /></div>
            </div>
            <div className="flex gap-3 justify-end pt-6"><Button variant="secondary" onClick={() => { setShowForm(null); setEditingJob(null); }}>Cancel</Button><Button type="submit" disabled={isSubmitting} className="font-black px-10">SAVE CHANGES</Button></div>
          </form>
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {visibleJobs.map(job => {
          const isEnrolled = enrollments.some(e => String(e.jobId) === String(job.id) && String(e.userId) === String(user.id));
          const jobEnrollments = enrollments.filter(e => String(e.jobId) === String(job.id));
          const actualCount = jobEnrollments.length;
          return (
            <Card key={job.id} className={`flex flex-col h-full border-t-4 ${job.status === JobStatus.COMPLETED ? 'border-t-slate-700' : 'border-t-indigo-600'}`}>
              <div className="flex justify-between items-start mb-5">
                <div className="flex-1"><h3 className="font-black text-xl truncate mb-1 text-slate-100 tracking-tight">{job.title}</h3><div className="flex items-center gap-2"><p className="text-xs text-indigo-400 font-bold opacity-80">{job.location}</p><button onClick={() => openGoogleMaps(job.location)} className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-black hover:bg-indigo-600 hover:text-white transition-colors uppercase tracking-widest">Map</button></div></div>
                <Badge status={job.status} variant={job.status === JobStatus.OPEN ? 'green' : job.status === JobStatus.CLOSED ? 'red' : 'gray'} />
              </div>
              <div className="grid grid-cols-2 gap-y-4 mb-6 bg-slate-800/40 p-5 rounded-2xl text-sm border border-slate-700/30">
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Date</div><div className="text-slate-100 font-bold">{formatDate(job.date)}</div>
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Payment</div><div className="text-emerald-400 font-black">{job.pay} Rs</div>
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Staff</div><div className="text-slate-100 font-black">{actualCount} / {job.maxWorkers}</div>
              </div>
              {isAdmin && (
                <div className="mb-5">
                  <button onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)} className="w-full text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-900/20 p-3 rounded-xl flex justify-between"><span>{expandedJobId === job.id ? 'Hide Staff' : 'View Staff'}</span><span>{actualCount} Staffs</span></button>
                  {expandedJobId === job.id && (
                    <div className="mt-3 bg-slate-900 rounded-xl p-3 max-h-48 overflow-y-auto border border-slate-700 divide-y divide-slate-800">
                      {jobEnrollments.map(en => {
                        const worker = users.find(u => u.id === en.userId);
                        const isPaid = worker ? paidUserIds.has(worker.id) : false;
                        return (
                          <div key={en.id} className="flex items-center gap-3 py-3">
                            <Avatar name={worker?.name || 'Staff'} size="w-8 h-8" className="text-[10px]" />
                            <div className="flex-1"><p className="text-xs font-black text-slate-200">{worker?.name || 'Unknown'}</p></div>
                            {isAdmin && worker && <Button variant={isPaid ? "secondary" : "primary"} disabled={isPaid} className="px-2 py-1 text-[9px] font-black uppercase" onClick={() => setPayWorker(worker)}>{isPaid ? 'PAID' : 'ADD PAY'}</Button>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-slate-800">
                {isAdmin ? (
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 text-[10px] font-black uppercase" onClick={() => { setEditingJob(job); setShowForm('edit'); }}>Edit</Button>
                    <Button variant="ghost" className="flex-1 text-[10px] font-black uppercase border border-slate-700" onClick={() => onStatusUpdate(job.id, job.status === JobStatus.OPEN ? JobStatus.CLOSED : JobStatus.OPEN)}>{job.status === JobStatus.OPEN ? 'Close' : 'Reopen'}</Button>
                    {job.status !== JobStatus.COMPLETED && <Button variant="success" className="text-[10px] font-black uppercase" onClick={() => onStatusUpdate(job.id, JobStatus.COMPLETED)}>Finish</Button>}
                    <Button variant="danger" className="p-2" onClick={() => onDelete(job.id)}><Icons.XMark className="w-5 h-5"/></Button>
                  </div>
                ) : (
                  <Button variant={isEnrolled ? "success" : "primary"} disabled={(!isEnrolled && (actualCount >= job.maxWorkers || job.status === JobStatus.CLOSED)) || isSubmitting || job.status === JobStatus.COMPLETED} onClick={() => isEnrolled ? null : onEnroll(job.id)} className="w-full font-black tracking-widest uppercase py-3">{isEnrolled ? (<><Icons.Check className="w-5 h-5"/> ENROLLED</>) : (actualCount >= job.maxWorkers || job.status === JobStatus.CLOSED) ? 'FULLY BOOKED' : job.status === JobStatus.COMPLETED ? 'EVENT FINISHED' : 'ENROLL NOW'}</Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {payWorker && (
        <Modal title={`Add Payment: ${payWorker.name}`} onClose={() => { setPayWorker(null); setPayAmountInput(''); }}>
          <div className="space-y-6">
            <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest ml-1">Payment Amount (Rs)</label><input type="number" autoFocus value={payAmountInput} onChange={(e) => setPayAmountInput(e.target.value)} placeholder="0.00" className="w-full px-5 py-4 bg-slate-800 border-2 border-slate-700 rounded-xl text-slate-100 font-black text-xl focus:border-indigo-500 outline-none" /></div>
            <div className="flex gap-3 pt-2"><Button variant="secondary" className="flex-1 font-bold" onClick={() => { setPayWorker(null); setPayAmountInput(''); }}>Cancel</Button><Button variant="primary" className="flex-1 font-black uppercase tracking-widest" onClick={handleConfirmPay}>Confirm Payment</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const MyEnrolledJobsView: React.FC<{ user: User, jobs: Job[], enrollments: Enrollment[], onCancelEnroll: (id: string) => void }> = ({ user, jobs, enrollments, onCancelEnroll }) => {
  const myEnrolledJobs = jobs.filter(job => enrollments.some(e => String(e.jobId) === String(job.id) && String(e.userId) === String(user.id)));
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black tracking-tight">My Enrollments</h2>
      {myEnrolledJobs.length === 0 ? <div className="py-24 text-center text-slate-600 font-bold uppercase tracking-[0.2em] opacity-40">No active enrollments.</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {myEnrolledJobs.map(job => (
            <Card key={job.id} className="flex flex-col h-full border-t-4 border-t-emerald-600">
              <h3 className="font-black text-xl mb-4 text-slate-100 tracking-tight">{job.title}</h3>
              <p className="text-emerald-400 font-black text-xl flex items-center gap-2 mb-6"><Icons.Wallet className="w-5 h-5 opacity-60"/> {job.pay} Rs</p>
              {job.status !== JobStatus.COMPLETED && <Button variant="danger" className="w-full mt-auto font-black uppercase py-3" onClick={() => onCancelEnroll(job.id)}>CANCEL ENROLLMENT</Button>}
              {job.status === JobStatus.COMPLETED && <div className="mt-auto py-3 text-center bg-slate-800 rounded-lg text-[10px] font-black uppercase text-slate-500 tracking-widest">Event Completed</div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const WalletView: React.FC<{ user: User, withdrawals: WithdrawalRequest[], onRequest: (a: number) => void, isSubmitting: boolean }> = ({ user, withdrawals, onRequest, isSubmitting }) => {
  const [amount, setAmount] = useState<string>('');
  const userWithdrawals = withdrawals.filter(w => String(w.userId) === String(user.id));

  return (
    <div className="space-y-8">
      <Card className="bg-gradient-to-br from-indigo-700 to-indigo-950 text-white p-10 relative overflow-hidden border-0 shadow-2xl">
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Available Balance</p>
          <p className="text-6xl font-black mb-10 tracking-tighter">{user.balance} Rs</p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md">
            <input 
              type="number" 
              placeholder="Enter Amount" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              className="bg-slate-950/40 border-2 border-indigo-400/30 rounded-xl px-5 py-4 text-white outline-none w-full font-black text-lg focus:border-indigo-400" 
            />
            <Button 
              variant="success" 
              onClick={() => { onRequest(Number(amount)); setAmount(''); }} 
              disabled={isSubmitting || !amount || Number(amount) <= 0 || Number(amount) > user.balance} 
              className="py-4 px-10 font-black uppercase"
            >
              WITHDRAW
            </Button>
          </div>
        </div>
        <Icons.Wallet className="absolute -right-10 -bottom-10 w-48 h-48 opacity-10 rotate-12" />
      </Card>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-lg text-slate-100 uppercase tracking-widest ml-1">Recent Activity</h3>
          <span className="text-[10px] font-black text-slate-500 uppercase">{userWithdrawals.length} Total</span>
        </div>
        
        {userWithdrawals.length > 0 ? (
          <Card className="p-0 overflow-hidden border-slate-800 divide-y divide-slate-800/50">
            {userWithdrawals.map(w => (
              <div key={w.id} className="p-5 flex justify-between items-center hover:bg-slate-800/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${w.status === WithdrawalStatus.APPROVED ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-500' : w.status === WithdrawalStatus.PENDING ? 'bg-amber-950/30 border-amber-500/30 text-amber-500' : 'bg-rose-950/30 border-rose-500/30 text-rose-500'}`}>
                    <Icons.Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-slate-200">Withdrawal Request</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">{new Date(w.createdAt).toLocaleDateString()} at {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-lg ${w.status === WithdrawalStatus.APPROVED ? 'text-emerald-400' : 'text-rose-500'}`}>-{w.amount} Rs</p>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${w.status === WithdrawalStatus.PENDING ? 'text-amber-500' : w.status === WithdrawalStatus.APPROVED ? 'text-emerald-500' : 'text-rose-500'}`}>{w.status}</p>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl">
            <Icons.Briefcase className="w-12 h-12 text-slate-700 mx-auto mb-3 opacity-20" />
            <p className="text-slate-600 font-bold uppercase tracking-widest text-xs italic">No payouts found.</p>
          </div>
        )}
      </section>
    </div>
  );
};

const PayoutHistoryView: React.FC<{ user: User, withdrawals: WithdrawalRequest[] }> = ({ user, withdrawals }) => {
  const [filter, setFilter] = useState<'ALL' | 'COMPLETED'>('ALL');
  const userWithdrawals = withdrawals.filter(w => String(w.userId) === String(user.id));
  const filteredWithdrawals = filter === 'COMPLETED' 
    ? userWithdrawals.filter(w => w.status === WithdrawalStatus.APPROVED)
    : userWithdrawals;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <h2 className="text-2xl font-black tracking-tight">Full Payout History</h2>
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-lg">
          <button 
            onClick={() => setFilter('ALL')}
            className={`px-5 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${filter === 'ALL' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/40' : 'text-slate-500 hover:text-slate-300'}`}
          >
            All Activity
          </button>
          <button 
            onClick={() => setFilter('COMPLETED')}
            className={`px-5 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${filter === 'COMPLETED' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-950/40' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Completed
          </button>
        </div>
      </div>

      {filteredWithdrawals.length > 0 ? (
        <Card className="p-0 overflow-hidden border-slate-800 divide-y divide-slate-800/50 shadow-2xl animate-in fade-in duration-300">
          {filteredWithdrawals.map(w => (
            <div key={w.id} className="p-6 flex justify-between items-center hover:bg-slate-800/10 transition-all group">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:rotate-6 ${w.status === WithdrawalStatus.APPROVED ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : w.status === WithdrawalStatus.PENDING ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                  <Icons.Wallet className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-black text-slate-100 text-base tracking-tight mb-1">
                    Withdrawal {w.status === WithdrawalStatus.APPROVED ? 'Processed' : 'Requested'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="opacity-50 tracking-tighter">ID:</span> {w.id.substring(0, 8).toUpperCase()}
                    <span className="w-1 h-1 bg-slate-700 rounded-full" />
                    {new Date(w.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black text-2xl mb-1 ${w.status === WithdrawalStatus.APPROVED ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {w.amount} Rs
                </p>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${w.status === WithdrawalStatus.APPROVED ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500' : w.status === WithdrawalStatus.PENDING ? 'bg-amber-500/5 border-amber-500/10 text-amber-500' : 'bg-rose-500/5 border-rose-500/10 text-rose-500'}`}>
                   {w.status === WithdrawalStatus.APPROVED && <Icons.Check className="w-3 h-3" />}
                   {w.status}
                </div>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <div className="py-32 text-center border-2 border-dashed border-slate-800/40 rounded-3xl animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-800 shadow-inner">
             <Icons.Wallet className="w-10 h-10 text-slate-700" />
          </div>
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm mb-2">No Records Found</p>
          <p className="text-slate-600 font-medium text-xs">You don't have any payout history for the selected filter.</p>
        </div>
      )}
    </div>
  );
};

const AdminPayoutHistoryView: React.FC<{ withdrawals: WithdrawalRequest[], users: User[] }> = ({ withdrawals, users }) => {
  const [filter, setFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  
  const filteredWithdrawals = filter === 'ALL' 
    ? withdrawals 
    : withdrawals.filter(w => w.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <h2 className="text-2xl font-black tracking-tight">All Payout History</h2>
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-lg overflow-x-auto max-w-full">
          {(['ALL', 'APPROVED', 'PENDING', 'REJECTED'] as const).map((f) => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all whitespace-nowrap ${filter === f ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Worker</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredWithdrawals.length > 0 ? filteredWithdrawals.map(w => {
                const u = users.find(usr => usr.id === w.userId);
                return (
                  <tr key={w.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={u?.name || '??'} size="w-8 h-8" className="text-[10px]" />
                        <div>
                          <p className="font-black text-slate-100 text-sm tracking-tight">{u?.name || 'Unknown'}</p>
                          <p className="text-[9px] text-slate-600 font-bold uppercase">{u?.phone || 'No Phone'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-black text-slate-200">{w.amount} Rs</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                        w.status === WithdrawalStatus.APPROVED ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50' : 
                        w.status === WithdrawalStatus.PENDING ? 'bg-amber-900/30 text-amber-400 border border-amber-800/50' : 
                        'bg-rose-900/30 text-rose-400 border border-rose-800/50'
                      }`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-[10px] text-slate-500 font-bold">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-slate-600 font-bold uppercase tracking-widest text-xs italic">
                    No payout records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const AdminUsers: React.FC<{ users: User[], onAddEarnings: (id: string, a: number) => void, jobs: Job[], enrollments: Enrollment[], paidUserIds: Set<string> }> = ({ users, onAddEarnings, jobs, enrollments, paidUserIds }) => {
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const workers = users
    .filter(u => u.role === UserRole.WORKER)
    .filter(u => (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-black tracking-tight">Staff Directory</h2>
        <div className="relative w-full sm:w-64">
          <Icons.Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search workers..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">A-Z Sorted</span>
        <div className="h-px flex-1 bg-slate-800"></div>
      </div>

      <Card className="p-0 overflow-hidden border-slate-800">
        <table className="w-full text-left">
          <thead className="bg-slate-900/80 border-b border-slate-800">
            <tr>
              <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Worker Name</th>
              <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {workers.length > 0 ? workers.map(u => (
              <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-5">
                  <div className="flex items-center gap-4">
                    <Avatar name={u.name || 'Worker'} size="w-10 h-10" />
                    <div>
                      <p className="font-black text-slate-100 text-sm">{u.name || 'Unnamed'}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-5 text-right">
                  <Button variant="secondary" className="px-4 py-1.5 text-[10px] font-black uppercase ml-auto" onClick={() => setHistoryUser(u)}>History</Button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-slate-500 font-bold uppercase tracking-widest text-xs italic">No matching workers found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {historyUser && (
        <Modal title={`History: ${historyUser.name}`} onClose={() => setHistoryUser(null)}>
          <div className="space-y-4">
            {enrollments.filter(e => e.userId === historyUser.id).length > 0 ? (
              enrollments.filter(e => e.userId === historyUser.id).map(en => {
                const job = jobs.find(j => j.id === en.jobId);
                return (
                  <div key={en.id} className="flex justify-between items-center p-4 border border-slate-800 rounded-xl bg-slate-800/20">
                    <div>
                      <p className="font-black text-slate-200 text-sm">{job?.title || 'Unknown Event'}</p>
                      <p className="text-[10px] text-slate-500 font-bold">{formatDate(job?.date || '')}</p>
                    </div>
                    <div className="text-right font-black text-emerald-400">{job?.pay || 0} Rs</div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-slate-500 py-10 font-bold uppercase text-xs">No enrollment history found.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

const AdminHistory: React.FC<{ enrollments: Enrollment[], users: User[], jobs: Job[] }> = ({ enrollments, users, jobs }) => (
    <div className="space-y-6"><h2 className="text-2xl font-black tracking-tight">Logs</h2><Card className="p-0 overflow-hidden border-slate-800"><table className="w-full text-left text-sm"><thead className="bg-slate-900/80 border-b border-slate-800"><tr><th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Worker</th><th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Event</th><th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Date</th></tr></thead><tbody className="divide-y divide-slate-800/50">{enrollments.slice().reverse().map(en => (<tr key={en.id} className="hover:bg-slate-800/30 transition-colors"><td className="px-5 py-5 font-bold text-slate-200">{users.find(u => u.id === en.userId)?.name || 'Unknown'}</td><td className="px-5 py-5 text-slate-400">{jobs.find(j => j.id === en.jobId)?.title || 'Deleted'}</td><td className="px-5 py-5 text-right text-[10px] text-slate-500 font-black uppercase">{new Date(en.enrolledAt).toLocaleDateString()}</td></tr>))}</tbody></table></Card></div>
);

const AdminWithdrawals: React.FC<{ withdrawals: WithdrawalRequest[], users: User[], onProcess: (id: string, app: boolean) => void }> = ({ withdrawals, users, onProcess }) => {
  const [approving, setApproving] = useState<WithdrawalRequest | null>(null);
  const pending = withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).reverse();
  return (
    <div className="space-y-6"><h2 className="text-2xl font-black tracking-tight">Payouts</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{pending.map(w => { const u = users.find(usr => usr.id === w.userId); return (<Card key={w.id} className="flex justify-between items-center border-l-4 border-l-amber-500 bg-slate-900/50"><div><p className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-1">{u?.name || 'Unknown'}</p><p className="text-2xl font-black text-slate-100">{w.amount} Rs</p></div><div className="text-right flex gap-2"><Button variant="ghost" className="text-rose-500 p-1" onClick={() => onProcess(w.id, false)}>Deny</Button><Button variant="success" className="px-4 py-2 text-[10px] font-black uppercase" onClick={() => setApproving(w)}>Review & Pay</Button></div></Card>); })}</div>{approving && (<Modal title="Verify Payout" onClose={() => setApproving(null)}><div className="flex flex-col items-center">{users.find(u => u.id === approving.userId)?.qrCode ? (<div className="bg-white p-4 rounded-2xl mb-8 shadow-2xl"><img src={users.find(u => u.id === approving.userId)?.qrCode} className="w-64 h-64 object-contain" alt="Worker Payment QR" /></div>) : (<div className="bg-rose-950/30 p-10 rounded-2xl mb-8 text-rose-500 text-center border border-rose-900/50"><Icons.XMark className="w-16 h-16 mx-auto mb-4 opacity-40" /><p className="font-black uppercase text-sm">No QR Code</p></div>)}<p className="text-center text-slate-400 mb-8 font-medium px-4">Process <strong className="text-emerald-400 text-xl block mt-2 font-black">{approving.amount} Rs</strong> via UPI before marking as paid.</p><div className="flex gap-3 w-full"><Button variant="secondary" className="flex-1 font-bold" onClick={() => setApproving(null)}>CANCEL</Button><Button variant="success" className="flex-1 font-black uppercase" onClick={() => { onProcess(approving.id, true); setApproving(null); }}>CONFIRM AS PAID</Button></div></div></Modal>)}</div>
  );
};

const ContactUsView: React.FC<{ user: User }> = ({ user }) => (
  <div className="space-y-6">
    <div className="text-center py-16 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-indigo-600 to-transparent"></div>
      <Icons.Users className="w-16 h-16 text-indigo-500 mx-auto mb-4 opacity-40" />
      <h2 className="text-2xl font-black mb-2 tracking-tight text-slate-100 uppercase">Direct Support</h2>
      <p className="text-slate-500 mb-10 max-w-sm mx-auto font-medium text-sm px-6">Having issues? Connect with our team directly for immediate assistance.</p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center px-8">
        <a href="mailto:crewmp54@gmail.com" className="bg-slate-800 text-slate-100 px-8 py-3 rounded-xl font-black uppercase text-[11px] border border-slate-700 hover:bg-slate-700 transition-all active:scale-95 shadow-lg">Email Support</a>
        <a href="https://wa.me/6282913521" target="_blank" rel="noopener noreferrer" className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[11px] hover:bg-emerald-500 transition-all active:scale-95 shadow-lg">WhatsApp Chat</a>
      </div>
    </div>

    <div className="p-10 bg-indigo-950/20 border-2 border-indigo-500/20 rounded-3xl text-center flex flex-col items-center group hover:bg-indigo-950/30 transition-all duration-500">
      <div className="w-16 h-16 bg-indigo-600/30 rounded-full flex items-center justify-center text-indigo-400 mb-6 border-2 border-indigo-500/20 group-hover:scale-110 transition-transform shadow-2xl">
         <Icons.Users className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-black text-indigo-300 uppercase tracking-widest mb-2">Join Worker Community</h3>
      <p className="text-slate-400 text-sm font-medium mb-8 max-w-[280px]">Get real-time updates on new jobs, event changes, and interact with other crew members.</p>
      <a 
        href="https://chat.whatsapp.com/BCAQOkUYBLL0dTNz5CbvUH?mode=gi_t" 
        target="_blank" 
        rel="noopener noreferrer"
        className="w-full max-w-xs bg-indigo-600 text-white font-black uppercase py-4 rounded-2xl tracking-[0.1em] text-xs hover:bg-indigo-500 transition-all active:scale-95 shadow-xl shadow-indigo-950/50 flex items-center justify-center gap-3"
      >
        Join our WhatsApp community <Icons.Plus className="w-4 h-4" />
      </a>
    </div>
  </div>
);
