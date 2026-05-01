import { useEffect, useMemo, useState, createContext, useContext, ReactNode, FormEvent } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, Shield, Users, Database, LayoutDashboard, Calendar, Layers, ShoppingCart, Package, DollarSign, Megaphone, Globe, Settings as SettingsIcon, Sun, Moon, Wrench } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { collection, onSnapshot } from '@/lib/dataApi';
import { AppUser, clearToken, getSetupStatus, login, logout, me, register, setupRestoreBackup, setupSuperadmin } from '@/lib/authApi';
import { Booking, Transaction, Court } from './types';

import { Clients } from './components/Clients';
import { ImprovedScheduling } from './components/ImprovedScheduling';
import { Finance } from './components/Finance';
import { Inventory } from './components/Inventory';
import { SettingsPanel } from './components/Settings';
import { Courts } from './components/Courts';
import { POS } from './components/POS';
import { PublicSite } from './components/PublicSite';
import { SiteManager } from './components/SiteManager';
import { NewsManager } from './components/NewsManager';
import { SuperadminUsers } from './components/SuperadminUsers';
import { SuperadminBackup } from './components/SuperadminBackup';
import { SuperadminSystem } from './components/SuperadminSystem';

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
  needsSetup: boolean;
  reloadSetupStatus: () => Promise<void>;
  loginUser: (email: string, password: string) => Promise<void>;
  registerUser: (name: string, email: string, password: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  setUser: (user: AppUser | null) => void;
};

type ThemeContextType = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);
const ThemeContext = createContext<ThemeContextType | null>(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode: () => setIsDarkMode((prev) => !prev) }}>
      {children}
    </ThemeContext.Provider>
  );
};

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const reloadSetupStatus = async () => {
    const status = await getSetupStatus();
    setNeedsSetup(status.needsSetup);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await reloadSetupStatus();
        const payload = await me();
        if (payload.user) {
          setUser(payload.user);
        } else {
          clearToken();
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const loginUser = async (email: string, password: string) => {
    const payload = await login({ email, password });
    setUser(payload.user);
    setNeedsSetup(false);
  };

  const registerUser = async (name: string, email: string, password: string) => {
    const payload = await register({ name, email, password });
    setUser(payload.user);
    setNeedsSetup(false);
  };

  const logoutUser = async () => {
    await logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, reloadSetupStatus, loginUser, registerUser, logoutUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

const SetupScreen = () => {
  const { reloadSetupStatus, setUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = await setupSuperadmin(form);
      setUser(payload.user);
      await reloadSetupStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no setup inicial.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (file: File) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const raw = await file.text();
      const backup = JSON.parse(raw);
      await setupRestoreBackup(backup);
      setMessage('Backup restaurado. Faça login com o usuário existente no backup.');
      await reloadSetupStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao restaurar backup no setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <form onSubmit={handleSetup} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 space-y-4">
          <h1 className="text-2xl font-black tracking-tight dark:text-white">Setup Inicial</h1>
          <p className="text-sm text-zinc-500">Nenhum superadmin encontrado. Crie o primeiro usuário superadmin.</p>
          <input required placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 dark:text-white" />
          <input type="email" required placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 dark:text-white" />
          <input type="password" required placeholder="Senha" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 dark:text-white" />
          <button disabled={loading} className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold">
            {loading ? 'Aguarde...' : 'Criar Superadmin'}
          </button>
        </form>

        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 space-y-4">
          <h2 className="text-xl font-black tracking-tight dark:text-white">Restaurar Backup no Setup</h2>
          <p className="text-sm text-zinc-500">Se já existe um backup do sistema, restaure antes de criar o superadmin.</p>
          <label className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-amber-100 text-amber-800 font-bold cursor-pointer">
            Selecionar backup JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleRestore(file);
              }}
            />
          </label>
          {message && <p className="text-emerald-600 text-sm">{message}</p>}
          {error && <p className="text-rose-500 text-sm">{error}</p>}
        </div>
      </div>
    </div>
  );
};

const LoginScreen = () => {
  const { loginUser, registerUser } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegistering) {
        await registerUser(form.name, form.email, form.password);
      } else {
        await loginUser(form.email, form.password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight dark:text-white">ArenaHub</h1>
          <p className="text-zinc-500 mt-2">{isRegistering ? 'Crie sua conta' : 'Entre para continuar'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <input
              required
              placeholder="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 dark:text-white"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 dark:text-white"
          />
          <input
            type="password"
            required
            placeholder="Senha"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 dark:text-white"
          />
          {error && <p className="text-rose-500 text-sm">{error}</p>}
          <button disabled={loading} className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold">
            {loading ? 'Aguarde...' : isRegistering ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        <button onClick={() => setIsRegistering((v) => !v)} className="w-full text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-bold uppercase tracking-widest">
          {isRegistering ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastrar'}
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);

  useEffect(() => {
    const unsubBookings = onSnapshot(collection({}, 'bookings'), (snapshot) => {
      setBookings(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Booking)));
    });
    const unsubTransactions = onSnapshot(collection({}, 'transactions'), (snapshot) => {
      setTransactions(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Transaction)));
    });
    const unsubCourts = onSnapshot(collection({}, 'courts'), (snapshot) => {
      setCourts(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Court)));
    });
    return () => {
      unsubBookings();
      unsubTransactions();
      unsubCourts();
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = bookings.filter((b) => b.startTime.startsWith(today) && b.status !== 'cancelled');
  const occupancy = courts.length > 0 ? Math.min(100, Math.round((todayBookings.length / (courts.length * 8)) * 100)) : 0;
  const revenue = transactions.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expenses = transactions.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const pending = bookings.reduce((acc, b) => acc + Math.max(0, b.totalPrice - b.paidAmount), 0);

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      byDay.set(key, 0);
    }
    bookings.forEach((b) => {
      const day = b.startTime.slice(0, 10);
      if (byDay.has(day)) {
        byDay.set(day, (byDay.get(day) || 0) + b.paidAmount);
      }
    });
    return Array.from(byDay.entries()).map(([day, value]) => ({
      name: day.slice(5),
      revenue: value,
    }));
  }, [bookings]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight dark:text-white">Dashboard</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">Dados reais do backend JSON.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ocupação Hoje', value: `${occupancy}%` },
          { label: 'Receita', value: `R$ ${revenue.toLocaleString('pt-BR')}` },
          { label: 'Despesas', value: `R$ ${expenses.toLocaleString('pt-BR')}` },
          { label: 'Pendências', value: `R$ ${pending.toLocaleString('pt-BR')}` },
        ].map((item) => (
          <div key={item.label} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-widest text-zinc-500">{item.label}</p>
            <h3 className="text-2xl font-black mt-2 dark:text-white">{item.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 h-[340px]">
        <h3 className="text-lg font-black mb-4 dark:text-white">Receita (últimos 7 dias)</h3>
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="realRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.2} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#realRevenue)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

type MenuItem = { icon: any; label: string; path: string };

const Sidebar = ({ isOpen, onClose, menuItems }: { isOpen: boolean; onClose: () => void; menuItems: MenuItem[] }) => {
  const location = useLocation();
  const { logoutUser, user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/50 z-40 lg:hidden" />
        )}
      </AnimatePresence>

      <aside className={cn('fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-900 transition-transform lg:relative lg:translate-x-0', isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black tracking-tight dark:text-white">ArenaHub</h2>
            <button onClick={onClose} className="lg:hidden text-zinc-500"><X size={20} /></button>
          </div>

          <nav className="space-y-1 flex-1">
            {menuItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={onClose} className={cn('flex items-center gap-3 px-4 py-3 rounded-xl font-semibold', active ? 'bg-zinc-100 dark:bg-zinc-900 dark:text-white' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/40')}>
                  <item.icon size={18} /> {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-zinc-100 dark:border-zinc-900 pt-4 space-y-3">
            <div className="text-xs text-zinc-500 uppercase tracking-widest">{user?.name} ({user?.role})</div>
            <div className="flex gap-2">
              <button onClick={toggleDarkMode} className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 dark:text-white">
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button onClick={logoutUser} className="flex-1 px-3 py-2 rounded-lg bg-rose-100 text-rose-700 font-bold flex items-center justify-center gap-2">
                <LogOut size={16} /> Sair
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

const NormalApp = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const menuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Calendar, label: 'Agendamentos', path: '/scheduling' },
    { icon: Layers, label: 'Quadras', path: '/courts' },
    { icon: Users, label: 'Clientes', path: '/clients' },
    { icon: ShoppingCart, label: 'PDV', path: '/pos' },
    { icon: Package, label: 'Estoque', path: '/inventory' },
    { icon: DollarSign, label: 'Financeiro', path: '/finance' },
    { icon: Megaphone, label: 'Notícias', path: '/news' },
    { icon: Globe, label: 'Site', path: '/site-manager' },
    { icon: SettingsIcon, label: 'Configurações', path: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} menuItems={menuItems} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden h-16 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-900 flex items-center px-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-500"><Menu size={24} /></button>
          <span className="ml-3 font-black dark:text-white">ArenaHub</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scheduling" element={<ImprovedScheduling />} />
            <Route path="/courts" element={<Courts />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/news" element={<NewsManager />} />
            <Route path="/site-manager" element={<SiteManager />} />
            <Route path="/settings" element={<SettingsPanel />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const SuperadminApp = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const menuItems: MenuItem[] = [
    { icon: Shield, label: 'Painel Superadmin', path: '/superadmin/users' },
    { icon: Database, label: 'Backup', path: '/superadmin/backup' },
    { icon: Wrench, label: 'Sistema', path: '/superadmin/system' },
  ];

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} menuItems={menuItems} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden h-16 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-900 flex items-center px-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-500"><Menu size={24} /></button>
          <span className="ml-3 font-black dark:text-white">Superadmin</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Routes>
            <Route path="/superadmin/users" element={<SuperadminUsers />} />
            <Route path="/superadmin/backup" element={<SuperadminBackup />} />
            <Route path="/superadmin/system" element={<SuperadminSystem />} />
            <Route path="*" element={<Navigate to="/superadmin/users" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { user, loading, needsSetup } = useAuth();
  const location = useLocation();

  if (location.pathname === '/site') {
    return <PublicSite />;
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (needsSetup) return <SetupScreen />;
  if (!user) return <LoginScreen />;

  if (user.role === 'superadmin') return <SuperadminApp />;
  return <NormalApp />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
