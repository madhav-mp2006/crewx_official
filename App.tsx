
import React, { useState, useEffect, useRef } from 'react';
import { User, Job, Enrollment, WithdrawalRequest, UserRole, JobStatus, WithdrawalStatus } from './types';
import { db } from './db';
import { Icons, APP_NAME } from './constants';
import { supabase } from './supabase';

// --- Shared Components ---

const Avatar: React.FC<{ name: string; size?: string; className?: string; onClick?: () => void }> = ({ name, size = 'w-10 h-10', className = '', onClick }) => {
  const getInitials = (n: string = '') => {
    return n.split(' ').filter(Boolean).map(x => x[0]).join('').toUpperCase().substring(0, 2) || '??';
  };
  
  const colors = [
    'bg-indigo-100 text-indigo-700 border-indigo-200', 
    'bg-emerald-100 text-emerald-700 border-emerald-200', 
    'bg-amber-100 text-amber-700 border-amber-200', 
    'bg-rose-100 text-rose-700 border-rose-200', 
    'bg-sky-100 text-sky-700 border-sky-200'
  ];
  
  const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const colorClass = colors[Math.abs(hash) % colors.length];
  
  return (
    <div 
      onClick={onClick}
      className={`${size} rounded-full flex items-center justify-center font-bold border-2 shadow-sm uppercase ${colorClass} ${className} ${onClick ? 'cursor-pointer hover:brightness-95 active:scale-95 transition-all' : ''}`}>
       {getInitials(name)}
    </div>
  );
};

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  className?: string;
  disabled?: boolean;
}> = ({ children, onClick, type = 'button', variant = 'primary', className = '', disabled = false }) => {
  const base = "px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    danger: "bg-rose-500 text-white hover:bg-rose-600",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    ghost: "text-slate-600 hover:bg-slate-100"
  };
  return (
    <button type={type} onClick={(e) => { e.stopPropagation(); onClick?.(); }} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick} 
    className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 ${onClick ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all' : ''} ${className}`}
  >
    {children}
  </div>
);

const Badge: React.FC<{ status: string; variant?: 'green' | 'red' | 'gray' | 'blue' | 'yellow' }> = ({ status, variant = 'gray' }) => {
  const colors = {
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
    gray: "bg-slate-100 text-slate-700",
    blue: "bg-indigo-100 text-indigo-700",
    yellow: "bg-amber-100 text-amber-700"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${colors[variant as keyof typeof colors] || colors.gray}`}>
      {status}
    </span>
  );
};

const Modal: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <h3 className="font-bold text-slate-900">{title}</h3>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
          <Icons.XMark className="w-6 h-6" />
        </button>
      </div>
      <div className="p-6 max-h-[70vh] overflow-y-auto">
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

const formatViewName = (view: string) => {
  if (view === 'my_enrolled_jobs') return "My Enrolled Jobs";
  if (view === 'admin_users') return "Staff Directory";
  if (view === 'admin_requests') return "Payout Requests";
  if (view === 'admin_history') return "Enrollment History";
  if (view === 'dashboard') return "Dashboard Overview";
  return view.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// --- Shared Nav Component ---

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 transition-colors md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2 md:rounded-lg ${active ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'}`}>
      {icon}
      <span className="text-[10px] md:text-sm font-medium">{label}</span>
    </button>
  );
}

// --- Application Screens ---

type AppView = 'auth' | 'dashboard' | 'jobs' | 'wallet' | 'admin_users' | 'admin_requests' | 'admin_history' | 'contact' | 'my_enrolled_jobs';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>('auth');
  const [isSignup, setIsSignup] = useState(false);
  const [loginRole, setLoginRole] = useState<UserRole>(UserRole.WORKER);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQrWarning, setShowQrWarning] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [showEnrollConfirm, setShowEnrollConfirm] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Form States
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  
  // Custom Error States
  const [loginAccountError, setLoginAccountError] = useState(false);
  const [signupAccountError, setSignupAccountError] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);

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
        const currentStoredUser = JSON.parse(currentStoredUserString);
        const freshUser = u.find(usr => usr.id === currentStoredUser.id);
        if (freshUser) {
          setUser(freshUser);
          localStorage.setItem('crewx_user', JSON.stringify(freshUser));
        } else if (!silent) {
           handleLogout();
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
        const u = JSON.parse(stored);
        setUser(u);
        setView('dashboard');
      }
    };
    init();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => fetchData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogin = async (email: string, password?: string) => {
    setLoginAccountError(false);
    setIsSubmitting(true);
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      if (loginRole === UserRole.ADMIN) {
        if (!password) {
          alert('Admin password is required.');
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
              role: UserRole.ADMIN,
              balance: 0
            };
            await db.saveUser(adminProfile);
          }
          setUser(adminProfile); 
          localStorage.setItem('crewx_user', JSON.stringify(adminProfile));
          setView('dashboard'); 
          return;
        } else {
          alert('Invalid Admin credentials.'); 
          return;
        }
      }
      
      const found = await db.getUserByEmail(normalizedEmail);
      if (found && found.role === UserRole.WORKER) { 
        if (found.password === password) {
          setUser(found); 
          localStorage.setItem('crewx_user', JSON.stringify(found));
          setView('dashboard'); 
        } else {
          alert('Invalid password.');
        }
      } else { 
        setLoginAccountError(true);
      }
    } catch (e) {
      console.error(e);
      alert("Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (name: string, email: string, phone: string, password: string) => {
    setSignupAccountError(false);
    // Gmail Validation
    if (!email.toLowerCase().endsWith('@gmail.com')) return;
    // Phone Validation
    if (phone.length !== 10 || !/^\d+$/.test(phone)) return;
    // Password Validation
    if (password.length < 6) return;

    setIsSubmitting(true);
    try {
      const existing = await db.getUserByEmail(email);
      if (existing) {
        setSignupAccountError(true);
        setIsSubmitting(false);
        return;
      }
      const newUser: User = { 
        id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9), 
        name, 
        email: email.toLowerCase().trim(), 
        phone, 
        password,
        role: UserRole.WORKER, 
        balance: 0 
      };
      await db.saveUser(newUser);
      await fetchData();
      setUser(newUser);
      localStorage.setItem('crewx_user', JSON.stringify(newUser));
      setView('dashboard');
    } catch (err) {
      alert("Error during signup.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('crewx_user');
    setUser(null); 
    setView('auth'); 
    setShowLogoutConfirm(false);
    setShowProfileMenu(false);
    // Reset form states
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setAuthPhone('');
    setLoginAccountError(false);
    setSignupAccountError(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await db.deleteUser(user.id);
      handleLogout();
      setShowDeleteConfirm(false);
      alert("Your account has been deleted.");
    } catch (err) {
      console.error(err);
      alert("Error deleting account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQrUpload = async (file: File) => {
    if (!user) return;
    try {
        const base64 = await toBase64(file);
        await db.updateUser(user.id, { qrCode: base64 });
        await fetchData(true);
        alert("UPI QR Code updated!");
    } catch (e) { 
      alert("Error uploading QR Code."); 
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
    if (enrollments.some(e => e.jobId === jobId && e.userId === user.id)) return;

    setIsSubmitting(true);
    try {
      const newEnrollment: Enrollment = { 
        id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9), 
        userId: user.id, 
        jobId: jobId, 
        enrolledAt: new Date().toISOString() 
      };
      const newCount = job.enrolledCount + 1;
      const newStatus = newCount >= job.maxWorkers ? JobStatus.CLOSED : job.status;
      
      await db.saveEnrollment(newEnrollment);
      await db.updateJob(jobId, { enrolledCount: newCount, status: newStatus });
      await fetchData(true);
      setShowEnrollConfirm(null);
    } catch (err) {
      console.error(err);
      alert("Error during enrollment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelEnrollment = async (jobId: string) => {
    if (!user) return;
    setIsSubmitting(true);
    setEnrollments(prev => prev.filter(e => !(e.userId === user.id && e.jobId === jobId)));
    try {
      const job = jobs.find(j => j.id === jobId);
      await db.deleteEnrollmentByUserAndJob(user.id, jobId);
      if (job) {
        const newCount = Math.max(0, job.enrolledCount - 1);
        const newStatus = job.status === JobStatus.CLOSED ? JobStatus.OPEN : job.status;
        await db.updateJob(jobId, { enrolledCount: newCount, status: newStatus });
      }
      await fetchData(true);
      setShowCancelConfirm(null);
    } catch (err) {
      alert("Error cancelling enrollment.");
      await fetchData(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const createJob = async (title: string, date: string, time: string, location: string, pay: number, max: number) => {
    setIsSubmitting(true);
    try {
      const newJob: Job = { 
        id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9), 
        title, 
        date, 
        time, 
        location, 
        pay, 
        maxWorkers: max, 
        enrolledCount: 0, 
        status: JobStatus.OPEN 
      };
      await db.saveJob(newJob);
      await fetchData(true);
      alert("New event created!");

      // Automated Professional WhatsApp Notification - Text-only and Bolded as requested
      const whatsappMessage = `📢 *NEW EVENT POSTED* 📢

*EVENT:* ${title.toUpperCase()}
*DATE:* ${date}
*TIME:* ${time}
*LOCATION:* ${location.toUpperCase()}
*PAY:* INR ${pay}
*SLOTS:* ${max}

*VISIT OUR WEBSITE FOR ENROLLING*
🔗 https://crewxofficial.vercel.app/`;

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
      window.open(whatsappUrl, '_blank');

    } catch (err) { 
      alert("Error creating job."); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateJob = async (jobId: string, updates: Partial<Job>) => {
    try {
      await db.updateJob(jobId, updates);
      await fetchData(true);
    } catch (err) { 
      alert("Error updating job."); 
    }
  };

  const updateJobStatus = async (jobId: string, status: JobStatus) => {
    try {
      await db.updateJob(jobId, { status });
      await fetchData(true);
    } catch (err) { 
      alert("Error updating status."); 
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      await db.deleteEnrollmentsByJob(jobId);
      await db.deleteJob(jobId);
      await fetchData(true);
    } catch (err) { 
      alert("Error deleting job."); 
    }
  };

  const requestWithdrawal = async (amount: number) => {
    if (!user || amount > user.balance) return;
    setIsSubmitting(true);
    try {
      const request: WithdrawalRequest = { 
        id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9), 
        userId: user.id, 
        amount, 
        status: WithdrawalStatus.PENDING, 
        createdAt: new Date().toISOString() 
      };
      await db.saveWithdrawal(request);
      await fetchData(true);
      alert('Withdrawal request submitted.');
    } catch (err) { 
      alert("Error submitting request."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const processWithdrawal = async (id: string, approve: boolean) => {
    const request = withdrawals.find(w => w.id === id);
    if (!request) return;
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
    }
  };

  const addEarnings = async (userId: string, amount: number) => {
    const u = users.find(usr => usr.id === userId);
    if (!u) return;
    try {
      await db.updateUser(userId, { balance: u.balance + amount });
      await fetchData(true);
    } catch (err) { 
      alert("Error adding pay."); 
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Connecting to CrewX...</p>
        </div>
      </div>
    );
  }

  // Auth Form Validations
  const isEmailValid = authEmail.toLowerCase().endsWith('@gmail.com');
  const isPhoneValid = authPhone.length === 10;
  const isPasswordValid = authPassword.length >= 6;
  const isFormValid = isSignup 
    ? (authName.length > 0 && isEmailValid && isPhoneValid && isPasswordValid) 
    : (isEmailValid && isPasswordValid);

  if (view === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <Card className="max-w-md w-full p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-indigo-600 mb-2">{APP_NAME}</h1>
            <p className="text-slate-500">{isSignup ? 'Create worker profile' : 'Catering Staff Management'}</p>
          </div>
          {!isSignup && (
            <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
              <button onClick={() => setLoginRole(UserRole.WORKER)} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${loginRole === UserRole.WORKER ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Worker</button>
              <button onClick={() => setLoginRole(UserRole.ADMIN)} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${loginRole === UserRole.ADMIN ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Admin</button>
            </div>
          )}
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            if (isSignup) { 
              handleSignup(authName, authEmail, authPhone, authPassword); 
            } else { 
              handleLogin(authEmail, authPassword); 
            } 
          }}>
            <div className="space-y-4">
              {isSignup && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input 
                      value={authName} 
                      onChange={(e) => setAuthName(e.target.value)} 
                      type="text" 
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (10 digits)</label>
                    <input 
                      value={authPhone} 
                      onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                      type="tel" 
                      className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 ${authPhone.length > 0 && !isPhoneValid ? 'border-rose-600 focus:ring-rose-200' : 'border-slate-200 focus:ring-indigo-500'}`} 
                      required 
                    />
                    {authPhone.length > 0 && !isPhoneValid && (
                      <p className="text-[10px] text-rose-600 mt-1 font-semibold italic animate-in fade-in slide-in-from-top-1">Warning: Phone number must be exactly 10 digits.</p>
                    )}
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address (@gmail.com)</label>
                <input 
                  value={authEmail} 
                  onChange={(e) => { setAuthEmail(e.target.value); setLoginAccountError(false); setSignupAccountError(false); }} 
                  type="email" 
                  className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 ${authEmail.length > 0 && !isEmailValid ? 'border-rose-600 focus:ring-rose-200' : 'border-slate-200 focus:ring-indigo-500'}`} 
                  required 
                />
                {authEmail.length > 0 && !isEmailValid && (
                  <p className="text-[10px] text-rose-600 mt-1 font-semibold italic animate-in fade-in slide-in-from-top-1">Invalid Gmail address. Must end with @gmail.com</p>
                )}
                {!isSignup && loginAccountError && (
                  <p className="text-[10px] text-rose-600 mt-1 font-bold animate-in fade-in slide-in-from-top-1 uppercase tracking-wider">account doesn't exist</p>
                )}
                {isSignup && signupAccountError && (
                  <p className="text-[10px] text-rose-600 mt-1 font-bold animate-in fade-in slide-in-from-top-1 italic">account alreay exitested with this mail</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{loginRole === UserRole.ADMIN ? 'Admin Password' : 'Password (min. 6 chars)'}</label>
                <input 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  type="password" 
                  className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 ${authPassword.length > 0 && !isPasswordValid ? 'border-rose-600 focus:ring-rose-200' : 'border-slate-200 focus:ring-indigo-500'}`} 
                  required 
                />
                {authPassword.length > 0 && !isPasswordValid && (
                   <p className="text-[10px] text-rose-600 mt-1 font-semibold italic animate-in fade-in slide-in-from-top-1 text-right">minimum six chaecter is requiresd</p>
                )}
              </div>
              <Button type="submit" disabled={isSubmitting || !isFormValid} className="w-full py-3 text-lg">
                {isSubmitting ? 'Verifying...' : (isSignup ? 'Register' : 'Sign In')}
              </Button>
            </div>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => { setIsSignup(!isSignup); setLoginRole(UserRole.WORKER); setLoginAccountError(false); setSignupAccountError(false); }} className="text-indigo-600 font-medium hover:underline text-sm">
              {isSignup ? 'Already have an account? Sign In' : 'Need an account? Sign Up as Worker'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const isAdmin = user?.role === UserRole.ADMIN;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {showLogoutConfirm && (
        <Modal title="Logout Confirmation" onClose={() => setShowLogoutConfirm(false)}>
          <div className="text-center">
            <p className="text-slate-600 mb-6 font-medium">Are you sure you want to logout?</p>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setShowLogoutConfirm(false)}>No</Button>
              <Button variant="danger" className="flex-1" onClick={handleLogout}>Yes, Logout</Button>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteConfirm && (
        <Modal title="Delete Account" onClose={() => setShowDeleteConfirm(false)}>
          <div className="text-center">
            <div className="bg-rose-50 p-4 rounded-xl mb-6">
              <p className="text-rose-700 font-bold mb-2">Warning: Permanent Action</p>
              <p className="text-rose-600 text-sm italic">Deleting your account will remove your profile, enrollments, and payout history permanently. This cannot be undone.</p>
            </div>
            <p className="text-slate-900 mb-6 font-bold">Are you sure you want to delete your account?</p>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>No, Keep it</Button>
              <Button variant="danger" className="flex-1" onClick={handleDeleteAccount} disabled={isSubmitting}>
                {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showEnrollConfirm && (
        <Modal title="Confirm Enrollment" onClose={() => setShowEnrollConfirm(null)}>
          <div className="text-center">
            <p className="text-slate-600 mb-6 font-medium">Are you sure you want to enroll in this event?</p>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setShowEnrollConfirm(null)}>No</Button>
              <Button variant="primary" className="flex-1" onClick={() => { if(showEnrollConfirm) enrollInJob(showEnrollConfirm); }}>Yes</Button>
            </div>
          </div>
        </Modal>
      )}

      {showCancelConfirm && (
        <Modal title="Cancel Enrollment?" onClose={() => setShowCancelConfirm(null)}>
          <div className="text-center">
            <p className="text-slate-600 mb-6 font-medium">Are you sure you want to cancel?</p>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setShowCancelConfirm(null)}>No</Button>
              <Button variant="danger" className="flex-1" onClick={() => { if(showCancelConfirm) cancelEnrollment(showCancelConfirm); }}>Yes</Button>
            </div>
          </div>
        </Modal>
      )}

      {showQrWarning && (
        <Modal title="QR Code Required" onClose={() => setShowQrWarning(false)}>
          <div className="text-center flex flex-col items-center">
            <Icons.Wallet className="w-16 h-16 text-amber-500 mb-4" />
            <p className="text-slate-700 font-medium mb-6">Please upload your UPI QR code in the Home tab before enrolling.</p>
            <div className="flex gap-4 w-full">
               <Button variant="secondary" className="flex-1" onClick={() => setShowQrWarning(false)}>Back</Button>
               <Button variant="primary" className="flex-1" onClick={() => { setShowQrWarning(false); setView('dashboard'); }}>Go to Home</Button>
            </div>
          </div>
        </Modal>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:relative md:w-64 md:border-t-0 md:border-r z-50">
        <div className="flex flex-row justify-around p-2 md:flex-col md:justify-start md:h-screen md:p-4">
          <div className="hidden md:block mb-8 px-2">
            <h2 className="text-2xl font-bold text-indigo-600">{APP_NAME}</h2>
          </div>
          <div className="flex flex-row justify-around w-full md:flex-col md:gap-2">
            <NavButton icon={<Icons.Dashboard className="w-6 h-6"/>} label="Home" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
            <NavButton icon={<Icons.Briefcase className="w-6 h-6"/>} label="Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} />
            {!isAdmin ? (
                <>
                    <NavButton icon={<Icons.Wallet className="w-6 h-6"/>} label="Wallet" active={view === 'wallet'} onClick={() => setView('wallet')} />
                    <NavButton icon={<Icons.Check className="w-6 h-6"/>} label="Enrolled" active={view === 'my_enrolled_jobs'} onClick={() => setView('my_enrolled_jobs')} />
                    <NavButton icon={<Icons.Users className="w-6 h-6"/>} label="Contact" active={view === 'contact'} onClick={() => setView('contact')} />
                </>
            ) : (
                <>
                    <NavButton icon={<Icons.Users className="w-6 h-6"/>} label="Staff" active={view === 'admin_users'} onClick={() => setView('admin_users')} />
                    <NavButton icon={<Icons.Check className="w-6 h-6"/>} label="History" active={view === 'admin_history'} onClick={() => setView('admin_history')} />
                    <NavButton icon={<Icons.Plus className="w-6 h-6"/>} label="Payouts" active={view === 'admin_requests'} onClick={() => setView('admin_requests')} />
                </>
            )}
            <button onClick={() => setShowLogoutConfirm(true)} className="flex flex-col items-center justify-center p-2 text-slate-500 hover:text-rose-600 md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2 md:mt-auto md:rounded-lg">
              <Icons.Logout className="w-6 h-6"/><span className="text-[10px] md:text-sm font-medium">Exit</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 pb-24 md:pb-0 overflow-y-auto max-h-screen">
        <header className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-40">
          <h1 className="text-xl font-bold capitalize">{formatViewName(view)}</h1>
          <div className="flex items-center gap-3 relative" ref={profileMenuRef}>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold">{user?.name}</p>
              <p className="text-xs text-slate-500 uppercase tracking-tighter font-semibold">{user?.role}</p>
            </div>
            <Avatar name={user?.name || ''} onClick={() => setShowProfileMenu(!showProfileMenu)} />
            
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-[60] animate-in slide-in-from-top-2 duration-200">
                <div className="px-3 py-2 border-b mb-1">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account</p>
                </div>
                {!isAdmin && (
                  <button 
                    onClick={() => { setShowDeleteConfirm(true); setShowProfileMenu(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                  >
                    <Icons.XMark className="w-4 h-4" />
                    Delete account
                  </button>
                )}
              </div>
            )}
          </div>
        </header>
        <div className="p-6 max-w-5xl mx-auto">
          {view === 'dashboard' && <Dashboard user={user!} jobs={jobs} enrollments={enrollments} isAdmin={isAdmin} setView={setView} withdrawals={withdrawals} users={users} onQrUpload={handleQrUpload} />}
          {view === 'jobs' && <JobsView user={user!} jobs={jobs} enrollments={enrollments} users={users} isAdmin={isAdmin} onEnroll={(id) => setShowEnrollConfirm(id)} onCreate={createJob} onUpdateJob={updateJob} onStatusUpdate={updateJobStatus} onDelete={deleteJob} isSubmitting={isSubmitting} />}
          {view === 'my_enrolled_jobs' && <MyEnrolledJobsView user={user!} jobs={jobs} enrollments={enrollments} onCancelEnroll={(id) => setShowCancelConfirm(id)} />}
          {view === 'wallet' && <WalletView user={user!} withdrawals={withdrawals} onRequest={requestWithdrawal} isSubmitting={isSubmitting} />}
          {view === 'admin_users' && <AdminUsers users={users} jobs={jobs} enrollments={enrollments} onAddEarnings={addEarnings} />}
          {view === 'admin_history' && <AdminHistory enrollments={enrollments} users={users} jobs={jobs} />}
          {view === 'admin_requests' && <AdminWithdrawals withdrawals={withdrawals} users={users} onProcess={processWithdrawal} />}
          {view === 'contact' && <ContactUsView user={user!} />}
        </div>
      </main>
    </div>
  );
}

// --- Sub-Views ---

const Dashboard: React.FC<{ user: User, jobs: Job[], enrollments: Enrollment[], isAdmin: boolean, setView: (v: AppView) => void, withdrawals: WithdrawalRequest[], users: User[], onQrUpload: (f: File) => void }> = ({ user, jobs, enrollments, isAdmin, setView, withdrawals, users, onQrUpload }) => {
  const myEnrollments = enrollments.filter(e => e.userId === user.id);
  const openJobs = jobs.filter(j => j.status === JobStatus.OPEN);
  const totalWorkers = users.filter(u => u.role === UserRole.WORKER).length;
  const upcomingJobs = jobs.filter(j => j.status !== JobStatus.COMPLETED);

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <Card className="flex flex-col md:flex-row items-center gap-6 bg-indigo-50 border-indigo-100">
          <div className="w-32 h-32 bg-white rounded-xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden group">
            {user.qrCode ? <img src={user.qrCode} className="w-full h-full object-contain" /> : <Icons.Plus className="w-8 h-8 text-slate-300" />}
            <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer text-[10px] font-bold text-center p-2">
              <Icons.Plus className="w-5 h-5 mb-1" /> Update QR
              <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onQrUpload(e.target.files[0])} />
            </label>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-bold text-indigo-900">Your UPI QR CODE</h3>
            <p className="text-sm text-indigo-700/80 mb-4">Required for automated payouts.</p>
            <Button variant="ghost" className="text-indigo-600 h-auto p-0 text-xs font-bold" onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>
              {user.qrCode ? 'Change QR' : 'Click to Upload'}
            </Button>
          </div>
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isAdmin ? (
          <>
            <StatCard onClick={() => setView('admin_users')} label="Total Staff" value={totalWorkers.toString()} icon={<Icons.Users className="text-indigo-600 w-8 h-8"/>}/>
            <StatCard onClick={() => setView('jobs')} label="Open Jobs" value={openJobs.length.toString()} icon={<Icons.Briefcase className="text-indigo-600 w-8 h-8"/>}/>
            <StatCard onClick={() => setView('admin_requests')} label="Payouts" value={withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).length.toString()} icon={<Icons.Wallet className="text-rose-600 w-8 h-8"/>}/>
          </>
        ) : (
          <>
            <StatCard onClick={() => setView('wallet')} label="Balance" value={`INR ${user.balance}`} icon={<Icons.Wallet className="text-emerald-600 w-8 h-8"/>}/>
            <StatCard onClick={() => setView('my_enrolled_jobs')} label="My Enrollments" value={myEnrollments.length.toString()} icon={<Icons.Check className="text-indigo-600 w-8 h-8"/>}/>
            <StatCard onClick={() => setView('jobs')} label="Available" value={openJobs.length.toString()} icon={<Icons.Briefcase className="text-indigo-600 w-8 h-8"/>}/>
          </>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <div className="flex justify-between mb-4">
            <h3 className="font-bold text-lg">Upcoming Jobs</h3>
            <button onClick={() => setView('jobs')} className="text-indigo-600 text-sm font-semibold">View All</button>
          </div>
          <Card onClick={() => setView('jobs')} className="p-0 overflow-hidden divide-y cursor-pointer">
            {upcomingJobs.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm italic">No upcoming jobs.</div>
            ) : upcomingJobs.slice(0, 5).map(job => (
              <div key={job.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                <div className="bg-slate-100 p-2 rounded text-center min-w-[60px]">
                  <p className="text-[9px] uppercase font-bold text-slate-500">{new Date(job.date).toLocaleString('en-US', { month: 'short' })}</p>
                  <p className="text-lg font-black text-indigo-600 leading-none">{new Date(job.date).getDate()}</p>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm truncate">{job.title}</p>
                  <p className="text-[11px] text-slate-500">{job.location}</p>
                </div>
                <Badge status={job.status} variant={job.status === JobStatus.OPEN ? 'green' : job.status === JobStatus.CLOSED ? 'red' : 'gray'} />
              </div>
            ))}
          </Card>
        </section>
        <section>
          <div className="flex justify-between mb-4">
            <h3 className="font-bold text-lg">{isAdmin ? "Recent Requests" : "Recent Activity"}</h3>
            <button onClick={() => setView(isAdmin ? 'admin_requests' : 'wallet')} className="text-indigo-600 text-sm font-semibold">Manage</button>
          </div>
          <Card onClick={() => setView(isAdmin ? 'admin_requests' : 'wallet')} className="p-0 overflow-hidden divide-y cursor-pointer">
            {(isAdmin ? withdrawals : withdrawals.filter(w => w.userId === user.id)).length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm italic">No activity yet.</div>
            ) : (isAdmin ? withdrawals : withdrawals.filter(w => w.userId === user.id)).slice(0, 4).map(w => (
              <div key={w.id} className="p-4 flex justify-between">
                <div>
                  <p className="font-semibold text-sm">{isAdmin ? users.find(u => u.id === w.userId)?.name : "Withdrawal"}</p>
                  <p className="text-[10px] text-slate-500">{new Date(w.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">INR {w.amount}</p>
                  <p className={`text-[10px] font-bold uppercase ${w.status === WithdrawalStatus.PENDING ? 'text-amber-500' : w.status === WithdrawalStatus.REJECTED ? 'text-rose-600' : 'text-emerald-500'}`}>{w.status}</p>
                </div>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, onClick }: { label: string, value: string, icon: React.ReactNode, onClick?: () => void }) => (
  <Card onClick={onClick} className="flex items-center gap-4">
    <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
    <div><p className="text-xs font-semibold text-slate-500 uppercase">{label}</p><p className="text-2xl font-black">{value}</p></div>
  </Card>
);

const JobsView: React.FC<{ user: User, jobs: Job[], enrollments: Enrollment[], users: User[], isAdmin: boolean, onEnroll: (id: string) => void, onCreate: (t: string, d: string, tm: string, l: string, p: number, m: number) => Promise<void>, onUpdateJob: (id: string, u: Partial<Job>) => void, onStatusUpdate: (id: string, s: JobStatus) => void, onDelete: (id: string) => void, isSubmitting: boolean }> = ({ user, jobs, enrollments, users, isAdmin, onEnroll, onCreate, onUpdateJob, onStatusUpdate, onDelete, isSubmitting }) => {
  const [showForm, setShowForm] = useState<'create' | 'edit' | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  
  const [confirmStatusModal, setConfirmStatusModal] = useState<{ job: Job, targetStatus: JobStatus } | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<Job | null>(null);

  const visibleJobs = isAdmin ? jobs : jobs.filter(j => j.status !== JobStatus.COMPLETED);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Event Opportunities</h2>{isAdmin && <Button onClick={() => setShowForm('create')} variant="primary" disabled={isSubmitting}><Icons.Plus className="w-5 h-5"/> New Job</Button>}</div>
      
      {showForm && (
        <Card className="border-indigo-100 bg-indigo-50/30 p-6 animate-in slide-in-from-top duration-300">
          <form className="space-y-4" onSubmit={async (e) => { 
            e.preventDefault(); 
            const f = e.currentTarget; 
            const title = (f.elements.namedItem('title') as HTMLInputElement).value; 
            const date = (f.elements.namedItem('date') as HTMLInputElement).value; 
            const time = (f.elements.namedItem('time') as HTMLInputElement).value; 
            const loc = (f.elements.namedItem('location') as HTMLInputElement).value; 
            const pay = Number((f.elements.namedItem('pay') as HTMLInputElement).value); 
            const max = Number((f.elements.namedItem('max') as HTMLInputElement).value); 
            if (showForm === 'edit' && editingJob) { 
              onUpdateJob(editingJob.id, { title, date, time, location: loc, pay, maxWorkers: max }); 
            } else { 
              await onCreate(title, date, time, loc, pay, max); 
            } 
            setShowForm(null); 
            setEditingJob(null); 
          }}>
            <h3 className="font-bold text-lg mb-2">{showForm === 'edit' ? 'Edit Event' : 'Create New Event'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-full"><label className="block text-sm font-semibold mb-1">Event Title</label><input name="title" defaultValue={editingJob?.title} required className="w-full px-3 py-2 rounded border focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">Date</label><input name="date" type="date" defaultValue={editingJob?.date} required className="w-full px-3 py-2 rounded border" /></div>
              <div><label className="block text-sm font-semibold mb-1">Time</label><input name="time" defaultValue={editingJob?.time} required className="w-full px-3 py-2 rounded border" /></div>
              <div><label className="block text-sm font-semibold mb-1">Location</label><input name="location" defaultValue={editingJob?.location} required className="w-full px-3 py-2 rounded border" /></div>
              <div>
                <div className="flex gap-4">
                  <div className="flex-1"><label className="block text-sm font-semibold mb-1">Pay (INR)</label><input name="pay" type="number" defaultValue={editingJob?.pay} required className="w-full px-3 py-2 rounded border" /></div>
                  <div className="flex-1"><label className="block text-sm font-semibold mb-1">Max Staff</label><input name="max" type="number" defaultValue={editingJob?.maxWorkers} required className="w-full px-3 py-2 rounded border" /></div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4"><Button variant="secondary" onClick={() => { setShowForm(null); setEditingJob(null); }}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Job'}</Button></div>
          </form>
        </Card>
      )}

      {confirmStatusModal && (
        <Modal title="Confirm Action" onClose={() => setConfirmStatusModal(null)}>
          <div className="text-center">
            <p className="text-slate-600 mb-6 font-medium">Are you sure you want to change this event status to <span className="font-black text-indigo-600">{confirmStatusModal.targetStatus}</span>?</p>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmStatusModal(null)}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={() => { onStatusUpdate(confirmStatusModal.job.id, confirmStatusModal.targetStatus); setConfirmStatusModal(null); }}>Confirm</Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDeleteModal && (
        <Modal title="Confirm Deletion" onClose={() => setConfirmDeleteModal(null)}>
          <div className="text-center">
            <p className="text-slate-600 mb-6 font-medium">Delete <span className="font-bold">"{confirmDeleteModal.title}"</span> permanently? This cannot be undone.</p>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDeleteModal(null)}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={() => { onDelete(confirmDeleteModal.id); setConfirmDeleteModal(null); }}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {visibleJobs.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-400">
            <p className="font-medium">No active events.</p>
          </div>
        ) : visibleJobs.map(job => {
          const isEnrolled = enrollments.some(e => e.jobId === job.id && e.userId === user.id);
          const jobEnrollments = enrollments.filter(e => e.jobId === job.id);
          const isExpanded = expandedJobId === job.id;
          return (
            <Card key={job.id} className={`flex flex-col h-full border-t-4 transition-all ${job.status === JobStatus.COMPLETED ? 'border-t-slate-300 opacity-75' : 'border-t-indigo-500'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-bold text-lg truncate mb-1">{job.title}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-indigo-600 font-semibold">{job.location}</p>
                    <button onClick={() => openGoogleMaps(job.location)} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold">Map</button>
                  </div>
                </div>
                <Badge status={job.status} variant={job.status === JobStatus.OPEN ? 'green' : job.status === JobStatus.CLOSED ? 'red' : 'gray'} />
              </div>
              <div className="grid grid-cols-2 gap-y-4 mb-6 bg-slate-50 p-4 rounded-lg">
                <div className="text-xs text-slate-500 font-bold uppercase">Date</div><div className="text-sm text-slate-900">{job.date}</div>
                <div className="text-xs text-slate-500 font-bold uppercase">Time</div><div className="text-sm text-slate-900">{job.time}</div>
                <div className="text-xs text-slate-500 font-bold uppercase">Pay</div><div className="text-sm text-emerald-600 font-black">INR {job.pay}</div>
                <div className="text-xs text-slate-500 font-bold uppercase">Staff</div><div className="text-sm text-slate-900">{job.enrolledCount} / {job.maxWorkers}</div>
              </div>
              {isAdmin && (
                <div className="mb-4">
                  <button onClick={() => setExpandedJobId(isExpanded ? null : job.id)} className="w-full text-xs font-bold text-indigo-600 bg-indigo-50 p-2 rounded flex justify-between">
                    <span>{isExpanded ? 'Hide Staff' : 'View Staff'}</span><span>{jobEnrollments.length} workers</span>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 bg-slate-50 rounded p-2 max-h-40 overflow-y-auto border divide-y">
                      {jobEnrollments.length === 0 ? <p className="text-[10px] text-slate-400 p-2 italic">No enrollments.</p> : jobEnrollments.map(en => { 
                        const staff = users.find(u => u.id === en.userId); 
                        return staff && (
                          <div key={en.id} className="flex items-center gap-2 py-2">
                            <Avatar name={staff.name} size="w-6 h-6" className="text-[8px] border" />
                            <p className="text-[11px] font-bold truncate flex-1">{staff.name}</p>
                          </div>
                        ); 
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-auto pt-4 flex flex-col gap-2 border-t">
                {isAdmin ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button variant="secondary" className="flex-1" onClick={() => { setEditingJob(job); setShowForm('edit'); }} disabled={job.status === JobStatus.COMPLETED}>Edit</Button>
                      <Button variant="ghost" className="flex-1 border" onClick={() => setConfirmStatusModal({ job, targetStatus: job.status === JobStatus.OPEN ? JobStatus.CLOSED : JobStatus.OPEN })} disabled={job.status === JobStatus.COMPLETED}>{job.status === JobStatus.OPEN ? 'Close' : 'Open'}</Button>
                      <Button variant="danger" onClick={() => setConfirmDeleteModal(job)}><Icons.XMark className="w-5 h-5"/></Button>
                    </div>
                    {job.status !== JobStatus.COMPLETED && (
                      <Button variant="success" className="w-full text-xs" onClick={() => setConfirmStatusModal({ job, targetStatus: JobStatus.COMPLETED })}>Mark as Completed</Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button 
                      variant={isEnrolled ? "success" : "primary"} 
                      disabled={(!isEnrolled && job.status === JobStatus.CLOSED) || isSubmitting || job.status === JobStatus.COMPLETED} 
                      onClick={() => isEnrolled ? null : onEnroll(job.id)} 
                      className="w-full"
                    >
                      {isEnrolled ? (<><Icons.Check className="w-5 h-5"/> Enrolled</>) : job.status === JobStatus.CLOSED ? 'Unavailable' : job.status === JobStatus.COMPLETED ? 'Completed' : 'Enroll Now'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const MyEnrolledJobsView: React.FC<{ user: User, jobs: Job[], enrollments: Enrollment[], onCancelEnroll: (id: string) => void }> = ({ user, jobs, enrollments, onCancelEnroll }) => {
  const myEnrolledJobs = jobs.filter(job => enrollments.some(e => e.jobId === job.id && e.userId === user.id));
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">My Enrolled Jobs</h2>
      {myEnrolledJobs.length === 0 ? (
        <div className="py-20 text-center text-slate-400"><p className="font-medium">No current enrollments.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {myEnrolledJobs.map(job => (
            <Card key={job.id} className="flex flex-col h-full border-t-4 border-t-emerald-500">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1"><h3 className="font-bold text-lg mb-1">{job.title}</h3><p className="text-sm text-emerald-600 font-semibold">{job.location}</p></div>
                <Badge status={job.status} variant="green" />
              </div>
              <div className="grid grid-cols-2 gap-y-4 mb-6 bg-slate-50 p-4 rounded-lg">
                <div className="text-xs text-slate-500 font-bold uppercase">Date</div><div className="text-sm text-slate-900">{job.date}</div>
                <div className="text-xs text-slate-500 font-bold uppercase">Time</div><div className="text-sm text-slate-900">{job.time}</div>
                <div className="text-xs text-slate-500 font-bold uppercase">Pay</div><div className="text-sm text-emerald-600 font-black">INR {job.pay}</div>
              </div>
              {job.status !== JobStatus.COMPLETED && (
                <Button 
                  variant="danger" 
                  className="w-full mt-auto" 
                  onClick={() => onCancelEnroll(job.id)}
                >
                  Cancel Enrollment
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const WalletView: React.FC<{ user: User, withdrawals: WithdrawalRequest[], onRequest: (a: number) => void, isSubmitting: boolean }> = ({ user, withdrawals, onRequest, isSubmitting }) => {
  const [amount, setAmount] = useState<string>('');
  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-8 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-sm font-semibold opacity-80 mb-1">Available Balance</p>
          <p className="text-5xl font-black mb-6">INR {user.balance}</p>
          <div className="flex gap-4">
            <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-white/40 outline-none w-32" />
            <Button variant="success" onClick={() => { const val = Number(amount); if(val > 0 && val <= user.balance) { onRequest(val); setAmount(''); } else alert('Invalid amount.'); }} disabled={isSubmitting || !amount || Number(amount) <= 0 || Number(amount) > user.balance}>
              {isSubmitting ? '...' : 'Withdraw'}
            </Button>
          </div>
        </div>
        <Icons.Wallet className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10" />
      </Card>
      <section>
        <h3 className="font-bold text-lg mb-4">Payout History</h3>
        <Card className="divide-y p-0 overflow-hidden">
          {withdrawals.filter(w => w.userId === user.id).map(w => (
            <div key={w.id} className="p-4 flex justify-between">
              <div><p className="font-bold">Withdrawal</p><p className="text-xs text-slate-500">{new Date(w.createdAt).toLocaleString()}</p></div>
              <div className="text-right">
                <p className="font-black text-rose-500">-INR {w.amount}</p>
                <p className={`text-xs font-bold uppercase ${w.status === WithdrawalStatus.PENDING ? 'text-amber-500' : w.status === WithdrawalStatus.APPROVED ? 'text-emerald-500' : 'text-rose-600'}`}>{w.status}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
};

const AdminUsers: React.FC<{ users: User[], onAddEarnings: (id: string, a: number) => void, jobs: Job[], enrollments: Enrollment[] }> = ({ users, onAddEarnings, jobs, enrollments }) => {
  const [selectedUserForPay, setSelectedUserForPay] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [viewingQr, setViewingQr] = useState<string | null>(null);
  const workers = users.filter(u => u.role === UserRole.WORKER);
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Staff Directory</h2>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b"><tr><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Worker</th><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Actions</th></tr></thead>
          <tbody className="divide-y">
            {workers.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size="w-8 h-8" className="text-[10px]" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{u.name}</p>
                        {u.qrCode && <button onClick={() => setViewingQr(u.qrCode!)} className="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded">UPI QR</button>}
                      </div>
                      <p className="text-xs text-slate-500">Bal: INR {u.balance}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {selectedUserForPay === u.id ? (
                      <div className="flex items-center gap-2">
                        <input type="number" className="w-20 px-2 py-1 border rounded text-sm outline-none" onChange={(e) => setAmount(Number(e.target.value))} />
                        <Button variant="success" className="px-2 py-1 text-xs" onClick={() => { onAddEarnings(u.id, amount); setSelectedUserForPay(null); setAmount(0); }}>Add</Button>
                        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setSelectedUserForPay(null)}>X</Button>
                      </div>
                    ) : (
                      <><Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setHistoryUser(u)}>Jobs</Button><Button variant="primary" className="px-3 py-1 text-xs" onClick={() => setSelectedUserForPay(u.id)}>Pay</Button></>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {viewingQr && <Modal title="Staff UPI QR Code" onClose={() => setViewingQr(null)}><div className="flex justify-center"><img src={viewingQr} className="w-full max-w-xs object-contain rounded-xl" /></div></Modal>}
      {historyUser && (
        <Modal title={`History: ${historyUser.name}`} onClose={() => setHistoryUser(null)}>
          <div className="space-y-4">
            {enrollments.filter(e => e.userId === historyUser.id).map(en => { 
              const job = jobs.find(j => j.id === en.jobId); 
              return (
                <div key={en.id} className="flex justify-between p-3 border rounded-lg">
                  <div><p className="font-bold text-sm">{job?.title || 'Unknown Event'}</p><p className="text-xs text-slate-500">{job?.date || 'N/A'}</p></div>
                  <div className="text-right font-black text-emerald-600">INR {job?.pay || 0}</div>
                </div>
              ); 
            })}
          </div>
        </Modal>
      )}
    </div>
  );
};

const AdminHistory: React.FC<{ enrollments: Enrollment[], users: User[], jobs: Job[] }> = ({ enrollments, users, jobs }) => (
    <div className="space-y-6"><h2 className="text-2xl font-bold">Enrollment Logs</h2>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b"><tr><th className="px-4 py-3 font-bold text-slate-500 uppercase">Worker</th><th className="px-4 py-3 font-bold text-slate-500 uppercase">Event</th><th className="px-4 py-3 font-bold text-slate-500 uppercase text-right">Date</th></tr></thead>
          <tbody className="divide-y">
            {enrollments.slice().reverse().map(en => ( 
              <tr key={en.id} className="hover:bg-slate-50">
                <td className="px-4 py-4 font-medium">{users.find(u => u.id === en.userId)?.name || 'Worker'}</td>
                <td className="px-4 py-4">{jobs.find(j => j.id === en.jobId)?.title || 'Event'}</td>
                <td className="px-4 py-4 text-right text-xs text-slate-500">{new Date(en.enrolledAt).toLocaleDateString()}</td>
              </tr> 
            ))}
          </tbody>
        </table>
      </Card>
    </div>
);

const AdminWithdrawals: React.FC<{ withdrawals: WithdrawalRequest[], users: User[], onProcess: (id: string, app: boolean) => void }> = ({ withdrawals, users, onProcess }) => {
  const [approving, setApproving] = useState<WithdrawalRequest | null>(null);
  const pending = withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).reverse();
  const completed = withdrawals.filter(w => w.status !== WithdrawalStatus.PENDING).reverse();
  
  return (
    <div className="space-y-12">
      <section><h2 className="text-2xl font-bold mb-4">Pending Payouts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pending.length === 0 ? <p className="text-slate-500">No pending payouts.</p> : pending.map(w => { 
            const u = users.find(usr => usr.id === w.userId); 
            return ( 
              <Card key={w.id} className="flex justify-between items-center border-l-4 border-l-amber-500">
                <div className="flex items-center gap-3">
                   <Avatar name={u?.name || ''} size="w-10 h-10" />
                   <div><p className="font-bold text-sm">{u?.name}</p><p className="text-xs text-slate-500">Bal: INR {u?.balance}</p></div>
                </div>
                <div className="text-right flex flex-col items-end gap-2"><p className="text-xl font-black">INR {w.amount}</p><div className="flex gap-2"><Button variant="ghost" className="text-rose-600 p-1" onClick={() => onProcess(w.id, false)}>Deny</Button><Button variant="success" className="px-3 py-1 text-xs" onClick={() => setApproving(w)}>Verify QR</Button></div></div>
              </Card> 
            ); 
          })}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Completed Payment History</h2>
        <Card className="p-0 overflow-hidden divide-y">
          {completed.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic">No completed payouts yet.</div>
          ) : (
            completed.map(w => {
              const u = users.find(usr => usr.id === w.userId);
              return (
                <div key={w.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar name={u?.name || ''} size="w-10 h-10" />
                    <div>
                      <p className="font-bold text-sm">{u?.name}</p>
                      <p className="text-xs text-slate-500">{new Date(w.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">INR {w.amount}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${w.status === WithdrawalStatus.APPROVED ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {w.status}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>

      {approving && (
        <Modal title="Verify Payout QR" onClose={() => setApproving(null)}>
          <div className="flex flex-col items-center">
            {users.find(u => u.id === approving.userId)?.qrCode ? (
              <img src={users.find(u => u.id === approving.userId)?.qrCode} className="w-64 h-64 object-contain mb-6 shadow-lg border rounded-xl" />
            ) : (
              <div className="w-64 h-64 bg-slate-100 flex items-center justify-center rounded-xl mb-6 italic text-slate-400">No QR Code Provided</div>
            )}
            <p className="text-center text-slate-600 mb-6 text-sm">Please pay **INR {approving.amount}** via UPI before approving.</p>
            <div className="flex gap-2 w-full">
              <Button variant="secondary" className="flex-1" onClick={() => setApproving(null)}>Cancel</Button>
              <Button variant="success" className="flex-1" onClick={() => { onProcess(approving.id, true); setApproving(null); }}>Approve Payout</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const ContactUsView: React.FC<{ user: User }> = ({ user }) => {
  const whatsappNumber = "6282913521";
  const groupLink = "https://chat.whatsapp.com/Dd34dAkk6DoHjKixCBAf8H?mode=gi_t";
  const email = "crewmp54@gmail.com";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-slate-900 mb-2">Contact Us</h2>
        <p className="text-slate-500">Need assistance? Reach out to the CrewX team directly.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col items-center text-center p-8 border-t-4 border-t-indigo-500">
          <div className="bg-indigo-50 p-4 rounded-full mb-4 text-indigo-600">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
               <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
             </svg>
          </div>
          <h3 className="text-lg font-bold mb-1">Email Support</h3>
          <p className="text-sm text-slate-500 mb-6">{email}</p>
          <a 
            href={`mailto:${email}?subject=CrewX Support Request - ${user.name}`} 
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            Contact via Mail
          </a>
        </Card>

        <Card className="flex flex-col items-center text-center p-8 border-t-4 border-t-emerald-500">
          <div className="bg-emerald-50 p-4 rounded-full mb-4 text-emerald-600">
             <Icons.Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-1">Direct WhatsApp</h3>
          <p className="text-sm text-slate-500 mb-6">+{whatsappNumber}</p>
          <a 
            href={`https://wa.me/${whatsappNumber}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            Chat on WhatsApp
          </a>
        </Card>

        <Card className="md:col-span-2 flex flex-col md:flex-row items-center justify-between gap-6 p-8 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold mb-2">Join Our Community</h3>
            <p className="text-emerald-50 opacity-90">Stay updated with the latest event opportunities and team announcements in our official group.</p>
          </div>
          <a 
            href={groupLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white text-emerald-700 px-8 py-3 rounded-lg font-black shadow-lg hover:bg-emerald-50 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            Join WhatsApp Group
          </a>
        </Card>
      </div>
      
      <div className="pt-10 text-center opacity-50">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">© 2025 CrewX Management Systems</p>
      </div>
    </div>
  );
};
