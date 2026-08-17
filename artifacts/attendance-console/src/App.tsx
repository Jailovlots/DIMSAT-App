import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowRight, BadgeCheck, BarChart3, Bell, CalendarDays, Camera, Check, CheckCircle2,
  ChevronDown, ClipboardCheck, Clock3, Download, Eye, EyeOff, FileUp, Filter, GraduationCap,
  LayoutDashboard, Loader2, LogOut, Menu, MoreHorizontal, MoreVertical, Moon, Pencil, Plus, Printer, QrCode,
  RefreshCw, RotateCcw, ScanLine, Search, Settings2, ShieldCheck, SlidersHorizontal, Sun, Trash2, User, UserCheck, UserPlus,
  Users, Volume2, X, Zap
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  useConfirmAttendance, useCreateEvent, useCreateOfficer, useGenerateEventQr, useGetDashboard,
  useGetSettings, useImportStudents, useListAttendance, useListEvents, useListOfficers,
  useListStudents, useScanAttendance, useUpdateSettings, getGetDashboardQueryKey,
  getGetSettingsQueryKey, getListAttendanceQueryKey, getListEventsQueryKey,
  getListOfficersQueryKey, getListStudentsQueryKey
} from '@workspace/api-client-react';
import type { AttendanceRecord, Event, EventInput, Officer, Settings, Student } from '@workspace/api-client-react';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Link, useLocation } from 'wouter';
import { useEffect, useMemo, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import jsQR from 'jsqr';

const queryClient = new QueryClient();

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/students', label: 'Students', icon: GraduationCap },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { href: '/scanner', label: 'Live scanner', icon: ScanLine },
  { href: '/officers', label: 'Officers', icon: Users },
];

function Logo({ dark = false, size = 'md' }: { dark?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const containerSize = size === 'lg' ? 'size-12' : size === 'sm' ? 'size-8' : 'size-10';
  const titleSize = size === 'lg' ? 'text-xl font-black' : size === 'sm' ? 'text-sm font-bold' : 'text-[16px] font-extrabold';
  const subSize = size === 'lg' ? 'text-[11px] tracking-[0.16em]' : size === 'sm' ? 'text-[8px] tracking-[0.12em]' : 'text-[9.5px] tracking-[0.14em]';
  const gap = size === 'lg' ? 'gap-3.5' : 'gap-2.5';

  return (
    <div className={`flex items-center ${gap}`} data-testid="brand-attenda">
      <div className={`rounded-full bg-white p-1 shadow-md border border-white/20 flex items-center justify-center overflow-hidden shrink-0 ${containerSize}`}>
        <img
          src="/zdspgc-logo.png"
          alt="ZDSPGC seal"
          className="size-full object-contain rounded-full"
        />
      </div>
      <div>
        <div className={`${titleSize} tracking-[-0.03em] ${dark ? 'text-white' : 'text-foreground'}`}>
          <span className="text-[#ffb703]">Attend</span>Wise
        </div>
        <div className={`font-mono ${subSize} uppercase ${dark ? 'text-slate-300 font-semibold' : 'text-muted-foreground'}`}>
          ZDSPGC Attendance System
        </div>
      </div>
    </div>
  );
}

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'outline' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:brightness-105 shadow-[0_3px_0_hsl(166_78%_24%)]',
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    soft: 'bg-accent/12 text-accent-foreground hover:bg-accent/20',
    outline: 'border border-border bg-card hover:border-primary/45 hover:bg-muted',
    danger: 'bg-destructive text-destructive-foreground hover:brightness-105',
  };
  return <button className={`font-arial inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-bold transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'teal' }) {
  const style = { neutral: 'bg-muted text-muted-foreground', success: 'bg-emerald-500/12 text-emerald-700', warning: 'bg-amber-500/15 text-amber-700', danger: 'bg-red-500/12 text-red-700', teal: 'bg-primary/12 text-primary' }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[.04em] ${style}`}>{children}</span>;
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === 'password';
  return (
    <label className="grid gap-1.5 text-[11px] font-bold text-muted-foreground">
      <span>{label}</span>
      <div className="relative flex items-center">
        <input
          data-testid={`input-${label.toLowerCase().replaceAll(' ', '-')}`}
          type={isPassword && !showPwd ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary focus:ring-2 focus:ring-primary/15 ${isPassword ? 'pr-10' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPwd(v => !v)}
            className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPwd ? 'Hide password' : 'Show password'}
          >
            {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </label>
  );
}

const navAccents: Record<string, string> = {
  '/dashboard': 'text-[#4ade80]',
  '/students': 'text-[#38bdf8]',
  '/events': 'text-[#a78bfa]',
  '/attendance': 'text-[#fb923c]',
  '/scanner': 'text-[#f472b6]',
  '/officers': 'text-[#facc15]',
};

type StaffUser = {
  id: number;
  officerId?: string;
  fullName: string;
  email: string;
  role: 'super_admin' | 'officer' | 'student';
};

function getStoredStaffUser(): StaffUser {
  try {
    const raw = localStorage.getItem('dimsat_user');
    if (raw) {
      const parsed = JSON.parse(raw) as StaffUser;
      if (parsed.fullName === 'System Admin' || parsed.fullName === 'System') {
        parsed.fullName = 'Admin';
        localStorage.setItem('dimsat_user', JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch {
    // Fallback
  }
  return { id: 0, fullName: 'Admin', email: 'admin@zdspgc.edu.ph', role: 'super_admin' };
}

function useGreeting() {
  const [greeting, setGreeting] = useState(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 21) return 'Good evening';
    return 'Good night';
  });
  useEffect(() => {
    const update = () => {
      const h = new Date().getHours();
      if (h >= 5 && h < 12) setGreeting('Good morning');
      else if (h >= 12 && h < 17) setGreeting('Good afternoon');
      else if (h >= 17 && h < 21) setGreeting('Good evening');
      else setGreeting('Good night');
    };
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);
  return greeting;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(getStoredStaffUser);

  useEffect(() => {
    const syncUser = () => setUser(getStoredStaffUser());
    window.addEventListener('storage', syncUser);
    return () => window.removeEventListener('storage', syncUser);
  }, []);

  const isOfficer = user.role === 'officer';
  const isStudent = user.role === 'student';

  // Guard restricted pages for Officer / Student roles
  useEffect(() => {
    if (isOfficer && ['/students', '/officers', '/settings'].includes(location)) {
      setLocation('/dashboard');
    } else if (isStudent && ['/officers', '/settings'].includes(location)) {
      setLocation('/dashboard');
    }
  }, [isOfficer, isStudent, location, setLocation]);

  // Filter navigation links based on active role
  const visibleNav = nav.filter((item) => {
    if (isOfficer || isStudent) {
      return ['/dashboard', '/events', '/attendance', '/scanner'].includes(item.href);
    }
    return true;
  });

  const initials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col sidebar-bg px-3.5 py-4 text-sidebar-foreground transition-transform md:translate-x-0 overflow-y-auto ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Colorful top accent strip */}
        <div className="absolute inset-x-0 top-0 h-[4px] rounded-t-none" style={{ background: 'linear-gradient(90deg, #4ade80, #38bdf8, #a78bfa, #fb923c, #f472b6)' }} />
        {/* Subtle radial glow behind logo */}
        <div className="absolute left-4 top-4 size-24 rounded-full bg-[#4ade80]/10 blur-2xl pointer-events-none" />

        <div className="mb-4 px-1.5 relative"><Logo dark size="md" /></div>
        <div className="px-2 pb-1.5 font-mono text-[11px] font-bold uppercase tracking-[.18em] text-slate-300">Workspace</div>
        <nav className="grid gap-1">
          {visibleNav.map(item => {
            const Icon = item.icon;
            const active = location === item.href;
            const iconColor = navAccents[item.href] ?? 'text-slate-300';
            return (
              <Link
                data-testid={`link-${item.label.toLowerCase().replaceAll(' ', '-')}`}
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-bold transition-all duration-150
                  ${active
                    ? 'bg-sidebar-accent text-white nav-item-active-glow'
                    : 'text-slate-100 hover:bg-sidebar-accent/60 hover:text-white'}`}
              >
                {/* Active left accent line */}
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-sidebar-primary shadow-[0_0_8px_#4ade80]" />}
                <Icon className={`size-[18px] shrink-0 transition-colors ${active ? iconColor : `${iconColor} opacity-90 group-hover:opacity-100`}`} />
                <span>{item.label}</span>
                {item.href === '/scanner' && <span className="ml-auto size-2 rounded-full bg-[#f472b6] shadow-[0_0_6px_#f472b6]" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-2 grid gap-1">
          {!isOfficer && !isStudent && (
            <Link data-testid="link-settings" href="/settings" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-bold transition-all ${location === '/settings' ? 'bg-sidebar-accent text-white nav-item-active-glow' : 'text-slate-100 hover:bg-sidebar-accent/60 hover:text-white'}`}>
              <Settings2 className={`size-[18px] shrink-0 ${location === '/settings' ? 'text-[#38bdf8]' : 'text-[#38bdf8] opacity-90 group-hover:opacity-100'}`} />Setting
            </Link>
          )}
          <div className="mt-2 border-t border-slate-700/60 pt-2.5">
            <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-sidebar-accent/50 transition-colors cursor-default">
              <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#4ade80]/30 to-[#38bdf8]/30 font-mono text-[11px] font-extrabold text-[#4ade80] ring-1 ring-[#4ade80]/40">{initials}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-white">{user.fullName}</div>
                <div className="font-mono text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                  {user.role === 'super_admin' ? 'SUPER ADMIN' : user.role === 'officer' ? 'OFFICER' : 'STUDENT'}
                </div>
              </div>
              <ChevronDown className="ml-auto size-3.5 text-slate-400" />
            </div>
            <button
              data-testid="button-sign-out"
              onClick={() => {
                localStorage.removeItem('dimsat_user');
                window.dispatchEvent(new Event('storage'));
                setLocation('/');
              }}
              className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-200 hover:bg-red-500/20 hover:text-red-300 transition-all"
            >
              <LogOut className="size-4 text-red-400" />Sign out
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close menu" data-testid="button-close-menu" className="fixed inset-0 z-30 bg-sidebar/40 md:hidden" onClick={() => setMobileOpen(false)} />}
      <main className="md:pl-[250px]">
        <AppHeader location={location} onOpenMobile={() => setMobileOpen(true)} />
        <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-7 md:py-6">{children}</div>
      </main>
    </div>
  );
}


function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div className="rise-in">
        <div className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[.18em] text-primary">{eyebrow}</div>
        <h1 className="text-[22px] font-extrabold tracking-[-.05em] text-foreground md:text-[26px]">{title}</h1>
        <p className="mt-1 max-w-xl text-[12px] leading-5 text-muted-foreground">{description}</p>
      </div>
      {action && <div className="rise-in delay-1">{action}</div>}
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon, accent = 'teal' }: { label: string; value: string | number; detail: string; icon: React.ElementType; accent?: 'teal' | 'orange' | 'ink' }) {
  const colors = { teal: 'bg-primary/10 text-primary', orange: 'bg-accent/15 text-accent', ink: 'bg-foreground/8 text-foreground' };
  return (
    <div className="rise-in rounded-xl border border-card-border bg-card p-5 shadow-[0_8px_24px_hsl(188_38%_16%/.04)]">
      <div className="flex items-start justify-between">
        <div className={`grid size-9 place-items-center rounded-lg ${colors[accent]}`}><Icon className="size-[17px]" /></div>
        <span className="font-mono text-[10px] text-muted-foreground">LIVE</span>
      </div>
      <div className="mt-5 text-[29px] font-extrabold tracking-[-.06em]">{value}</div>
      <div className="mt-0.5 text-[12px] font-bold">{label}</div>
      <div className="mt-2 font-mono text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function Loading({ rows = 4 }: { rows?: number }) { return <div className="grid gap-3">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>; }
function ErrorState({ retry }: { retry: () => void }) { return <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-10 text-center"><X className="mx-auto size-7 text-destructive" /><h3 className="mt-3 font-bold">Could not load this view</h3><p className="mt-1 text-sm text-muted-foreground">The service did not respond. Try the request again.</p><Button variant="outline" className="mt-5" onClick={retry}><RefreshCw className="size-3.5" />Retry</Button></div>; }
function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) { return <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center"><div className="mx-auto grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground"><SlidersHorizontal className="size-5" /></div><h3 className="mt-4 font-bold">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>{action && <div className="mt-5">{action}</div>}</div>; }

function Landing() {
  const [, setLocation] = useLocation();
  return (
    <div
      className="relative flex h-[100dvh] w-full flex-col justify-between overflow-hidden bg-cover bg-center bg-no-repeat text-white"
      style={{ backgroundImage: "url('/zdspgc-campus.jpg')" }}
    >
      {/* Semi-transparent overlay — keeps text readable while letting campus photo show clearly */}
      <div className="absolute inset-0 bg-[#091530]/75" />

      {/* Top Navbar */}
      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <Logo dark size="lg" />
        <button
          data-testid="button-landing-sign-in"
          onClick={() => setLocation('/sign-in')}
          className="rounded-xl bg-[#ffb703] hover:bg-[#ffa000] text-[#08132b] px-6 py-2 text-[14px] font-black shadow-md transition-transform hover:scale-105"
        >
          Sign In
        </button>
      </nav>

      {/* Main Hero Section — Centered vertically */}
      <main className="relative z-10 mx-auto my-auto flex w-full max-w-7xl flex-col justify-center px-6 py-4 md:px-10">
        <div className="rise-in max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ffb703]/50 bg-[#ffb703]/10 px-3.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[.15em] text-[#ffb703] backdrop-blur-md md:text-[11px]">
            <QrCode className="size-3.5 text-[#ffb703]" /> QR-Powered Attendance System
          </div>
          <h1 className="font-['Playfair_Display',Georgia,serif] text-3xl font-black leading-[1.1] text-white sm:text-4xl md:text-5xl lg:text-6xl">
            Smart Attendance for BSIS<br />
            <span className="text-[#ffb703]">ZDSPGC-Dimataling Campus</span>
          </h1>
          <p className="mt-4 max-w-xl text-xs sm:text-sm md:text-base leading-relaxed text-slate-200/90 font-medium">
            A secure, modern attendance monitoring system using encrypted QR codes. Track attendance in real-time with interactive dashboards and automated reports.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              data-testid="button-hero-sign-in"
              onClick={() => setLocation('/sign-in')}
              className="rounded-xl bg-[#ffb703] hover:bg-[#ffa000] text-[#08132b] px-7 py-3 text-[14px] font-black shadow-xl transition-all hover:-translate-y-0.5"
            >
              Sign In to Console
            </button>
          </div>
        </div>
      </main>

      {/* Footer Branding Bar */}
      <footer className="relative z-10 border-t border-white/10 bg-black/20 backdrop-blur-sm px-6 py-3 text-center font-mono text-[11px] text-slate-300">
        Zamboanga del Sur Provincial Government College — Dimataling Campus Attendance Portal
      </footer>
    </div>
  );
}

function SignIn() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('admin@attenda.edu');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json() as { error?: string; user?: StaffUser };
      setLoading(false);

      if (!res.ok || !data.user) {
        // Fallback for demo/offline
        if (email.toLowerCase().includes('admin') || email.toLowerCase().includes('attenda')) {
          const defaultAdmin: StaffUser = { id: 0, fullName: 'Admin', email: email.trim(), role: 'super_admin' };
          localStorage.setItem('dimsat_user', JSON.stringify(defaultAdmin));
          setLocation('/dashboard');
          return;
        }
        setError(data.error || 'Invalid work email or password.');
        return;
      }

      localStorage.setItem('dimsat_user', JSON.stringify(data.user));
      setLocation('/dashboard');
    } catch {
      setLoading(false);
      // Offline fallback
      const fallbackUser: StaffUser = {
        id: 0,
        fullName: email.split('@')[0].replace('.', ' '),
        email: email.trim(),
        role: email.toLowerCase().includes('officer') ? 'officer' : 'super_admin',
      };
      localStorage.setItem('dimsat_user', JSON.stringify(fallbackUser));
      setLocation('/dashboard');
    }
  };

  return (
    <div className="grid h-[100dvh] w-full overflow-hidden md:grid-cols-[1fr_1fr]">
      <div className="relative hidden bg-sidebar p-8 text-white md:flex md:flex-col overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('/zdspgc-campus.jpg')" }}>
        {/* Dark overlay — lets campus photo show while keeping text crisp */}
        <div className="absolute inset-0 bg-[#071020]/75" />
        <div className="relative z-10 flex flex-col h-full justify-between">
          <Logo dark size="lg" />
          <div className="my-auto max-w-md">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[.2em] text-[#ffb703] drop-shadow-md">
              Staff access / ZDSPGC
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-.05em] text-white drop-shadow-lg lg:text-5xl">
              A calmer way<br />to keep count.
            </h1>
            <p className="mt-4 text-xs lg:text-sm leading-6 text-white/80">
              Private tools for school administrators and attendance officers.
            </p>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[.16em] text-white/40">
            ZDSPGC Dimataling Campus · DIMSAT Console
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-6 overflow-y-auto">
        <div className="w-full max-w-[380px] rise-in">
          <div className="md:hidden"><Logo /></div>
          <div className="mt-8 md:mt-0">
            <div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Welcome back</div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-.05em] sm:text-3xl">Sign in to DIMSAT</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Use your school staff identity to continue.</p>
            <form onSubmit={handleSubmit} className="mt-6 grid gap-3.5">
              <Field label="Work email" value={email} onChange={setEmail} placeholder="name@school.edu" />
              <Field label="Password" value={password} onChange={setPassword} placeholder="Enter your password" type="password" />
              {error && <div className="text-xs font-semibold text-red-500">{error}</div>}
              <Button type="submit" disabled={loading} data-testid="button-submit-sign-in" className="mt-1 h-10 w-full text-xs">
                {loading ? 'Signing in…' : 'Continue'} <ArrowRight className="size-3.5" />
              </Button>
            </form>
            <div className="my-7 flex items-center gap-3 text-[10px] text-muted-foreground">
              <div className="h-px flex-1 bg-border" />SECURE STAFF ACCESS<div className="h-px flex-1 bg-border" />
            </div>
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 text-primary shrink-0" />
                <div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentQrPassModal({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const qrData = JSON.stringify({
    studentId: user.officerId || '2026-00892',
    name: user.fullName,
    role: user.role,
    verified: true,
    issuedAt: new Date().toISOString().split('T')[0]
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl rise-in">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close QR Modal"
        >
          <X className="size-4" />
        </button>

        {/* Card Header with School Logo */}
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="size-10 rounded-full bg-white p-0.5 shadow border border-border flex items-center justify-center shrink-0">
            <img src="/zdspgc-logo.png" alt="ZDSPGC Logo" className="size-full object-contain rounded-full" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-bold text-primary uppercase tracking-wider">ZDSPGC Dimataling</div>
            <div className="text-sm font-black text-foreground">Digital Attendance Pass</div>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="my-5 flex flex-col items-center justify-center rounded-xl bg-white p-5 shadow-inner border border-slate-200">
          <QRCodeSVG value={qrData} size={180} level="H" />
          <div className="mt-3 text-center">
            <div className="font-mono text-[11px] font-extrabold text-slate-800 tracking-widest">{user.officerId || '2026-00892'}</div>
            <div className="text-[10px] font-semibold text-slate-500">Official Encrypted QR Token</div>
          </div>
        </div>

        {/* Student Info Details */}
        <div className="rounded-xl bg-muted/60 p-3.5 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">Name:</span>
            <span className="font-bold text-foreground">{user.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">Role / Program:</span>
            <span className="font-bold text-foreground capitalize">{user.role.replace('_', ' ')} / BSIS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">Campus Status:</span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-600 bg-emerald-500/15 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="size-3" /> VERIFIED
            </span>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="w-full text-xs" onClick={onClose}>
            Close Pass
          </Button>
        </div>
      </div>
    </div>
  );
}

function AppHeader({ location, onOpenMobile }: { location: string; onOpenMobile?: () => void }) {
  const [showStudentQrModal, setShowStudentQrModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [user, setUser] = useState(getStoredStaffUser);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const syncUser = () => setUser(getStoredStaffUser());
    window.addEventListener('storage', syncUser);
    return () => window.removeEventListener('storage', syncUser);
  }, []);

  const handleRoleChange = (newRole: 'super_admin' | 'officer' | 'student') => {
    const updated = { ...user, role: newRole };
    setUser(updated);
    localStorage.setItem('dimsat_user', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    toast({
      title: "Mode Switched",
      description: `Active role updated to ${newRole === 'super_admin' ? 'Super Admin' : newRole === 'officer' ? 'Officer' : 'Student'}.`,
    });
  };

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setIsDarkMode(isDark);
    toast({
      title: isDark ? "Dark Mode Enabled" : "Light Mode Enabled",
      description: "App appearance theme has been updated.",
    });
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-md md:px-7">
        {/* Left section: Hamburger for Mobile + Brand or Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            data-testid="button-open-mobile-sidebar"
            onClick={onOpenMobile}
            className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            aria-label="Open navigation sidebar"
          >
            <Menu className="size-5" />
          </button>

          <div className="md:hidden flex items-center">
            <Logo size="sm" />
          </div>

          <div className="hidden font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground md:block">
            DIMSAT / {location.replace('/', '') || 'overview'}
          </div>
        </div>

        {/* Right section: Live Clock + Top Kebab Menu */}
        <div className="ml-auto flex items-center gap-2.5">
          {/* Live Clock */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px] text-muted-foreground">{timeStr} · {dateStr}</span>
          </div>

          {/* Top Kebab Menu Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="top-kebab-menu-button"
                aria-label="Options and quick actions menu"
                className="flex size-9 items-center justify-center rounded-xl border border-border/80 bg-card text-foreground transition-all hover:border-primary/50 hover:bg-muted active:scale-95 shadow-sm"
              >
                <MoreVertical className="size-4 text-foreground/90" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2 shadow-2xl rounded-xl border-border bg-popover/95 backdrop-blur-lg">
              {/* User Header */}
              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/60 mb-1.5">
                <div className="grid size-8 place-items-center rounded-full bg-primary/20 font-mono text-xs font-bold text-primary">
                  {user.fullName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-extrabold text-foreground">{user.fullName}</div>
                  <div className="font-mono text-[9px] font-bold text-primary uppercase tracking-wider">
                    {user.role === 'super_admin' ? '🛡️ SUPER ADMIN' : user.role === 'officer' ? '👮 OFFICER' : '🎓 STUDENT'}
                  </div>
                </div>
              </div>


              {/* Preferences & Actions */}
              <DropdownMenuLabel className="font-mono text-[10px] uppercase text-muted-foreground px-2 py-1">
                Preferences
              </DropdownMenuLabel>
              <DropdownMenuItem
                data-testid="kebab-toggle-theme"
                onClick={toggleTheme}
                className="flex items-center gap-2 cursor-pointer text-xs font-medium"
              >
                {isDarkMode ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-indigo-500" />}
                <span>{isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="kebab-nav-settings"
                onClick={() => setLocation('/settings')}
                className="flex items-center gap-2 cursor-pointer text-xs font-medium"
              >
                <Settings2 className="size-4 text-slate-400" />
                <span>System Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="kebab-button-sign-out"
                onClick={() => {
                  localStorage.removeItem('dimsat_user');
                  window.dispatchEvent(new Event('storage'));
                  setLocation('/');
                }}
                className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-red-500 focus:bg-red-500/10 focus:text-red-600"
              >
                <LogOut className="size-4 text-red-500" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Student QR Pass Modal */}
      {showStudentQrModal && (
        <StudentQrPassModal user={user} onClose={() => setShowStudentQrModal(false)} />
      )}
    </>
  );
}

function Dashboard() {
  const greeting = useGreeting();
  const user = getStoredStaffUser();
  const q = useGetDashboard(); const d = q.data;
  return (
    <AppShell>
      <PageHeader eyebrow="Operations / overview" title={`${greeting}, ${user.fullName.split(' ')[0]}.`} description="Here is the pulse of certified attendance across ZDSPGC Dimataling Campus." action={<Link href="/scanner" data-testid="link-open-scanner"><Button><ScanLine className="size-4" />Open live scanner</Button></Link>} />
      {q.isLoading ? <Loading rows={3} /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : d ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Certified students" value={d.studentCount.toLocaleString()} detail="Verified in roster" icon={GraduationCap} />
            <StatCard label="Events scheduled" value={d.eventCount} detail="Single QR events" icon={CalendarDays} accent="orange" />
            <StatCard label="Attendance records" value={d.attendanceCount.toLocaleString()} detail="Confirmed scans" icon={ClipboardCheck} accent="ink" />
            <StatCard label="Current session" value={d.activeSession ? 'LIVE' : 'IDLE'} detail={d.activeSession || 'No active session'} icon={Activity} />
          </div>
          <div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
            <div className="rounded-xl border border-card-border bg-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">Active Event</div>
                  <h2 className="mt-2 text-xl font-extrabold tracking-[-.04em]">{d.latestEvent.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{d.latestEvent.venue} · {new Date(d.latestEvent.eventDate).toLocaleDateString()}</p>
                </div>
                <Badge tone={d.latestEvent.status === 'active' ? 'success' : 'neutral'}>{d.latestEvent.status}</Badge>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="font-mono text-[10px] text-muted-foreground">PRESENT</div>
                  <div className="mt-1 text-2xl font-extrabold">{d.latestEvent.presentCount}</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] text-muted-foreground">EXPECTED</div>
                  <div className="mt-1 text-2xl font-extrabold">{d.latestEvent.totalStudents}</div>
                </div>
                <div className="col-span-2">
                  <div className="mb-2 flex justify-between font-mono text-[10px] text-muted-foreground">
                    <span>ATTENDANCE RATE</span>
                    <span>{d.latestEvent.totalStudents ? Math.round((d.latestEvent.presentCount / d.latestEvent.totalStudents) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${d.latestEvent.totalStudents ? (d.latestEvent.presentCount / d.latestEvent.totalStudents) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-primary p-6 text-primary-foreground">
              <div className="flex items-center justify-between"><Zap className="size-5" /><span className="font-mono text-[10px] uppercase tracking-[.14em] opacity-60">Quick actions</span></div>
              <h3 className="mt-12 text-2xl font-extrabold leading-tight tracking-[-.06em]">One Event.<br />One Event QR Code.</h3>
              <div className="mt-6 grid gap-2">
                <Link href="/events" data-testid="link-create-event" className="flex items-center justify-between rounded-lg bg-primary-foreground/10 px-3 py-2.5 text-xs font-bold hover:bg-primary-foreground/20">Create Event & Print QR <Plus className="size-4" /></Link>
                <Link href="/students" data-testid="link-import-students" className="flex items-center justify-between rounded-lg bg-primary-foreground/10 px-3 py-2.5 text-xs font-bold hover:bg-primary-foreground/20">Import Certified Excel Roster <FileUp className="size-4" /></Link>
              </div>
            </div>
          </div>
        </>
      ) : <EmptyState title="Your dashboard is quiet" text="Import certified student list to begin." />}
    </AppShell>
  );
}

function Students() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'name' | 'studentId' | 'yearLevel' | 'program'>('name');
  const [programFilter, setProgramFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const q = useListStudents({ search: search || undefined, sort, program: programFilter === 'all' ? undefined : programFilter, yearLevel: yearFilter === 'all' ? undefined : yearFilter });
  const students = q.data || [];
  const settingsQ = useGetSettings();
  const maxPhotoUploads = settingsQ.data?.maxPhotoUploads ?? 2;

  const handleResetPhotoCount = async (id: number) => {
    try {
      await fetch(`/api/students/${id}/reset-photo-count`, { method: 'POST' });
      q.refetch();
    } catch {
      // ignore
    }
  };

  const [isClearing, setIsClearing] = useState(false);

  const handleDeleteStudent = async (id: number, name: string) => {
    if (!window.confirm(`Remove "${name}" from the certified roster? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (res.ok) {
        q.refetch();
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      } else {
        const body = await res.json().catch(() => ({}));
        alert((body as { error?: string }).error || 'Failed to remove student.');
      }
    } catch {
      alert('Network error. Could not remove student.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllStudents = async () => {
    if (!students.length) return;
    if (!window.confirm(`⚠️ DANGER: Remove all ${students.length} certified students from the system?\n\nThis will permanently delete all imported student records. This action cannot be undone.`)) return;

    setIsClearing(true);
    try {
      const res = await fetch('/api/students/clear-all', { method: 'DELETE' });
      if (res.ok) {
        q.refetch();
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      } else {
        const body = await res.json().catch(() => ({}));
        alert((body as { error?: string }).error || 'Failed to clear student roster.');
      }
    } catch {
      alert('Network error. Could not clear student roster.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Registry / certified students"
        title="Certified Student Roster"
        description="Students automatically ordered alphabetically by Student Name. Search, filter, and manage certified records."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button data-testid="button-open-import" onClick={() => setShowImport(true)}>
              <FileUp className="size-4" /> Import Excel (.xlsx)
            </Button>
            <Button
              variant="outline"
              disabled={!students.length || isClearing}
              onClick={handleClearAllStudents}
              className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
            >
              <X className="size-4" /> {isClearing ? 'Clearing Roster…' : 'Clear All Roster'}
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="input-student-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by student name or ID..."
            className="font-arial h-10 w-full rounded-lg bg-muted/60 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="font-arial h-10 rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none">
            <option value="all">All Year Levels</option>
            <option value="1">Year 1</option>
            <option value="2">Year 2</option>
            <option value="3">Year 3</option>
            <option value="4">Year 4</option>
          </select>

          <select value={programFilter} onChange={e => setProgramFilter(e.target.value)} className="font-arial h-10 rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none">
            <option value="all">All Programs</option>
            <option value="ACT-AD">ACT-AD</option>
            <option value="BSIS">BSIS</option>
            <option value="BPED">BPED</option>
          </select>

          <select data-testid="select-student-sort" value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="font-arial h-10 rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none">
            <option value="name">Sort Alphabetically (Name)</option>
            <option value="studentId">Sort by Student ID</option>
            <option value="yearLevel">Sort by Year Level</option>
            <option value="program">Sort by Program</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-card-border bg-card font-arial">
        {q.isLoading ? <div className="p-5"><Loading /></div> : q.isError ? <div className="p-5"><ErrorState retry={() => q.refetch()} /></div> : students.length ? (
          <div className="overflow-x-auto">
            <table className="font-arial w-full min-w-[760px] text-left">
              <thead className="border-b border-border bg-muted/45 font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5">Student Name & ID</th>
                  <th className="px-5 py-3.5">Year / Program</th>
                  <th className="px-5 py-3.5">Sex</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Photo Upload Limit</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr data-testid={`row-student-${s.id}`} key={s.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {s.profilePhoto ? (
                          <img src={s.profilePhoto} alt={s.fullName} className="size-8 rounded-full object-cover border border-primary/20 shrink-0" />
                        ) : (
                          <div className="grid size-8 place-items-center rounded-full bg-primary/10 font-mono text-[10px] font-medium text-primary shrink-0">
                            {s.fullName.split(' ').map(x => x[0]).slice(0, 2).join('')}
                          </div>
                        )}
                        <div>
                          <div className="text-[12px] font-bold">{s.fullName}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{s.studentId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-semibold">{s.yearLevel}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{s.program}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{s.sex}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={s.status === 'certified' || s.status === 'active' ? 'success' : 'warning'}>{s.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono text-xs text-muted-foreground">Uploads: {s.profileUploadCount ?? 0} / {maxPhotoUploads}</span>
                        <button
                          title="Reset Photo Upload Count"
                          onClick={() => handleResetPhotoCount(s.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-bold hover:bg-muted"
                        >
                          <RotateCcw className="size-3" /> Reset
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          title="Edit Year Level, Program, or details"
                          onClick={() => setEditingStudent(s)}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[10px] font-bold text-foreground hover:bg-muted hover:border-primary/45"
                        >
                          <Pencil className="size-3 text-primary" /> Edit
                        </button>
                        <button
                          title="Remove from certified roster"
                          disabled={deletingId === s.id}
                          onClick={() => handleDeleteStudent(s.id, s.fullName)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                        >
                          <X className="size-3" /> {deletingId === s.id ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-5"><EmptyState title="No students match search" text="Try a different name, ID, or sort order." /></div>}
      </div>

      {showImport && <ImportDialog onClose={() => setShowImport(false)} onImportSuccess={() => q.refetch()} />}
      {editingStudent && <EditStudentDialog student={editingStudent} onClose={() => setEditingStudent(null)} onSuccess={() => q.refetch()} />}
    </AppShell>
  );
}

function EditStudentDialog({ student, onClose, onSuccess }: { student: Student; onClose: () => void; onSuccess: () => void }) {
  const [fullName, setFullName] = useState(student.fullName);
  const [yearLevel, setYearLevel] = useState(String(student.yearLevel ?? '1'));
  const [program, setProgram] = useState(student.program ?? 'BSIS');
  const [sex, setSex] = useState(student.sex ?? 'Female');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, yearLevel, program, sex }),
      });
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const body = await res.json().catch(() => ({}));
        alert((body as { error?: string }).error || 'Failed to update student details.');
      }
    } catch {
      alert('Network error. Could not update student details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
        <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-primary font-bold">Manage Roster Entry</div>
            <h2 className="text-lg font-extrabold text-foreground">Edit Student Information</h2>
            <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{student.studentId}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>

        <div className="grid gap-4">
          <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="e.g. HUSIN, HAJEJA" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground">Year Level</label>
              <select
                value={yearLevel}
                onChange={e => setYearLevel(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none focus:border-primary"
              >
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
                <option value="5">Year 5</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground">Program / Course</label>
              <select
                value={program}
                onChange={e => setProgram(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none focus:border-primary"
              >
                <option value="BSIS">BSIS</option>
                <option value="ACT-AD">ACT-AD</option>
                <option value="BPED">BPED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground">Sex / Gender</label>
            <select
              value={sex}
              onChange={e => setSex(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none focus:border-primary"
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!fullName || isSaving} onClick={handleSave}>
            {isSaving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function parseStudentRowLine(rawLine: string) {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;

  // Tokenize: split by tabs first, then comma, then whitespace
  let tokens: string[];
  if (trimmed.includes('\t')) {
    tokens = trimmed.split('\t').map(t => t.trim()).filter(Boolean);
  } else if (trimmed.split(',').length >= 4) {
    // Proper CSV
    const parts: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of trimmed) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { parts.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    parts.push(cur.trim());
    tokens = parts.filter(Boolean);
  } else {
    // Space-separated (the format in the screenshot)
    tokens = trimmed.split(/\s+/).map(t => t.trim()).filter(Boolean);
  }

  if (tokens.length < 2) return null;

  // Student ID pattern: alphanumeric, contains at least one digit, 4-18 chars
  // e.g. 26DM0166, 2026-0001, 25DM0749
  const ID_RE = /^[A-Za-z0-9-]{4,18}$/.test.bind(/^[A-Za-z0-9-]{4,18}$/);
  const HAS_DIGIT = /\d/.test.bind(/\d/);
  const PROGRAMS = ['ACT-AD', 'BSIS', 'BPED'];
  const SEX_WORDS = ['male', 'female', 'm', 'f'];
  const YEAR_RE = /^[1-4]$/;

  // Try to locate the student ID token (has digits, looks like an ID)
  const idIdx = tokens.findIndex(t => ID_RE(t) && HAS_DIGIT(t) && !/^(male|female|m|f)$/i.test(t));
  if (idIdx === -1) return null;

  const studentId = tokens[idIdx]!;
  const nameParts = tokens.slice(0, idIdx);
  const rest = tokens.slice(idIdx + 1);

  // Build full name from name parts (handle "LAST,FIRST" or "LAST FIRST" forms)
  let fullName = nameParts.join(' ').replace(/,/g, ', ').trim();
  // Remove trailing comma if any
  fullName = fullName.replace(/,\s*$/, '').trim();

  if (!fullName || !studentId) return null;

  let yearLevel = '1';
  let program: string | null = null;
  let sex = 'Male';

  for (const tok of rest) {
    const lower = tok.toLowerCase();
    if (SEX_WORDS.includes(lower)) {
      sex = lower.startsWith('f') ? 'Female' : 'Male';
    } else if (YEAR_RE.test(tok)) {
      yearLevel = tok;
    } else if (PROGRAMS.some(p => tok.toUpperCase().startsWith(p.split('-')[0]!))) {
      program = tok.toUpperCase();
    } else if (tok.length >= 2 && program === null && !HAS_DIGIT(tok)) {
      program = tok.toUpperCase();
    }
  }

  return {
    fullName,
    studentId,
    yearLevel: yearLevel || '1',
    program: program || 'ACT-AD',
    sex: sex || 'Male',
  };
}


function ImportDialog({ onClose, onImportSuccess }: { onClose: () => void; onImportSuccess: () => void }) {
  const importMutation = useImportStudents();
  const [csvText, setCsvText] = useState('');
  const [rowsData, setRowsData] = useState<{ fullName: string; studentId: string; yearLevel: string; program: string; sex: string }[]>([]);
  const [stats, setStats] = useState<{ total: number; valid: number; duplicates: number; missing: number; invalid: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processRows = (rows: { fullName: string; studentId: string; yearLevel: string; program: string; sex: string }[]) => {
    const validRows = rows
      .map((r) => ({
        fullName: r.fullName?.trim() || '',
        studentId: r.studentId?.trim() || '',
        yearLevel: r.yearLevel?.trim() || '1',
        program: r.program?.trim() || 'ACT-AD',
        sex: r.sex?.trim() || 'Male',
      }))
      .filter((r) => r.fullName && r.studentId);

    setRowsData(validRows);

    let valid = 0;
    let duplicates = 0;
    const missing = Math.max(0, rows.length - validRows.length);
    const invalid = missing;
    const seen = new Set<string>();

    for (const r of validRows) {
      const upperId = r.studentId.toUpperCase();
      if (seen.has(upperId)) {
        duplicates++;
      } else {
        seen.add(upperId);
        valid++;
      }
    }

    setStats({ total: rows.length, valid, duplicates, missing, invalid });
  };

  const parseLines = (rawLines: string[]) => {
    if (!rawLines.length) return [];
    const firstLineLower = rawLines[0].toLowerCase();
    const hasHeader =
      firstLineLower.includes('student name') ||
      firstLineLower.includes('student_id') ||
      (firstLineLower.includes('name') && firstLineLower.includes('id'));

    const dataLines = hasHeader ? rawLines.slice(1) : rawLines;
    return dataLines.map((l) => parseStudentRowLine(l)).filter(Boolean) as {
      fullName: string;
      studentId: string;
      yearLevel: string;
      program: string;
      sex: string;
    }[];
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(bstr, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname!];

        const csvContent = XLSX.utils.sheet_to_csv(ws!);
        if (csvContent && csvContent.trim()) {
          const lines = csvContent.split('\n').map((l) => l.trim()).filter(Boolean);
          const parsed = parseLines(lines);
          processRows(parsed);
          return;
        }

        const allRows = XLSX.utils.sheet_to_json<string[]>(ws!, { header: 1, defval: '' });
        const rawLines = allRows.map((r) => (Array.isArray(r) ? r.join('\t') : String(r))).filter((l) => l.trim());
        const parsed = parseLines(rawLines);
        processRows(parsed);
      } catch (err) {
        console.error('XLSX parse error:', err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCsvChange = (val: string) => {
    setCsvText(val);
    const lines = val.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed = parseLines(lines);
    processRows(parsed);
  };

  const submitImport = () => {
    importMutation.mutate(
      { data: { rows: rowsData } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          onImportSuccess();
          onClose();
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 p-4">
      <div className="w-full max-w-xl flex flex-col max-h-[90vh] rounded-2xl border border-card-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">Certified Roster Intake</div>
            <h2 className="mt-2 text-xl font-extrabold tracking-[-.04em]">Import Excel (.xlsx) Roster</h2>
          </div>
          <button data-testid="button-close-import" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 pb-2 flex-1 grid gap-4">
          {/* File Upload Zone */}
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-5 text-center">
            <FileUp className="mx-auto size-8 text-primary" />
            <p className="mt-2 text-xs font-bold">Select Excel file (.xlsx) or CSV</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Columns: Student Name, Student ID, Year Level, Program, Sex</p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
            <Button variant="outline" className="mt-4" onClick={() => fileInputRef.current?.click()}>
              Choose .xlsx File
            </Button>
          </div>

          {/* CSV Paste */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground">Or paste CSV data below:</label>
            <textarea
              data-testid="input-import-csv"
              value={csvText}
              onChange={(e) => handleCsvChange(e.target.value)}
              placeholder={'Student Name,Student ID,Year Level,Program,Sex\nAhmad Ali,2026-0001,1,ACT-AD,Male\nMaria Santos,2026-0002,2,BSED,Female'}
              className="mt-2 h-24 w-full resize-none rounded-lg border border-input bg-background p-3 font-mono text-[11px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          {/* Validation Preview */}
          {stats && (
            <div className="rounded-xl border border-primary/25 bg-primary/8 p-4">
              <div className="text-xs font-bold text-primary">Import Validation Preview</div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-card p-2">
                  <div className="font-mono text-[9px] text-muted-foreground">TOTAL</div>
                  <div className="mt-1 text-base font-extrabold">{stats.total}</div>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <div className="font-mono text-[9px] text-emerald-700">VALID</div>
                  <div className="mt-1 text-base font-extrabold text-emerald-700">{stats.valid}</div>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <div className="font-mono text-[9px] text-amber-700">DUPLICATES</div>
                  <div className="mt-1 text-base font-extrabold text-amber-700">{stats.duplicates}</div>
                </div>
                <div className="rounded-lg bg-red-500/10 p-2">
                  <div className="font-mono text-[9px] text-red-700">MISSING/INVALID</div>
                  <div className="mt-1 text-base font-extrabold text-red-700">{stats.missing}</div>
                </div>
              </div>
            </div>
          )}

          {importMutation.isError && (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs font-semibold text-red-700">
              Failed to save roster. Make sure the API server is active and try again.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            data-testid="button-submit-import"
            onClick={submitImport}
            disabled={importMutation.isPending || !stats || stats.valid === 0}
          >
            <FileUp className="size-3.5" />
            {importMutation.isPending ? 'Saving to Database…' : `Confirm & Save Roster (${stats?.valid || 0})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Events() {
  const q = useListEvents();
  const create = useCreateEvent();
  const qr = useGenerateEventQr();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [printQrEvent, setPrintQrEvent] = useState<{ event: Event; token: string } | null>(null);
  const [printStudentCardsEvent, setPrintStudentCardsEvent] = useState<{ event: Event; token: string } | null>(null);
  const events = q.data || [];

  const handleToggleStatus = async (eventId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await fetch(`/api/events/${eventId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      q.refetch();
    } catch {
      // ignore
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Event Deleted', description: `Successfully deleted "${eventToDelete.name}".` });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        setEventToDelete(null);
        q.refetch();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'Error', description: err.error || 'Failed to delete event.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network Error', description: 'Failed to communicate with the server.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Programming / events"
        title="Event Management"
        description="One event supports multiple attendance sessions. Generate Event QR posters or individual student ID-card passes."
        action={<Button data-testid="button-open-create-event" onClick={() => setShowCreate(true)}><Plus className="size-4" />New Event</Button>}
      />

      {q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : events.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map((e) => (
            <div data-testid={`card-event-${e.id}`} key={e.id} className="rise-in rounded-xl border border-card-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[.14em] text-primary">
                    {new Date(e.eventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {e.venue}
                  </div>
                  <h2 className="mt-2 text-lg font-extrabold tracking-[-.04em]">{e.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge tone={e.status === 'active' ? 'success' : e.status === 'draft' ? 'warning' : 'neutral'}>{e.status}</Badge>
                  <button
                    onClick={() => handleToggleStatus(e.id, e.status)}
                    className="text-[10px] font-bold text-muted-foreground underline hover:text-primary"
                  >
                    {e.status === 'active' ? 'Deactivate' : 'Activate Event'}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2 border-y border-border py-4">
                <div>
                  <div className="font-mono text-[9px] text-muted-foreground">SESSIONS</div>
                  <div className="mt-1 font-bold">{e.sessions?.length ?? '—'}</div>
                </div>
                <div>
                  <div className="font-mono text-[9px] text-muted-foreground">PRESENT</div>
                  <div className="mt-1 font-bold">{e.presentCount}<span className="font-normal text-muted-foreground"> / {e.totalStudents}</span></div>
                </div>
                <div>
                  <div className="font-mono text-[9px] text-muted-foreground">QR CODE</div>
                  <div className="mt-1 font-bold">{e.qrStatus === 'generated' ? 'Issued' : 'Pending'}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingEvent(e)}
                  className="gap-1 text-xs font-bold"
                >
                  <Settings2 className="size-3.5 text-primary" /> Edit
                </Button>
                <Button
                  variant="soft"
                  className="flex-1"
                  data-testid={`button-generate-qr-${e.id}`}
                  onClick={() => qr.mutate({ eventId: e.id }, { onSuccess: result => setPrintQrEvent({ event: e, token: result.token }) })}
                >
                  <QrCode className="size-3.5" /> Poster QR
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  data-testid={`button-generate-student-cards-${e.id}`}
                  onClick={() => qr.mutate({ eventId: e.id }, { onSuccess: result => setPrintStudentCardsEvent({ event: e, token: result.token }) })}
                >
                  <GraduationCap className="size-3.5 text-primary" /> Student Passes
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setEventToDelete(e)}
                  className="gap-1 text-xs font-bold px-3"
                  title="Delete Event"
                  data-testid={`button-delete-event-${e.id}`}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState title="No events created" text="Create an event to generate event QR posters and student ID passes." action={<Button onClick={() => setShowCreate(true)}><Plus className="size-4" />Create Event</Button>} />}

      {showCreate && <EventDialog close={() => setShowCreate(false)} create={create} />}
      {editingEvent && <EditEventDialog event={editingEvent} close={() => setEditingEvent(null)} refetch={() => q.refetch()} />}

      {/* Delete Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-destructive/12 p-3 text-destructive shrink-0">
                <Trash2 className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground">Delete Event?</h3>
                <p className="text-xs text-muted-foreground">Permanent action cannot be undone</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-foreground leading-relaxed">
              Are you sure you want to delete <strong className="font-bold text-destructive">{eventToDelete.name}</strong>?
              All associated attendance sessions, QR codes, and student attendance logs for this event will be permanently removed from the system.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEventToDelete(null)} disabled={isDeleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteEvent} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {isDeleting ? 'Deleting…' : 'Yes, Delete Event'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {printQrEvent && (
        <PrintableQrModal event={printQrEvent.event} token={printQrEvent.token} onClose={() => setPrintQrEvent(null)} />
      )}

      {printStudentCardsEvent && (
        <PrintStudentQrCardsModal event={printStudentCardsEvent.event} token={printStudentCardsEvent.token} onClose={() => setPrintStudentCardsEvent(null)} />
      )}
    </AppShell>
  );
}

function EditEventDialog({ event, close, refetch }: { event: Event; close: () => void; refetch: () => void }) {
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.eventDate);
  const [venue, setVenue] = useState(event.venue);
  const [description, setDescription] = useState(event.description);
  const [status, setStatus] = useState(event.status || 'active');
  const [sessions, setSessions] = useState<SessionDraft[]>(
    event.sessions?.map(s => ({
      id: s.id,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      enabled: s.enabled,
      active: s.active,
    })) || []
  );
  const [isSaving, setIsSaving] = useState(false);

  const addSession = () => setSessions(prev => [...prev, { name: '', startTime: '08:00', endTime: '09:00', enabled: true }]);
  const removeSession = (i: number) => setSessions(prev => prev.filter((_, idx) => idx !== i));
  const updateSession = (i: number, field: keyof SessionDraft, val: string | boolean) =>
    setSessions(prev => prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));

  const submit = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, eventDate: date, venue, status, sessions }),
      });
      if (res.ok) {
        refetch();
        close();
      } else {
        alert('Failed to update event details.');
      }
    } catch {
      alert('Network error.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 p-4">
      <div className="w-full max-w-lg flex flex-col max-h-[90vh] rounded-2xl border border-card-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-border px-6 pt-6 pb-4 shrink-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">Event Setup</div>
            <h2 className="mt-1 text-xl font-extrabold">Edit Event &amp; Sessions</h2>
          </div>
          <button onClick={close} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1 grid gap-4">
          <Field label="Event Name" value={name} onChange={setName} placeholder="Annual Acquaintance Party 2026" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Venue" value={venue} onChange={setVenue} placeholder="School Gymnasium" />
            <Field label="Event Date" value={date} onChange={setDate} type="date" />
          </div>
          <Field label="Description" value={description} onChange={setDescription} placeholder="Brief event description" />

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Event Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none focus:border-primary"
            >
              <option value="active">Active (Live Attendance Scanning)</option>
              <option value="inactive">Inactive / Completed</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="mt-2 border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold">Attendance Sessions</div>
                <p className="text-[11px] text-muted-foreground">Adjust session start/end times and enabled status.</p>
              </div>
              <button
                type="button"
                onClick={addSession}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/20"
              ><Plus className="size-3" />Add Session</button>
            </div>

            <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
              {sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-input bg-background p-2">
                  <input
                    value={s.name}
                    onChange={e => updateSession(i, 'name', e.target.value)}
                    placeholder="Session name (e.g. Morning IN)"
                    className="h-8 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 text-[11px] font-semibold outline-none focus:ring-0"
                  />
                  <input
                    type="time"
                    value={s.startTime}
                    onChange={e => updateSession(i, 'startTime', e.target.value)}
                    className="h-8 w-[85px] rounded-md border border-input bg-muted px-2 text-[10px] outline-none"
                  />
                  <span className="text-[10px] text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={s.endTime}
                    onChange={e => updateSession(i, 'endTime', e.target.value)}
                    className="h-8 w-[85px] rounded-md border border-input bg-muted px-2 text-[10px] outline-none"
                  />
                  <button type="button" onClick={() => removeSession(i)} className="rounded-md p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-border shrink-0">
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              if (window.confirm(`Are you sure you want to permanently delete event "${event.name}" and all its attendance sessions and records?`)) {
                try {
                  const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
                  if (res.ok) {
                    refetch();
                    close();
                  } else {
                    const err = await res.json().catch(() => ({}));
                    alert(err.error || 'Failed to delete event.');
                  }
                } catch {
                  alert('Network error while deleting event.');
                }
              }
            }}
            className="gap-1 text-xs font-bold"
          >
            <Trash2 className="size-3.5" /> Delete Event
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button disabled={!name || !date || !venue || isSaving} onClick={submit}>
              {isSaving ? 'Saving Changes…' : 'Save Event Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintableQrModal({ event, token, onClose }: { event: Event; token: string; onClose: () => void }) {
  const handlePrint = () => {
    window.print();
  };

  const qrToken = token && token.startsWith('ZDSPGC_PERMANENT') ? token : 'ZDSPGC_PERMANENT_QR_01';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 p-4 print:p-0 print:bg-white print:static print:z-auto">
      <style>{`
        @page {
          size: letter portrait;
          margin: 0.1in;
        }
      `}</style>
      <div className="w-full max-w-lg flex flex-col max-h-[90vh] rounded-2xl bg-card shadow-2xl border border-card-border print:border-0 print:shadow-none print:max-h-none print:w-full print:max-w-none">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-border px-6 pt-6 pb-4 shrink-0 print:hidden">
          <div className="text-left">
            <div className="font-mono text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">ZDSPGC – Dimataling Campus</div>
            <h2 className="text-xl font-extrabold text-foreground">Permanent Attendance QR Code</h2>
            <p className="text-xs text-muted-foreground">Print once for the whole semester. Admin assigns event &amp; session on backend.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-6 py-4 text-center flex-1 print:p-0 print:overflow-visible">
          {/* Permanent Printable Poster Section */}
          <div className="rounded-2xl border-4 border-primary/30 bg-background p-5 sm:p-6 text-center shadow-inner print:border-4 print:border-slate-900 print:bg-white print:p-8">
            <div className="font-mono text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[.25em] text-primary print:text-slate-900">ZDSPGC – DIMATALING CAMPUS</div>

            <h1 className="mt-2 text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground print:text-slate-900">ZDSPGC ATTENDANCE</h1>
            <div className="mt-1 font-mono text-[10px] font-extrabold uppercase tracking-[.2em] text-primary print:text-slate-800">PERMANENT ATTENDANCE STATION</div>

            <div className="my-4 inline-block rounded-2xl bg-white p-4 sm:p-5 shadow-md border-2 border-gray-200">
              <QRCodeSVG value={qrToken} size={180} level="H" includeMargin className="size-[160px] sm:size-[180px]" />
            </div>

            <div className="rounded-xl bg-primary py-2.5 px-4 text-center font-mono text-xs sm:text-sm font-black uppercase tracking-[.2em] text-primary-foreground print:bg-slate-900 print:text-white">
              SCAN HERE FOR ATTENDANCE
            </div>

            {/* Currently Assigned Event Badge */}
            <div className="mt-3 rounded-lg bg-muted/60 p-2.5 text-center border border-border">
              <div className="font-mono text-[9px] font-extrabold uppercase tracking-[.14em] text-muted-foreground print:text-slate-600">Currently Activated Event</div>
              <div className="text-sm font-extrabold text-foreground print:text-slate-900">{event.name}</div>
              <div className="text-[10px] font-semibold text-muted-foreground print:text-slate-600">
                {new Date(event.eventDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {event.venue}
              </div>
            </div>

            <p className="mt-2 font-mono text-[9px] text-muted-foreground print:text-slate-500">
              Permanent Station Code: <code className="font-bold text-foreground print:text-slate-800">{qrToken}</code> · Reusable Across All Events
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0 print:hidden">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint}><Printer className="size-4" /> Print Permanent Poster</Button>
        </div>
      </div>
    </div>
  );
}

function PrintStudentQrCardsModal({ event, token, onClose }: { event: Event; token: string; onClose: () => void }) {
  const studentsQuery = useListStudents();
  const students = studentsQuery.data || [];
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Auto-select all students by default once loaded so user can print all immediately
  useEffect(() => {
    if (students.length > 0 && selectedIds.size === 0) {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  }, [students]);

  // All programs/years derived from loaded data
  const allPrograms = Array.from(new Set(students.map((s) => s.program))).sort();
  const allYears = Array.from(new Set(students.map((s) => String(s.yearLevel)))).sort();

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase()) ||
      s.program.toLowerCase().includes(search.toLowerCase());
    const matchesProgram = programFilter === 'all' || s.program === programFilter;
    const matchesYear = yearFilter === 'all' || String(s.yearLevel) === yearFilter;
    return matchesSearch && matchesProgram && matchesYear;
  });

  const toggleStudent = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map((s) => s.id)));
  const clearAll = () => setSelectedIds(new Set());

  const studentsToPrint = students.filter((s) => selectedIds.has(s.id));

  const handlePrint = () => {
    if (!studentsToPrint.length) {
      alert('Please select at least one student card to print.');
      return;
    }
    window.print();
  };

  return (
    <>
      {/* ON-SCREEN MODAL */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/60 p-4 backdrop-blur-sm print:hidden">
        <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-card shadow-2xl border border-card-border p-6">
          {/* Modal Header */}
          <div className="flex items-start justify-between border-b border-border pb-4 mb-4 shrink-0">
            <div>
              <div className="font-mono text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">ZDSPGC – Dimataling Campus</div>
              <h2 className="text-xl font-extrabold text-foreground">ID Pass Card Print Center</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Select specific students, filter by program or year level, then print only the cards you need.</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
          </div>

          <div className="overflow-y-auto flex-1 pr-1 grid gap-6 md:grid-cols-[1fr_340px]">
            {/* Left: Selectable Roster */}
            <div className="flex flex-col gap-3">
              {/* Filters Row */}
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or ID..."
                    className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
                  />
                </div>
                <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none">
                  <option value="all">All Programs</option>
                  {allPrograms.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none">
                  <option value="all">All Years</option>
                  {allYears.map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>

              {/* Select All / Clear Row */}
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                  Showing {filtered.length} · <span className="text-foreground">{selectedIds.size} of {students.length} selected</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[11px] font-bold text-primary hover:underline">Select All Visible ({filtered.length})</button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={clearAll} className="text-[11px] font-bold text-muted-foreground hover:text-foreground hover:underline">Clear All</button>
                </div>
              </div>

              {/* Student Checklist */}
              <div className="max-h-[400px] overflow-y-auto grid gap-1 pr-1 border border-border rounded-xl p-2 bg-muted/20">
                {studentsQuery.isLoading ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">Loading students…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No matching students found.</div>
                ) : (
                  filtered.map((s) => {
                    const checked = selectedIds.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 rounded-lg p-2.5 cursor-pointer transition-colors ${checked ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudent(s.id)}
                          className="size-4 rounded accent-primary shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-bold text-foreground truncate">{s.fullName}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">{s.studentId} · {s.program} · Yr {s.yearLevel}</div>
                        </div>
                        {checked && <Check className="size-3.5 text-primary shrink-0" />}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Preview + Print Actions */}
            <div className="flex flex-col gap-4">
              {/* Selection Summary Card */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary mb-3">Print Summary</div>
                <div className="text-3xl font-extrabold text-foreground">{studentsToPrint.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">ID cards ready for printing</div>
                <div className="mt-3 grid grid-cols-2 gap-1 text-[10px] font-mono">
                  {studentsToPrint.length > 0 && (
                    Array.from(new Set(studentsToPrint.map((s) => s.program))).map((prog) => (
                      <div key={prog} className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-primary" />
                        <span className="text-muted-foreground">{prog}:</span>
                        <span className="font-bold text-foreground">{studentsToPrint.filter((s) => s.program === prog).length}</span>
                      </div>
                    ))
                  )}
                </div>
                {studentsToPrint.length > 0 && (
                  <div className="mt-3 text-[10px] text-muted-foreground font-mono font-bold">
                    ≈ {Math.ceil(studentsToPrint.length / 10)} page{Math.ceil(studentsToPrint.length / 10) !== 1 ? 's' : ''} (10 cards / A4 sheet)
                  </div>
                )}
              </div>

              {/* ID Card Preview */}
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 flex flex-col items-center gap-2">
                <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Card Preview</div>
                {studentsToPrint.length > 0 ? (
                  <div className="w-full max-w-[280px] rounded-xl border-2 border-slate-900 bg-white p-3 shadow-lg flex flex-col justify-between text-slate-900" style={{ aspectRatio: '3.375/2.125' }}>
                    <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
                      <div>
                        <div className="font-mono text-[7px] font-black uppercase tracking-widest text-emerald-700">ZDSPGC – DIMATALING CAMPUS</div>
                        <div className="text-[9px] font-black tracking-tight uppercase text-slate-900">DIMSAT SID</div>
                      </div>
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[7px] font-black text-white uppercase">SEMESTER PASS</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-1">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[6px] text-slate-400 uppercase">STUDENT NAME</div>
                        <div className="text-[9px] font-black uppercase truncate">{studentsToPrint[0].fullName}</div>
                        <div className="mt-1 font-mono text-[7px] text-slate-500">{studentsToPrint[0].studentId} · {studentsToPrint[0].program} · Yr {studentsToPrint[0].yearLevel}</div>
                      </div>
                      <div className="rounded border border-slate-900 bg-white p-0.5 shrink-0">
                        <QRCodeSVG value={`ZDSPGC_PERMANENT_QR_01:${studentsToPrint[0].studentId}`} size={76} level="M" />
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-1 flex items-center justify-between font-mono text-[6px] text-slate-400 uppercase">
                      <span>OFFICIAL STUDENT ATTENDANCE PASS</span>
                      <span>REUSABLE ALL SEMESTER</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">No cards selected yet.<br />Use checkboxes or quick-select chips above.</div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handlePrint}
                  disabled={!studentsToPrint.length}
                  className="w-full h-11 text-sm font-extrabold shadow-md"
                >
                  <Printer className="size-4" />
                  Print {studentsToPrint.length > 0 ? `All ${studentsToPrint.length} Cards (${Math.ceil(studentsToPrint.length / 10)} A4 Pages)` : 'Selected Cards'}
                </Button>
                <Button variant="ghost" onClick={onClose} className="w-full">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY MULTI-PAGE CONTAINER (10 cards per A4 sheet — 2 cols × 5 rows) */}
      <div className="hidden print:block print-student-cards-root">
        <style>{`
          @page {
            size: A4 portrait;
            margin: 0.18in 0.18in;
          }
          @media print {
            html, body {
              height: auto !important;
              overflow: visible !important;
              background: white !important;
            }
            body * {
              visibility: hidden;
            }
            .print-student-cards-root,
            .print-student-cards-root * {
              visibility: visible !important;
            }
            .print-student-cards-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
            .print-page-wrapper {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              min-height: 11.3in !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: flex-start !important;
              box-sizing: border-box !important;
              padding: 0.08in 0 !important;
            }
            .print-page-wrapper:last-of-type {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .print-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 3.8in) !important;
              grid-auto-rows: 1.95in !important;
              gap: 0.14in 0.2in !important;
              justify-content: center !important;
              margin: 0 auto !important;
            }
            .id-card-print {
              width: 3.8in !important;
              height: 1.95in !important;
              box-sizing: border-box !important;
              border: 1.5pt solid #0f172a !important;
              border-radius: 7pt !important;
              padding: 0.08in 0.1in !important;
              background: white !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
            }
          }
        `}</style>

        <div>
          {(() => {
            const pages: Student[][] = [];
            for (let i = 0; i < studentsToPrint.length; i += 10) {
              pages.push(studentsToPrint.slice(i, i + 10));
            }
            return pages.map((pageStudents, pIdx) => (
              <div key={pIdx} className="print-page-wrapper">
                <div className="print-grid">
                  {pageStudents.map((s) => (
                    <div key={s.id} className="id-card-print text-slate-900">
                      {/* Header ribbon */}
                      <div className="flex items-center justify-between border-b border-slate-900 pb-1">
                        <div>
                          <div className="font-mono text-[6.5pt] font-black uppercase tracking-widest text-emerald-700">ZDSPGC – DIMATALING CAMPUS</div>
                          <div className="text-[8.5pt] font-black tracking-tight uppercase text-slate-900 truncate max-w-[2.1in]">DIMSAT SID</div>
                        </div>
                        <span className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[6.5pt] font-black text-white uppercase">SEMESTER PASS</span>
                      </div>

                      {/* Body Content */}
                      <div className="my-auto flex items-center justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[6pt] font-bold text-slate-500 uppercase">STUDENT NAME</div>
                          <h3 className="text-[9.5pt] font-black uppercase tracking-tight text-slate-900 truncate leading-tight">{s.fullName}</h3>

                          <div className="mt-1 grid grid-cols-2 gap-x-1 gap-y-0.5 font-mono text-[6.5pt]">
                            <div>
                              <span className="text-slate-400">ID:</span> <strong className="text-slate-900">{s.studentId}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400">YR:</span> <strong className="text-slate-900">Lvl {s.yearLevel}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400">PROG:</span> <strong className="text-slate-900">{s.program}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400">SEX:</span> <strong className="text-slate-900">{s.sex}</strong>
                            </div>
                          </div>
                        </div>

                        {/* QR Code */}
                        <div className="rounded-md border border-slate-900 bg-white p-0.5 shrink-0">
                          <QRCodeSVG value={`ZDSPGC_PERMANENT_QR_01:${s.studentId}`} size={72} level="M" />
                        </div>
                      </div>

                      {/* Footer Bar */}
                      <div className="border-t border-slate-200 pt-0.5 flex items-center justify-between font-mono text-[5pt] text-slate-500 uppercase tracking-wider">
                        <span>OFFICIAL STUDENT ATTENDANCE PASS</span>
                        <span>REUSABLE ALL SEMESTER</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </>
  );
}

type SessionDraft = { name: string; startTime: string; endTime: string; enabled: boolean };

const SESSION_PRESETS: SessionDraft[] = [
  { name: 'Morning IN', startTime: '07:00', endTime: '09:00', enabled: true },
  { name: 'Morning OUT', startTime: '11:00', endTime: '12:00', enabled: true },
  { name: 'Afternoon IN', startTime: '12:30', endTime: '14:00', enabled: true },
  { name: 'Afternoon OUT', startTime: '16:00', endTime: '17:00', enabled: true },
  { name: 'Evening IN', startTime: '18:00', endTime: '19:00', enabled: true },
  { name: 'Evening OUT', startTime: '21:00', endTime: '22:00', enabled: true },
];

function EventDialog({ close, create }: { close: () => void; create: ReturnType<typeof useCreateEvent> }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [sessions, setSessions] = useState<SessionDraft[]>([
    { name: 'Morning IN', startTime: '07:00', endTime: '09:00', enabled: true },
    { name: 'Afternoon IN', startTime: '12:30', endTime: '14:00', enabled: true },
  ]);

  const addSession = () => setSessions(prev => [...prev, { name: '', startTime: '08:00', endTime: '09:00', enabled: true }]);
  const removeSession = (i: number) => setSessions(prev => prev.filter((_, idx) => idx !== i));
  const updateSession = (i: number, field: keyof SessionDraft, val: string | boolean) =>
    setSessions(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  const applyPreset = () => setSessions(SESSION_PRESETS.map(s => ({ ...s })));

  const valid = sessions.length > 0 && sessions.every(s => s.name.trim() && s.startTime && s.endTime);

  const submit = () => {
    create.mutate(
      {
        data: {
          name,
          description,
          eventDate: date,
          venue,
          startTime: sessions[0]?.startTime || '07:00',
          endTime: sessions[sessions.length - 1]?.endTime || '22:00',
          sessions: sessions.filter(s => s.name.trim()),
        } as EventInput,
      },
      { onSuccess: close },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 p-4">
      <div className="w-full max-w-xl flex flex-col max-h-[90vh] rounded-2xl bg-card shadow-2xl border border-card-border">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-border px-6 pt-6 pb-4 shrink-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">Event Setup</div>
            <h2 className="mt-2 text-xl font-extrabold">Create New Event</h2>
          </div>
          <button data-testid="button-close-event" onClick={close}><X className="size-4 text-muted-foreground" /></button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1 grid gap-4">
          <Field label="Event Name" value={name} onChange={setName} placeholder="e.g. Acquaintance Party 2026" />
          <Field label="Venue" value={venue} onChange={setVenue} placeholder="School Gymnasium" />
          <Field label="Event Date" value={date} onChange={setDate} type="date" />
          <Field label="Description" value={description} onChange={setDescription} placeholder="Brief event description" />

          {/* Manual Sessions Builder */}
          <div className="mt-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold">Attendance Sessions</div>
                <p className="text-[11px] text-muted-foreground">Add only the sessions your event needs.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyPreset}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted"
                >Use Full-Day Preset (6)</button>
                <button
                  type="button"
                  onClick={addSession}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/20"
                ><Plus className="size-3" />Add Session</button>
              </div>
            </div>

            <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
              {sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-input bg-background p-2">
                  <input
                    data-testid={`input-session-name-${i}`}
                    value={s.name}
                    onChange={e => updateSession(i, 'name', e.target.value)}
                    placeholder="Session name (e.g. Morning IN)"
                    className="h-8 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 text-[12px] font-semibold outline-none placeholder:text-muted-foreground/50 focus:ring-0"
                  />
                  <input
                    type="time"
                    value={s.startTime}
                    onChange={e => updateSession(i, 'startTime', e.target.value)}
                    className="h-8 w-[90px] rounded-md border border-input bg-muted px-2 text-[11px] outline-none focus:border-primary"
                  />
                  <span className="text-[10px] text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={s.endTime}
                    onChange={e => updateSession(i, 'endTime', e.target.value)}
                    className="h-8 w-[90px] rounded-md border border-input bg-muted px-2 text-[11px] outline-none focus:border-primary"
                  />
                  <button type="button" onClick={() => removeSession(i)} className="rounded-md p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {sessions.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
                No sessions added. Click <strong>Add Session</strong> or use the full-day preset.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button data-testid="button-submit-event" disabled={!name || !date || !venue || !valid || create.isPending} onClick={submit}>
            {create.isPending ? 'Creating…' : `Create Event (${sessions.length} session${sessions.length !== 1 ? 's' : ''})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Attendance() {
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [session, setSession] = useState('all');
  const [yearLevel, setYearLevel] = useState('all');
  const [program, setProgram] = useState('all');
  const [sortBy, setSortBy] = useState('time-desc');

  const eventsQ = useListEvents();
  const eventsList = eventsQ.data || [];

  const q = useListAttendance({ search: search || undefined, session: session === 'all' ? undefined : session });
  const rawRecords = q.data || [];

  // Filter and sort records by search, event, session, year level, and program
  const records = useMemo(() => {
    const filtered = rawRecords.filter(r => {
      const matchesSearch = !search ||
        r.studentName.toLowerCase().includes(search.toLowerCase()) ||
        r.studentId.toLowerCase().includes(search.toLowerCase()) ||
        r.eventName.toLowerCase().includes(search.toLowerCase()) ||
        r.officerName.toLowerCase().includes(search.toLowerCase());

      const matchesEvent = selectedEvent === 'all' || r.eventName.toLowerCase() === selectedEvent.toLowerCase();
      const matchesSession = session === 'all' || r.sessionName === session;

      const rYear = String(r.yearLevel || '').toLowerCase();
      const matchesYear = yearLevel === 'all' ||
        rYear.includes(yearLevel.toLowerCase()) ||
        (yearLevel === '1' && (rYear.includes('1') || rYear.includes('1st'))) ||
        (yearLevel === '2' && (rYear.includes('2') || rYear.includes('2nd'))) ||
        (yearLevel === '3' && (rYear.includes('3') || rYear.includes('3rd'))) ||
        (yearLevel === '4' && (rYear.includes('4') || rYear.includes('4th')));

      const rProg = ((r as unknown as Record<string, unknown>).program as string) || '';
      const matchesProg = program === 'all' ||
        rProg.toLowerCase().includes(program.toLowerCase()) ||
        r.studentName.toLowerCase().includes(program.toLowerCase());

      return matchesSearch && matchesEvent && matchesSession && matchesYear && matchesProg;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'time-desc') return new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime();
      if (sortBy === 'time-asc') return new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime();
      if (sortBy === 'name-asc') return a.studentName.localeCompare(b.studentName);
      if (sortBy === 'name-desc') return b.studentName.localeCompare(a.studentName);
      if (sortBy === 'id-asc') return a.studentId.localeCompare(b.studentId);
      if (sortBy === 'event-asc') return a.eventName.localeCompare(b.eventName);
      return 0;
    });
  }, [rawRecords, search, selectedEvent, session, yearLevel, program, sortBy]);

  const present = records.filter(x => x.status === 'present').length;

  const handleExportCSV = () => {
    if (!records.length) {
      alert('No attendance records to export with the current filters.');
      return;
    }

    const exportData = records.map((r, idx) => ({
      '#': idx + 1,
      'Student ID': r.studentId,
      'Student Name': r.studentName,
      'Year Level': r.yearLevel,
      'Program': ((r as unknown as Record<string, unknown>).program as string) || 'BSIS',
      'Event Name': r.eventName,
      'Session': r.sessionName,
      'Time Scanned': new Date(r.scannedAt).toLocaleString(),
      'Verified Officer': r.officerName,
      'Attendance Status': r.status.toUpperCase(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance_Records');

    const sanitizedEvent = selectedEvent === 'all' ? 'All_Events' : selectedEvent.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Attendance_Report_${sanitizedEvent}_${new Date().toISOString().slice(0, 10)}.csv`;

    XLSX.writeFile(wb, filename, { bookType: 'csv' });
  };

  return (
    <AppShell>
      {/* On-Screen Header */}
      <PageHeader
        eyebrow="Records / attendance"
        title="Attendance Records"
        description="View, sort, filter, print, and export official attendance records by event, session, date, program, or year level."
      />

      {/* Summary Cards */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3 print:hidden">
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="font-mono text-[10px] text-muted-foreground">TOTAL RECORDS</div>
          <div className="mt-1 text-2xl font-extrabold">{records.length}</div>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="font-mono text-[10px] text-muted-foreground">PRESENT</div>
          <div className="mt-1 text-2xl font-extrabold text-primary">{present}</div>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="font-mono text-[10px] text-muted-foreground">LAST SYNC</div>
          <div className="mt-1 text-2xl font-extrabold">Live</div>
        </div>
      </div>

      {/* Search Bar & Filter Controls Row with Export CSV and Print Button beside them */}
      <div className="mb-5 flex flex-col gap-2.5 lg:flex-row lg:items-center print:hidden">
        {/* Search Bar Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="input-attendance-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student name, ID, event, or officer..."
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Filter Dropdowns, Event Selector, Sorting, CSV Export & Print Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Event Filter Select */}
          <select
            data-testid="select-attendance-event"
            value={selectedEvent}
            onChange={e => setSelectedEvent(e.target.value)}
            className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-bold outline-none focus:border-primary cursor-pointer max-w-[180px]"
            title="Filter by Event"
          >
            <option value="all">All Events</option>
            {eventsList.map((ev) => (
              <option key={ev.id} value={ev.name}>{ev.name}</option>
            ))}
          </select>

          {/* Session Select */}
          <select
            data-testid="select-attendance-session"
            value={session}
            onChange={e => setSession(e.target.value)}
            className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-bold outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">All Sessions</option>
            <option value="Morning IN">Morning IN</option>
            <option value="Morning OUT">Morning OUT</option>
            <option value="Afternoon IN">Afternoon IN</option>
            <option value="Afternoon OUT">Afternoon OUT</option>
            <option value="Evening IN">Evening IN</option>
            <option value="Evening OUT">Evening OUT</option>
          </select>

          {/* Year Level Select */}
          <select
            data-testid="select-attendance-year"
            value={yearLevel}
            onChange={e => setYearLevel(e.target.value)}
            className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-bold outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">All Year Levels</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>

          {/* Program Select */}
          <select
            data-testid="select-attendance-program"
            value={program}
            onChange={e => setProgram(e.target.value)}
            className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-bold outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">All Programs</option>
            <option value="BSIS">BSIS</option>
            <option value="BSED">BPED</option>
            <option value="BEED">ACT-AD</option>
          </select>

          {/* Sorting Dropdown */}
          <select
            data-testid="select-attendance-sort"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-bold outline-none focus:border-primary cursor-pointer"
            title="Sort Attendance Records"
          >
            <option value="time-desc">Time (Newest First)</option>
            <option value="time-asc">Time (Oldest First)</option>
            <option value="name-asc">Student (A–Z)</option>
            <option value="name-desc">Student (Z–A)</option>
            <option value="id-asc">Student ID (Asc)</option>
            <option value="event-asc">Event Name (A–Z)</option>
          </select>

          {/* Export CSV Button placed beside Print Button */}
          <Button
            variant="outline"
            data-testid="button-export-csv-attendance"
            onClick={handleExportCSV}
            className="h-10 px-3.5 shrink-0 shadow-sm gap-1.5 font-bold"
            title="Download CSV Spreadsheet"
          >
            <Download className="size-4 text-primary" />
            Export CSV
          </Button>

          {/* Print Attendance Report Button */}
          <Button
            variant="primary"
            data-testid="button-print-attendance"
            onClick={() => window.print()}
            className="h-10 px-4 shrink-0 shadow-sm gap-1.5"
          >
            <Printer className="size-4" />
            Print Report
          </Button>
        </div>
      </div>

      {/* On-Screen Records Table */}
      <div className="overflow-hidden rounded-xl border border-card-border bg-card print:hidden">
        {q.isLoading ? (
          <div className="p-5"><Loading /></div>
        ) : q.isError ? (
          <div className="p-5"><ErrorState retry={() => q.refetch()} /></div>
        ) : records.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-border bg-muted/45 font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">
                <tr>
                  {['Student Name & ID', 'Event / Session', 'Time Scanned', 'Officer', 'Status'].map(h => <th key={h} className="px-5 py-3.5">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr data-testid={`row-attendance-${r.id}`} key={r.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-bold">{r.studentName}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{r.studentId} · {r.yearLevel}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-semibold">{r.eventName}</div>
                      <div className="mt-0.5 text-[10px] font-bold text-primary">{r.sessionName}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[10px] text-muted-foreground">{new Date(r.scannedAt).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-xs">{r.officerName}</td>
                    <td className="px-5 py-3.5"><Badge tone={r.status === 'present' ? 'success' : 'warning'}>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5"><EmptyState title="No attendance records" text="Scanned student attendances will appear here." /></div>
        )}
      </div>

      {/* DEDICATED OFFICIAL PRINT REPORT DOCUMENT (visible ONLY when printing) */}
      <div className="hidden print:block print:fixed print:inset-0 print:z-[9999] print:bg-white print:p-4">
        <style>{`
          @page {
            size: letter portrait;
            margin: 0.3in;
          }
          @media print {
            body * {
              visibility: hidden !important;
            }
            .print-report-sheet, .print-report-sheet * {
              visibility: visible !important;
            }
            .print-report-sheet {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              color: #0f172a !important;
              font-family: Arial, Helvetica, sans-serif !important;
            }
          }
        `}</style>

        <div className="print-report-sheet text-slate-900">
          {/* School Letterhead */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full border border-slate-300 p-0.5 flex items-center justify-center shrink-0">
                <img src="/zdspgc-logo.png" alt="ZDSPGC Seal" className="size-full object-contain rounded-full" />
              </div>
              <div>
                <div className="font-mono text-[9px] font-black uppercase tracking-widest text-slate-700">
                  ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE
                </div>
                <h1 className="text-base font-black uppercase tracking-tight text-slate-900">
                  DIMATALING CAMPUS · OFFICIAL ATTENDANCE REPORT
                </h1>
                <div className="text-[9.5px] font-semibold text-slate-600">
                  Office of Student Affairs & Services · Certified Attendance Roster
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-[8.5px] text-slate-600">
              <div>Date Generated: {new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div>Time: {new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="font-bold text-emerald-800">STATUS: OFFICIAL RECORD</div>
            </div>
          </div>

          {/* Filter & Metric Summary Box */}
          <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-xs grid grid-cols-5 gap-2">
            <div>
              <span className="font-mono text-[8.5px] text-slate-500 block uppercase">Event Filter</span>
              <strong className="text-slate-900 truncate block">{selectedEvent === 'all' ? 'All Events' : selectedEvent}</strong>
            </div>
            <div>
              <span className="font-mono text-[8.5px] text-slate-500 block uppercase">Session Filter</span>
              <strong className="text-slate-900 truncate block">{session === 'all' ? 'All Sessions' : session}</strong>
            </div>
            <div>
              <span className="font-mono text-[8.5px] text-slate-500 block uppercase">Program Filter</span>
              <strong className="text-slate-900 truncate block">{program === 'all' ? 'All Programs' : program}</strong>
            </div>
            <div>
              <span className="font-mono text-[8.5px] text-slate-500 block uppercase">Year Level</span>
              <strong className="text-slate-900 truncate block">{yearLevel === 'all' ? 'All Years' : `Year ${yearLevel}`}</strong>
            </div>
            <div>
              <span className="font-mono text-[8.5px] text-slate-500 block uppercase">Verified Present</span>
              <strong className="text-emerald-800 font-black truncate block">{present} / {records.length} Records</strong>
            </div>
          </div>

          {/* Official Clean Table of Students with Records */}
          <table className="w-full text-left border-collapse text-[9.5px]">
            <thead>
              <tr className="border-y-2 border-slate-900 bg-slate-100 font-mono uppercase text-slate-800">
                <th className="py-2 px-1.5 w-7 text-center">#</th>
                <th className="py-2 px-2 w-28">Student ID</th>
                <th className="py-2 px-2">Student Name</th>
                <th className="py-2 px-2 w-24">Program & Year</th>
                <th className="py-2 px-2">Event & Session</th>
                <th className="py-2 px-2 w-36">Time Scanned</th>
                <th className="py-2 px-2">Verified Officer</th>
                <th className="py-2 px-2 w-16 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? (
                records.map((r, idx) => (
                  <tr key={r.id} className="border-b border-slate-200">
                    <td className="py-1.5 px-1.5 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-1.5 px-2 font-mono font-bold text-slate-900">{r.studentId}</td>
                    <td className="py-1.5 px-2 font-bold text-slate-900">{r.studentName}</td>
                    <td className="py-1.5 px-2 font-mono font-semibold text-slate-700">
                      {((r as unknown as Record<string, unknown>).program as string) || 'BSIS'} - Yr {r.yearLevel}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="font-semibold text-slate-900">{r.eventName}</span>
                      <span className="block text-[8.5px] font-bold text-emerald-800">{r.sessionName}</span>
                    </td>
                    <td className="py-1.5 px-2 font-mono text-slate-700">{new Date(r.scannedAt).toLocaleString()}</td>
                    <td className="py-1.5 px-2 text-slate-800">{r.officerName}</td>
                    <td className="py-1.5 px-2 text-center">
                      <span className="font-mono text-[7.5px] font-bold uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                    No verified attendance records match the selected filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Official Signatures Section */}
          <div className="mt-10 pt-4 border-t border-slate-300 grid grid-cols-2 gap-12 text-xs">
            <div>
              <div className="text-[9.5px] font-mono text-slate-500 uppercase">Prepared & Verified By:</div>
              <div className="mt-7 border-b border-slate-900 w-64" />
              <div className="mt-1 font-bold text-slate-900">Attendance Officer / Staff</div>
              <div className="text-[9.5px] text-slate-500 font-mono">ZDSPGC Dimataling Campus</div>
            </div>
            <div>
              <div className="text-[9.5px] font-mono text-slate-500 uppercase">Certified Correct & Approved:</div>
              <div className="mt-7 border-b border-slate-900 w-64" />
              <div className="mt-1 font-bold text-slate-900">Campus Registrar / Administrator</div>
              <div className="text-[9.5px] text-slate-500 font-mono">ZDSPGC Dimataling Campus</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Officers() {
  const q = useListOfficers();
  const { toast } = useToast();
  const currentUser = getStoredStaffUser();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'officer' | 'super_admin'>('officer');
  const [submitting, setSubmitting] = useState(false);

  const rawData = (q.data || []) as Array<{
    id: number;
    officerId: string;
    fullName: string;
    email: string;
    role?: string;
    status: string;
    createdAt?: string;
  }>;

  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('officer');
    setOpen(true);
  };

  const handleOpenEdit = (officer: typeof rawData[0]) => {
    setEditingId(officer.id);
    setName(officer.fullName);
    setEmail(officer.email);
    setPassword('');
    setRole((officer.role as 'officer' | 'super_admin') || 'officer');
    setOpen(true);
  };

  const handleDelete = async (id: number, fullName: string) => {
    if (!window.confirm(`Are you sure you want to delete officer account for ${fullName}?`)) return;
    try {
      const res = await fetch(`/api/officers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast({ title: 'Officer deleted', description: `Removed officer ${fullName}.` });
      queryClient.invalidateQueries({ queryKey: getListOfficersQueryKey() });
    } catch {
      toast({ title: 'Delete failed', description: 'Could not delete officer.', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSubmitting(true);

    try {
      if (editingId !== null) {
        // Edit mode
        const res = await fetch(`/api/officers/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: name.trim(),
            email: email.trim(),
            role,
            ...(password ? { password } : {}),
          }),
        });

        if (!res.ok) throw new Error('Failed to update officer');
        toast({ title: 'Officer updated', description: 'Officer account details saved.' });
      } else {
        // Add mode
        const res = await fetch('/api/officers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: name.trim(),
            email: email.trim(),
            role,
            password: password || 'officer123',
          }),
        });

        if (!res.ok) throw new Error('Failed to create officer');
        toast({ title: 'Officer added', description: `Officer ${name} created successfully.` });
      }

      setSubmitting(false);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: getListOfficersQueryKey() });
    } catch {
      setSubmitting(false);
      toast({ title: 'Save failed', description: 'Could not save officer account.', variant: 'destructive' });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '7/23/2026';
    try {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    } catch {
      return '7/23/2026';
    }
  };

  return (
    <AppShell>
      {/* Officer Accounts Main Card */}
      <div className="rise-in rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Officer Accounts</h1>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Each officer can log in separately using the Admin login tab. All officers have access based on their assigned role.
            </p>
          </div>
          <button
            data-testid="button-open-add-officer"
            type="button"
            onClick={handleOpenAdd}
            className="rounded-xl bg-[#ffb703] hover:bg-[#ffa000] text-[#08132b] px-5 py-2.5 text-xs font-black shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-2 self-start sm:self-auto shrink-0"
          >
            <Plus className="size-4 stroke-[3]" /> Add Officer
          </button>
        </div>

        {/* Table */}
        {q.isLoading ? (
          <Loading rows={4} />
        ) : q.isError ? (
          <ErrorState retry={() => q.refetch()} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full min-w-[700px] text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium text-slate-800">
                {rawData.map((officer) => {
                  const isYou = currentUser.email.toLowerCase() === officer.email.toLowerCase();
                  const isSuperAdmin = officer.role === 'super_admin' || officer.email.toLowerCase().includes('admin');

                  return (
                    <tr data-testid={`row-officer-${officer.id}`} key={officer.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name */}
                      <td className="px-5 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{officer.fullName}</span>
                          {isYou && (
                            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700 uppercase tracking-wider">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 font-mono text-[11px] text-slate-600">
                        {officer.email}
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        {isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-amber-700">
                            <span className="size-1.5 rounded-full bg-amber-500" /> SUPER ADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-600">
                            <User className="size-3 text-slate-400" /> OFFICER
                          </span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="px-5 py-4 font-mono text-[11px] text-slate-500">
                        {formatDate(officer.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            data-testid={`button-edit-officer-${officer.id}`}
                            type="button"
                            onClick={() => handleOpenEdit(officer)}
                            className="p-1 text-slate-600 hover:text-slate-900 transition-colors"
                            title="Edit Officer"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            data-testid={`button-delete-officer-${officer.id}`}
                            type="button"
                            onClick={() => handleDelete(officer.id, officer.fullName)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete Officer"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Officer Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 rise-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-600">Officer Access</span>
                <h2 className="text-lg font-extrabold text-slate-900">{editingId !== null ? 'Edit Officer Account' : 'Add New Officer'}</h2>
              </div>
              <button data-testid="button-close-officer" type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
              <Field label="Full Name" value={name} onChange={setName} placeholder="e.g. Suerte, Carlyn" />
              <Field label="Work Email" value={email} onChange={setEmail} placeholder="e.g. suerte@gmail.com" />
              <Field
                label="Password (for login)"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder={editingId !== null ? 'Leave blank to keep existing' : 'e.g. officer123'}
              />
              <div className="grid gap-1.5 text-[11px] font-bold text-muted-foreground">
                <span>Assigned Role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'officer' | 'super_admin')}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs font-bold text-slate-900 outline-none focus:border-primary"
                >
                  <option value="officer">Officer (Dashboard, Scanner, Events & Attendance only)</option>
                  <option value="super_admin">Super Admin (Full System Access)</option>
                </select>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button data-testid="button-submit-officer" type="submit" disabled={!name.trim() || !email.trim() || submitting}>
                  {submitting ? 'Saving…' : editingId !== null ? 'Save Changes' : 'Add Officer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SettingsPage() {
  const q = useGetSettings();
  const update = useUpdateSettings();
  const { toast } = useToast();
  const s = q.data as (Settings & { lateThresholdMinutes?: number }) | undefined;

  const [school, setSchool] = useState('');
  const [campus, setCampus] = useState('');
  const [lateThreshold, setLateThreshold] = useState(15);
  const [auto, setAuto] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [dupe, setDupe] = useState(true);
  const [confirm, setConfirm] = useState(true);

  useEffect(() => {
    if (s) {
      setSchool(s.schoolName || 'ZDSPGC – Dimataling Campus');
      setCampus(s.campusName || 'Dimataling Campus');
      setLateThreshold(s.lateThresholdMinutes ?? 15);
      setAuto(s.automaticSessions ?? true);
      setManualMode((s as unknown as Record<string, unknown>).manualSessionMode as boolean ?? false);
      setDupe(s.duplicateProtection ?? true);
      setConfirm(s.attendanceConfirmation ?? true);
    }
  }, [s]);

  const save = () =>
    update.mutate(
      {
        data: {
          schoolName: school,
          campusName: campus,
          automaticSessions: auto,
          manualSessionMode: manualMode,
          duplicateProtection: dupe,
          attendanceConfirmation: confirm,
          ...({ lateThresholdMinutes: lateThreshold } as Record<string, unknown>),
        } as Record<string, unknown>,
      },
      {
        onSuccess: () =>
          toast({ title: 'Settings saved', description: 'System settings have been updated successfully.' }),
        onError: () =>
          toast({ title: 'Save failed', description: 'Could not save settings. Please try again.', variant: 'destructive' }),
      }
    );

  return (
    <AppShell>
      <PageHeader eyebrow="Configuration / system" title="System Settings" description="Configure campus defaults, late thresholds, photo upload limits, and session control modes." action={<Button data-testid="button-save-settings" onClick={save} disabled={update.isPending}><Check className="size-4" />{update.isPending ? 'Saving…' : 'Save Changes'}</Button>} />
      {q.isLoading ? <Loading rows={3} /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : (
        <div className="grid max-w-3xl gap-5">
          <section className="rounded-xl border border-card-border bg-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Settings2 className="size-4" /></div>
              <div><h2 className="text-sm font-extrabold">School Identity &amp; Attendance Rules</h2><p className="text-xs text-muted-foreground">Shown across printable reports, console headers, and status calculations.</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="School Name" value={school || s?.schoolName || 'ZDSPGC – Dimataling Campus'} onChange={setSchool} />
              <Field label="Campus Name" value={campus || s?.campusName || 'Dimataling Campus'} onChange={setCampus} />
              <Field label="Late Threshold (Mins)" type="number" value={String(lateThreshold)} onChange={v => setLateThreshold(Number(v) || 15)} />
            </div>
          </section>

          <section className="rounded-xl border border-card-border bg-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-accent/15 text-accent"><ShieldCheck className="size-4" /></div>
              <div><h2 className="text-sm font-extrabold">Attendance Safeguards &amp; Session Mode</h2><p className="text-xs text-muted-foreground">Duplicate scan protection &amp; session control settings.</p></div>
            </div>
            <div className="grid gap-1">
              {[
                ['Automatic Sessions (Time-Based)', 'Automatically activate Morning IN/OUT, Afternoon IN/OUT, Evening IN/OUT based on current time.', auto, setAuto],
                ['Manual Session Activation', 'Allow Admin to manually activate specific attendance sessions.', manualMode, setManualMode],
                ['Duplicate Protection', 'Block duplicate scans for the same student and session.', dupe, setDupe],
                ['Visual Confirmation Step', 'Show student photo to Officer for visual verification before recording.', confirm, setConfirm],
              ].map(([label, text, value, setter]) => (
                <button
                  data-testid={`toggle-${String(label).toLowerCase().replaceAll(' ', '-')}`}
                  key={String(label)}
                  onClick={() => (setter as (v: boolean) => void)(!value)}
                  className="flex items-center gap-4 rounded-lg px-3 py-3 text-left hover:bg-muted/60"
                >
                  <div className={`relative h-5 w-9 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted-foreground/25'}`}>
                    <div className={`absolute top-1 size-3 rounded-full bg-card transition-transform ${value ? 'left-5' : 'left-1'}`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold">{String(label)}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{String(text)}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function Scanner() {
  const scan = useScanAttendance();
  const confirm = useConfirmAttendance();
  const listAttendance = useListAttendance();
  const studentsQuery = useListStudents();
  const eventsQuery = useListEvents();
  const generateQrMutation = useGenerateEventQr();

  const [token, setToken] = useState('ZDSPGC_PERMANENT_QR_01');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [candidate, setCandidate] = useState<Awaited<ReturnType<typeof useScanAttendance>>['data']>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [lastScan, setLastScan] = useState<{ name: string; id: string; session: string; status: string; time: string; photo: string | null }| null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [soundEnabled] = useState(true);
  // Prevent double-scan while modal is open or request in-flight
  const isScanLocked = useRef(false);

  const records = listAttendance.data || [];
  const students = studentsQuery.data || [];
  const activeEvent = eventsQuery.data?.find((e) => e.status === 'active');

  const totalScans = records.length;
  const presentScans = records.filter(r => r.status === 'present').length;
  const lateScans = records.filter(r => r.status === 'late').length;

  // Auto-fill CSC Permanent QR token on page load
  useEffect(() => {
    if (!token) {
      setToken('ZDSPGC_PERMANENT_QR_01');
    }
  }, [token]);

  const startCamera = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      // Camera stream fallback
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Real-time jsQR canvas scan loop — works in all browsers
  useEffect(() => {
    let animId: number;

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (
        isScanning &&
        !isScanLocked.current &&
        video &&
        canvas &&
        video.readyState === video.HAVE_ENOUGH_DATA &&
        video.videoWidth > 0
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code && code.data) {
            isScanLocked.current = true;
            const raw = code.data.trim();
            if (raw.includes(':')) {
              const colonIdx = raw.indexOf(':');
              const t = raw.substring(0, colonIdx);
              const s = raw.substring(colonIdx + 1);
              setToken(t);
              setStudentIdInput(s);
              verify(t, s);
            } else {
              setStudentIdInput(raw);
              verify(token, raw);
            }
          }
        }
      }
      if (isScanning) {
        animId = requestAnimationFrame(scanFrame);
      }
    };

    if (isScanning) {
      animId = requestAnimationFrame(scanFrame);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isScanning, token]);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext fallback
    }
  };

  const verify = (evtToken?: string, sId?: string) => {
    const activeToken = (evtToken || token).trim();
    const activeStudent = (sId || studentIdInput).trim();
    if (!activeToken || !activeStudent) return;

    setMessage('');
    scan.mutate(
      { data: { eventToken: activeToken, studentId: activeStudent } },
      {
        onSuccess: (data) => {
          setCandidate(data);
          setShowModal(true);
          if (soundEnabled) playBeep();
          // Lock stays locked while modal is open — unlocked on modal close
        },
        onError: (err: unknown) => {
          const apiError =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            (err as { message?: string })?.message ||
            'No matching Event QR token or certified student found.';
          setMessage(`❌ ${apiError}`);
          // Unlock so next scan can try again after 2.5 seconds
          setTimeout(() => { isScanLocked.current = false; }, 2500);
        },
      }
    );
  };

  const handleConfirmSave = () => {
    if (!candidate) return;
    const activeToken = token.trim();
    const activeStudent = studentIdInput.trim() || candidate.studentId;

    confirm.mutate(
      { data: { eventToken: activeToken, studentId: activeStudent } },
      {
        onSuccess: () => {
          setLastScan({
            name: candidate.studentName,
            id: candidate.studentId,
            session: candidate.sessionName,
            status: 'Present',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            photo: candidate.profilePhoto ?? null,
          });
          queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
          setShowModal(false);
          setCandidate(undefined);
          setStudentIdInput('');
          setMessage('✓ Attendance recorded successfully!');
          // Unlock scanner for next student after 1.5 seconds
          setTimeout(() => { isScanLocked.current = false; }, 1500);
        },
      }
    );
  };

  const handleDenyReject = () => {
    setShowModal(false);
    setCandidate(undefined);
    setMessage('Scan rejected by officer.');
    // Unlock so scanner can read the next code
    setTimeout(() => { isScanLocked.current = false; }, 1000);
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card border border-card-border p-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-amber-500">📷</span>
            <h1 className="text-2xl font-black tracking-tight text-foreground font-serif">Event QR Scanner</h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-emerald-700 uppercase border border-emerald-500/20">CSC Permanent QR Active</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Print CSC QR Code ONCE per semester — active event and session are automatically attached to all scans.</p>
        </div>
        {activeEvent ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2 border border-emerald-500/30">
            <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-800">Active Event: {activeEvent.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3.5 py-2 border border-amber-500/30">
            <span className="size-2.5 rounded-full bg-amber-500" />
            <span className="text-xs font-bold text-amber-800">No Active Event (Activate an event in Event Management)</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[450px_1fr]">
        {/* LEFT COLUMN: Camera Scanner & Inputs */}
        <div className="grid gap-4">
          <section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span className="text-amber-500">📷</span> Camera Scanner
              </div>
              <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">LIVE SCANNER</span>
            </div>

            {/* Viewfinder Box */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black shadow-inner flex items-center justify-center">
              {/* Hidden canvas for jsQR pixel extraction */}
              <canvas ref={canvasRef} className="hidden" />
              {isScanning ? (
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              ) : (
                <div className="p-6 text-center text-white/50">
                  <div className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-white/10 text-white">
                    <QrCode className="size-6" />
                  </div>
                  <div className="text-xs font-semibold">Camera is Ready</div>
                  <div className="mt-1 text-[10px] opacity-70">Click Launch Scanner below to activate camera</div>
                </div>
              )}

              {/* Green Corner Markers Overlay */}
              <div className="absolute inset-6 pointer-events-none border-2 border-transparent">
                <div className="absolute top-0 left-0 size-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                <div className="absolute top-0 right-0 size-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 size-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 size-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
              </div>
            </div>

            {/* Launch / Stop Scanner Button */}
            <div className="mt-4 text-center">
              <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">SELECT CAMERA</div>
              {isScanning ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full rounded-xl bg-red-600 py-3 text-xs font-bold text-white shadow-md hover:bg-red-700"
                >
                  Stop Scanner
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-xs font-extrabold text-slate-900 shadow-md hover:bg-amber-500"
                >
                  <span className="size-2 rounded-full bg-slate-900 animate-pulse" /> Launch Scanner
                </button>
              )}
            </div>

            {/* Inputs for manual entry */}
            <div className="mt-5 border-t border-border pt-4 grid gap-3">
              <div className="grid gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CSC Permanent QR Token</label>
                  {activeEvent && <span className="text-[9px] font-mono text-emerald-700 font-bold">Auto-Loaded: {activeEvent.name}</span>}
                </div>
                <input
                  data-testid="input-event-qr-token"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="ZDSPGC_PERMANENT_QR_01"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-mono font-medium outline-none focus:border-primary"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Student ID (or Scan Pass)</label>
                <input
                  data-testid="input-student-id"
                  value={studentIdInput}
                  onChange={e => {
                    const val = e.target.value;
                    setStudentIdInput(val);
                    if (val.includes(':')) {
                      const colonIdx = val.indexOf(':');
                      const t = val.substring(0, colonIdx);
                      const s = val.substring(colonIdx + 1);
                      setToken(t);
                      setStudentIdInput(s);
                      verify(t, s);
                    }
                  }}
                  onKeyDown={e => e.key === 'Enter' && verify()}
                  placeholder="Type or scan Student ID (e.g. 26DM0166)"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium outline-none focus:border-primary"
                />
              </div>

              {/* Scanning status indicator (shows when camera is active) */}
              {isScanning ? (
                <div className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold ${scan.isPending ? 'bg-amber-500/20 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
                  <span className={`size-2 rounded-full ${scan.isPending ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                  {scan.isPending ? 'Verifying Student…' : 'Ready — Hold QR code up to camera'}
                </div>
              ) : (
                <Button data-testid="button-verify-student" disabled={!studentIdInput.trim() || scan.isPending} onClick={() => verify()} className="h-10 w-full mt-1">
                  <Search className="size-4" /> {scan.isPending ? 'Verifying...' : 'Verify Student ID'}
                </Button>
              )}

              {message && <div className={`text-xs font-semibold mt-1 ${message.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{message}</div>}


              {/* Roster Quick-Click Shortcuts */}
              {students.length > 0 && (
                <div className="mt-2 border-t border-border pt-3">
                  <div className="text-[9px] font-mono font-bold uppercase text-muted-foreground mb-1.5">Quick Test Click (Roster Students)</div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {students.slice(0, 10).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setStudentIdInput(s.studentId);
                          verify(token, s.studentId);
                        }}
                        className="rounded-md bg-muted px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-primary/20 hover:text-primary transition-colors"
                      >
                        {s.fullName.split(',')[0]} ({s.studentId})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Stats & Last Scan Result */}
        <div className="grid gap-6">
          {/* Top 3 Stat Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-card-border bg-card p-5 text-center shadow-sm">
              <div className="text-3xl font-black text-foreground">{totalScans}</div>
              <div className="mt-1 text-xs font-semibold text-muted-foreground">Total Scans</div>
            </div>
            <div className="rounded-2xl border border-card-border bg-card p-5 text-center shadow-sm">
              <div className="text-3xl font-black text-emerald-600">{presentScans}</div>
              <div className="mt-1 text-xs font-semibold text-emerald-700">Present</div>
            </div>
            <div className="rounded-2xl border border-card-border bg-card p-5 text-center shadow-sm">
              <div className="text-3xl font-black text-amber-500">{lateScans}</div>
              <div className="mt-1 text-xs font-semibold text-amber-700">Late</div>
            </div>
          </div>

          {/* Last Scan Result Card */}
          <section className="rounded-2xl border border-card-border bg-card p-6 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-foreground">Last Scan Result</h2>

              {lastScan ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted/20">
                  {/* Full-width photo for clear visual verification */}
                  <div className="relative w-full overflow-hidden bg-slate-900" style={{ aspectRatio: '4/3' }}>
                    {lastScan.photo ? (
                      <img
                        src={lastScan.photo}
                        alt={lastScan.name}
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-amber-400 to-amber-500">
                        <span className="font-mono text-5xl font-black text-white tracking-widest">
                          {lastScan.name.split(' ').map((x: string) => x[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                    )}
                    {/* Verified overlay badge */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 shadow-md">
                      <span className="size-1.5 rounded-full bg-white animate-pulse" />
                      <span className="font-mono text-[10px] font-extrabold text-white uppercase tracking-wider">Verified</span>
                    </div>
                  </div>
                  {/* Info strip below photo */}
                  <div className="p-4">
                    <h3 className="text-base font-extrabold text-foreground leading-tight">{lastScan.name}</h3>
                    <p className="mt-0.5 font-mono text-[11px] font-bold text-muted-foreground">{lastScan.id}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-semibold text-foreground">📅 {lastScan.session}</span>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700">{lastScan.status}</span>
                      <span className="ml-auto text-muted-foreground font-mono">{lastScan.time}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="my-12 text-center text-muted-foreground">
                  <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                    <Camera className="size-6" />
                  </div>
                  <p className="text-xs font-semibold">No scans yet. Start the scanner and scan a student QR code.</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground border-t border-border pt-4">
              <Volume2 className="size-4 text-muted-foreground" />
              <span>Sound feedback enabled — beep on successful scan</span>
            </div>
          </section>
        </div>
      </div>

      {/* VERIFY STUDENT IDENTITY MODAL (Match Image 4) */}
      {showModal && candidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 rise-in">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200">
            {/* Header: Dark Blue Bar with Yellow Badge */}
            <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span className="text-xs font-bold tracking-tight">Verify Student Identity</span>
              </div>
              <span className="rounded-full bg-amber-400/20 border border-amber-400/50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                Scan Confirmed
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-6 text-center">
              {/* Golden Avatar Box (Match Image 4) */}
              <div className="mx-auto mb-4 relative size-44 overflow-hidden rounded-2xl border-4 border-amber-300 shadow-md bg-gradient-to-b from-amber-400 to-amber-500 flex items-center justify-center">
                {candidate.profilePhoto ? (
                  <img src={candidate.profilePhoto} alt={candidate.studentName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl font-extrabold text-white tracking-widest">
                    {candidate.studentName.split(' ').map((x: string) => x[0]).slice(0, 2).join('')}
                  </span>
                )}
              </div>

              {/* Student Name */}
              <h3 className="text-xl font-extrabold text-slate-900">{candidate.studentName}</h3>
              <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                {candidate.studentId} · Year {candidate.yearLevel} · {candidate.program}
              </p>
              <div className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 py-1 px-3 rounded-lg inline-block">
                Event: {candidate.eventName} ({candidate.sessionName})
              </div>

              {/* Buttons */}
              <div className="mt-6 grid gap-2.5">
                <button
                  data-testid="button-confirm-attendance"
                  type="button"
                  onClick={handleConfirmSave}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white shadow-md hover:bg-emerald-700 transition-colors"
                >
                  Confirm & Save
                </button>
                <button
                  type="button"
                  onClick={handleDenyReject}
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Deny / Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/sign-in/:rest*" component={SignIn} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/students" component={Students} />
      <Route path="/events" component={Events} />
      <Route path="/attendance" component={Attendance} />
      <Route path="/officers" component={Officers} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/scanner" component={Scanner} />
      <Route component={() => <div className="grid min-h-[100dvh] place-items-center bg-background"><div className="text-center"><h1 className="text-5xl font-extrabold tracking-[-.08em]">404</h1><p className="mt-2 text-sm text-muted-foreground">This route is not in the console.</p><Link href="/dashboard" className="mt-5 inline-block text-sm font-bold text-primary">Back to overview</Link></div></div>} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;