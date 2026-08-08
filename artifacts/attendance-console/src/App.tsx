import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowRight, BadgeCheck, BarChart3, Bell, CalendarDays, Camera, Check, CheckCircle2,
  ChevronDown, ClipboardCheck, Clock3, Download, FileUp, Filter, GraduationCap,
  LayoutDashboard, Loader2, LogOut, Menu, MoreHorizontal, Plus, Printer, QrCode,
  RefreshCw, RotateCcw, ScanLine, Search, Settings2, ShieldCheck, SlidersHorizontal, UserPlus,
  Users, Volume2, X, Zap
} from 'lucide-react';
import {
  useConfirmAttendance, useCreateEvent, useCreateOfficer, useGenerateEventQr, useGetDashboard,
  useGetSettings, useImportStudents, useListAttendance, useListEvents, useListOfficers,
  useListStudents, useScanAttendance, useUpdateSettings, getGetDashboardQueryKey,
  getGetSettingsQueryKey, getListAttendanceQueryKey, getListEventsQueryKey,
  getListOfficersQueryKey, getListStudentsQueryKey
} from '@workspace/api-client-react';
import type { AttendanceRecord, Event, EventInput, Officer, Settings, Student } from '@workspace/api-client-react';
import { Toaster } from '@/components/ui/toaster';
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

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" data-testid="brand-attenda">
      <div className={`grid size-9 place-items-center rounded-xl ${dark ? 'bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]' : 'bg-primary text-primary-foreground'}`}>
        <span className="text-lg font-extrabold tracking-tighter">a</span>
      </div>
      <div>
        <div className="text-[15px] font-extrabold tracking-[-0.04em]">attenda</div>
        <div className={`font-mono text-[9px] uppercase tracking-[0.18em] ${dark ? 'text-sidebar-foreground/55' : 'text-muted-foreground'}`}>console</div>
      </div>
    </div>
  );
}

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'ghost'|'soft'|'outline'|'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:brightness-105 shadow-[0_3px_0_hsl(166_78%_24%)]',
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    soft: 'bg-accent/12 text-accent-foreground hover:bg-accent/20',
    outline: 'border border-border bg-card hover:border-primary/45 hover:bg-muted',
    danger: 'bg-destructive text-destructive-foreground hover:brightness-105',
  };
  return <button className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-bold transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral'|'success'|'warning'|'danger'|'teal' }) {
  const style = { neutral: 'bg-muted text-muted-foreground', success: 'bg-emerald-500/12 text-emerald-700', warning: 'bg-amber-500/15 text-amber-700', danger: 'bg-red-500/12 text-red-700', teal: 'bg-primary/12 text-primary' }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[.04em] ${style}`}>{children}</span>;
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <label className="grid gap-1.5 text-[11px] font-bold text-muted-foreground"><span>{label}</span><input data-testid={`input-${label.toLowerCase().replaceAll(' ', '-')}`} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-9 px-2"><Logo dark /></div>
        <div className="px-2 pb-3 font-mono text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/40">Workspace</div>
        <nav className="grid gap-1">
          {nav.map(item => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link data-testid={`link-${item.label.toLowerCase().replaceAll(' ', '-')}`} key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition-all ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' : 'text-sidebar-foreground/62 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground'}`}>
                <Icon className={`size-[16px] ${active ? 'text-sidebar-primary' : 'text-sidebar-foreground/48 group-hover:text-sidebar-primary'}`} />
                {item.label}
                {item.href === '/scanner' && <span className="ml-auto size-1.5 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-1">
          <Link data-testid="link-settings" href="/settings" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold ${location === '/settings' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/62 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground'}`}>
            <Settings2 className="size-4" />System settings
          </Link>
          <div className="mt-3 border-t border-sidebar-border pt-4">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <div className="grid size-8 place-items-center rounded-full bg-sidebar-primary/20 font-mono text-[10px] font-medium text-sidebar-primary">AD</div>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-bold">Admin Officer</div>
                <div className="font-mono text-[9px] text-sidebar-foreground/45">ZDSPGC · DIMATALING</div>
              </div>
              <ChevronDown className="ml-auto size-3.5 text-sidebar-foreground/40" />
            </div>
            <button data-testid="button-sign-out" onClick={() => setLocation('/sign-in')} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[11px] font-semibold text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <LogOut className="size-3.5" />Sign out
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close menu" data-testid="button-close-menu" className="fixed inset-0 z-30 bg-sidebar/40 md:hidden" onClick={() => setMobileOpen(false)} />}
      <main className="md:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md md:px-9">
          <button aria-label="Open menu" data-testid="button-open-menu" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden">
            <Menu className="size-5" />
          </button>
          <div className="hidden font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground md:block">ZDSPGC Console / {location.replace('/', '') || 'overview'}</div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-[10px] text-muted-foreground">Systems normal</span>
            </div>
            <button data-testid="button-notifications" className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted">
              <Bell className="size-4" />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] px-5 py-7 md:px-9 lg:py-9">{children}</div>
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div className="rise-in">
        <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[.18em] text-primary">{eyebrow}</div>
        <h1 className="text-[27px] font-extrabold tracking-[-.06em] text-foreground md:text-[34px]">{title}</h1>
        <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">{description}</p>
      </div>
      {action && <div className="rise-in delay-1">{action}</div>}
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon, accent = 'teal' }: { label: string; value: string|number; detail: string; icon: React.ElementType; accent?: 'teal'|'orange'|'ink' }) {
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
    <div className="min-h-[100dvh] overflow-hidden bg-[hsl(188_38%_16%)] text-[hsl(42_38%_98%)]">
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(hsl(166 78% 46%/.15) 1px,transparent 1px),linear-gradient(90deg,hsl(166 78% 46%/.15) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
        <Logo dark />
        <button data-testid="button-landing-sign-in" onClick={() => setLocation('/sign-in')} className="rounded-lg border border-[hsl(42_28%_93%/.22)] px-4 py-2 text-[12px] font-bold hover:bg-[hsl(42_28%_93%/.08)]">
          Staff sign in <ArrowRight className="ml-2 inline size-3.5" />
        </button>
      </nav>
      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 md:grid-cols-[1.1fr_.9fr] md:px-10 md:pb-32 md:pt-24">
        <div className="rise-in">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[hsl(166_78%_46%/.35)] bg-[hsl(166_78%_46%/.1)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.13em] text-[hsl(166_78%_46%)]">
            <span className="size-1.5 rounded-full bg-[hsl(166_78%_46%)]" />ZDSPGC – Dimataling Campus
          </div>
          <h1 className="max-w-2xl text-5xl font-extrabold leading-[.98] tracking-[-.08em] md:text-8xl">
            Attendance,<br /><span className="text-[hsl(166_78%_46%)]">without friction.</span>
          </h1>
          <p className="mt-7 max-w-lg text-[15px] leading-7 text-[hsl(42_28%_93%/.62)]">
            Attenda gives school staff one clear command center for certified students, single event QR operations, and defensible records.
          </p>
          <button data-testid="button-hero-sign-in" onClick={() => setLocation('/sign-in')} className="mt-9 inline-flex items-center gap-3 rounded-lg bg-[hsl(166_78%_46%)] px-5 py-3 text-[13px] font-extrabold text-[hsl(188_38%_12%)] shadow-[0_5px_0_hsl(166_78%_24%)] transition-transform hover:-translate-y-0.5">
            Open staff console <ArrowRight className="size-4" />
          </button>
        </div>
        <div className="rise-in delay-2 relative">
          <div className="absolute -inset-10 rounded-full bg-[hsl(166_78%_46%/.08)] blur-3xl" />
          <div className="relative rounded-2xl border border-[hsl(42_28%_93%/.14)] bg-[hsl(188_38%_16%/.7)] p-4 shadow-2xl backdrop-blur">
            <div className="mb-4 flex items-center justify-between border-b border-[hsl(42_28%_93%/.1)] pb-3">
              <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[hsl(42_28%_93%/.45)]">Live session / Acquaintance Party</span>
              <span className="font-mono text-[10px] text-[hsl(166_78%_46%)]">MORNING IN</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[hsl(166_78%_46%/.12)] p-4">
                <div className="font-mono text-[10px] text-[hsl(166_78%_46%)]">PRESENT</div>
                <div className="mt-5 text-4xl font-extrabold">1,180</div>
                <div className="mt-1 text-[10px] text-[hsl(42_28%_93%/.45)]">of 1,200 certified</div>
              </div>
              <div className="rounded-xl bg-[hsl(42_28%_93%/.07)] p-4">
                <div className="font-mono text-[10px] text-[hsl(42_28%_93%/.45)]">ACTIVE SESSION</div>
                <div className="mt-5 text-lg font-bold">Morning IN</div>
                <div className="mt-2 text-[10px] text-[hsl(42_28%_93%/.45)]">07:00 AM – 09:00 AM</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SignIn() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('admin@attenda.edu');
  const [password, setPassword] = useState('admin123');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocation('/dashboard');
  };

  return (
    <div className="grid min-h-[100dvh] md:grid-cols-[1fr_1fr]">
      <div className="hidden bg-sidebar p-10 text-sidebar-foreground md:flex md:flex-col">
        <Logo dark />
        <div className="mt-auto max-w-md">
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[.2em] text-sidebar-primary">
            Staff access / ZDSPGC
          </div>
          <h1 className="text-5xl font-extrabold leading-[1] tracking-[-.08em]">
            A calmer way<br />to keep count.
          </h1>
          <p className="mt-6 text-sm leading-7 text-sidebar-foreground/55">
            Private tools for school administrators and attendance officers.
          </p>
        </div>
        <div className="mt-auto pt-20 font-mono text-[9px] uppercase tracking-[.16em] text-sidebar-foreground/35">
          ZDSPGC Dimataling Campus · Attenda Console
        </div>
      </div>
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[390px] rise-in">
          <div className="md:hidden"><Logo /></div>
          <div className="mt-12 md:mt-0">
            <div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Welcome back</div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-.06em]">Sign in to Attenda</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Use your school staff identity to continue.</p>
            <form onSubmit={handleSubmit} className="mt-9 grid gap-4">
              <Field label="Work email" value={email} onChange={setEmail} placeholder="name@school.edu" />
              <Field label="Password" value={password} onChange={setPassword} placeholder="Enter your password" type="password" />
              <Button type="submit" data-testid="button-submit-sign-in" className="mt-2 h-11 w-full">
                Continue <ArrowRight className="size-4" />
              </Button>
            </form>
            <div className="my-7 flex items-center gap-3 text-[10px] text-muted-foreground">
              <div className="h-px flex-1 bg-border" />SECURE STAFF ACCESS<div className="h-px flex-1 bg-border" />
            </div>
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 text-primary shrink-0" />
                <div>
                  <div className="text-[12px] font-bold text-foreground">Admin Credentials</div>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    Email: <code className="font-mono font-bold text-foreground">admin@attenda.edu</code><br />
                    Password: <code className="font-mono font-bold text-foreground">admin123</code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const q = useGetDashboard(); const d = q.data;
  return (
    <AppShell>
      <PageHeader eyebrow="Operations / overview" title="Good morning, Admin." description="Here is the pulse of certified attendance across ZDSPGC Dimataling Campus." action={<Link href="/scanner" data-testid="link-open-scanner"><Button><ScanLine className="size-4" />Open live scanner</Button></Link>} />
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
  const [sort, setSort] = useState<'name'|'studentId'|'yearLevel'|'program'>('name');
  const [programFilter, setProgramFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const q = useListStudents({ search: search || undefined, sort, program: programFilter === 'all' ? undefined : programFilter, yearLevel: yearFilter === 'all' ? undefined : yearFilter });
  const students = q.data || [];

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
            className="h-10 w-full rounded-lg bg-muted/60 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none">
            <option value="all">All Year Levels</option>
            <option value="1">Year 1</option>
            <option value="2">Year 2</option>
            <option value="3">Year 3</option>
            <option value="4">Year 4</option>
          </select>

          <select value={programFilter} onChange={e => setProgramFilter(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none">
            <option value="all">All Programs</option>
            <option value="ACT-AD">ACT-AD</option>
            <option value="BSED">BSED</option>
            <option value="BSIS">BSIS</option>
            <option value="BS Nursing">BS Nursing</option>
          </select>

          <select data-testid="select-student-sort" value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="h-10 rounded-lg border border-input bg-background px-3 text-xs font-bold outline-none">
            <option value="name">Sort Alphabetically (Name)</option>
            <option value="studentId">Sort by Student ID</option>
            <option value="yearLevel">Sort by Year Level</option>
            <option value="program">Sort by Program</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        {q.isLoading ? <div className="p-5"><Loading /></div> : q.isError ? <div className="p-5"><ErrorState retry={() => q.refetch()} /></div> : students.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
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
                        <div className="grid size-8 place-items-center rounded-full bg-primary/10 font-mono text-[10px] font-medium text-primary">
                          {s.fullName.split(' ').map(x => x[0]).slice(0,2).join('')}
                        </div>
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
                        <span className="font-mono text-xs text-muted-foreground">Uploads: 0 / 2</span>
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
                      <button
                        title="Remove from certified roster"
                        disabled={deletingId === s.id}
                        onClick={() => handleDeleteStudent(s.id, s.fullName)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                      >
                        <X className="size-3" /> {deletingId === s.id ? 'Removing…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-5"><EmptyState title="No students match search" text="Try a different name, ID, or sort order." /></div>}
      </div>

      {showImport && <ImportDialog onClose={() => setShowImport(false)} onImportSuccess={() => q.refetch()} />}
    </AppShell>
  );
}

function parseStudentRowLine(rawLine: string) {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;

  let tokens: string[] = [];

  if (trimmed.includes('\t')) {
    tokens = trimmed.split('\t').map((t) => t.trim());
  } else if (trimmed.includes(',')) {
    // Respect quoted CSV fields
    const parts: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of trimmed) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { parts.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    parts.push(cur.trim());
    tokens = parts;
  } else {
    tokens = trimmed.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  }

  // Remove empty trailing tokens
  while (tokens.length && !tokens[tokens.length - 1]) tokens.pop();

  if (tokens.length < 2) return null;

  let fullName = '';
  let studentId = '';
  let yearLevel = '1';
  let program: string | null = null;   // null so we detect actual value
  let sex = 'Male';

  // Detect if first row has named headers and map positionally
  // For data rows we use positional mapping if >=4 tokens and no header clue
  // Standard Excel column order assumed: Name, StudentID, Year, Program, Sex
  if (tokens.length >= 4) {
    // Heuristic: if token[1] looks like a student ID (alphanumeric, contains digit), use it
    const maybeId = tokens[1]?.trim();
    if (maybeId && /^[A-Za-z0-9]{4,18}$/.test(maybeId) && /\d/.test(maybeId)) {
      fullName = tokens[0] || '';
      studentId = maybeId;
      yearLevel = tokens[2]?.replace(/[^0-9]/g, '') || '1';
      program = tokens[3]?.trim() || null;
      sex = (tokens[4] || '').toLowerCase().startsWith('f') ? 'Female' : 'Male';
    } else {
      // Try finding student ID by pattern
      const idIdx = tokens.findIndex((t) => /^[A-Za-z0-9-]{4,18}$/.test(t) && /\d/.test(t));
      if (idIdx !== -1) {
        studentId = tokens[idIdx];
        fullName = tokens.slice(0, idIdx).join(' ');
        const remaining = tokens.slice(idIdx + 1);
        for (const tok of remaining) {
          const lower = tok.toLowerCase();
          if (['male', 'female', 'm', 'f'].includes(lower)) {
            sex = lower.startsWith('f') ? 'Female' : 'Male';
          } else if (/^[1-4]$|^[1-4](st|nd|rd|th)?$/i.test(tok)) {
            yearLevel = tok.replace(/[^0-9]/g, '') || '1';
          } else if (tok.length >= 2 && program === null) {
            program = tok;
          }
        }
      } else {
        return null;
      }
    }
  } else {
    const idIdx = tokens.findIndex((t) => /^[A-Za-z0-9-]{4,18}$/.test(t) && /\d/.test(t));
    if (idIdx === -1) return null;
    studentId = tokens[idIdx];
    fullName = tokens.slice(0, idIdx).join(' ');
  }

  fullName = fullName.trim();
  studentId = studentId.trim();

  if (!fullName || !studentId) return null;

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/40 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">Certified Roster Intake</div>
            <h2 className="mt-2 text-xl font-extrabold tracking-[-.04em]">Import Excel (.xlsx) Roster</h2>
          </div>
          <button data-testid="button-close-import" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
            <FileUp className="mx-auto size-8 text-primary" />
            <p className="mt-2 text-xs font-bold">Select Excel file (.xlsx) or CSV</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Columns: Student Name, Student ID, Year Level, Program, Sex</p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
            <Button variant="outline" className="mt-4" onClick={() => fileInputRef.current?.click()}>
              Choose .xlsx File
            </Button>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground">Or paste CSV data below:</label>
            <textarea
              data-testid="input-import-csv"
              value={csvText}
              onChange={(e) => handleCsvChange(e.target.value)}
              placeholder={'Student Name,Student ID,Year Level,Program,Sex\nAhmad Ali,2026-0001,1,ACT-AD,Male\nMaria Santos,2026-0002,2,BSED,Female'}
              className="mt-2 h-28 w-full resize-none rounded-lg border border-input bg-background p-3 font-mono text-[11px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

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

        <div className="mt-6 flex justify-end gap-2">
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
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
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
                  <Settings2 className="size-3.5 text-primary" /> Edit Event
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
                  <GraduationCap className="size-3.5 text-primary" /> Student Passes (ID Card)
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState title="No events created" text="Create an event to generate event QR posters and student ID passes." action={<Button onClick={() => setShowCreate(true)}><Plus className="size-4" />Create Event</Button>} />}

      {showCreate && <EventDialog close={() => setShowCreate(false)} create={create} />}
      {editingEvent && <EditEventDialog event={editingEvent} close={() => setEditingEvent(null)} refetch={() => q.refetch()} />}

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">Event Setup</div>
            <h2 className="mt-1 text-xl font-extrabold">Edit Event &amp; Sessions</h2>
          </div>
          <button onClick={close} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>

        <div className="mt-5 grid gap-4">
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

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button disabled={!name || !date || !venue || isSaving} onClick={submit}>
            {isSaving ? 'Saving Changes…' : 'Save Event Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrintableQrModal({ event, token, onClose }: { event: Event; token: string; onClose: () => void }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4 overflow-y-auto">
      <style>{`
        @page {
          size: letter portrait;
          margin: 0.1in;
        }
      `}</style>
      <div className="w-full max-w-lg rounded-2xl bg-card p-8 shadow-2xl border border-card-border text-center print:border-0 print:shadow-none print:p-0">
        <div className="flex justify-between items-start border-b border-border pb-4 mb-6 print:hidden">
          <div className="text-left">
            <div className="font-mono text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">ZDSPGC – Dimataling Campus</div>
            <h2 className="text-xl font-extrabold text-foreground">Authorized Event QR Code</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
        </div>

        {/* Printable Poster Section */}
        <div className="rounded-2xl border-4 border-primary/20 bg-background p-8 text-center shadow-inner print:border-4 print:border-slate-900 print:bg-white print:p-8">
          <div className="font-mono text-[11px] font-extrabold uppercase tracking-[.2em] text-primary print:text-slate-900">ZDSPGC – DIMATALING CAMPUS</div>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-foreground print:text-slate-900">{event.name}</h1>
          <p className="mt-1 text-xs font-semibold text-muted-foreground print:text-slate-600">{new Date(event.eventDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {event.venue}</p>

          <div className="my-6 inline-block rounded-2xl bg-white p-6 shadow-md border border-gray-200">
            <QRCodeSVG value={token} size={220} level="H" includeMargin />
          </div>

          <div className="rounded-lg bg-primary/10 py-2.5 px-4 font-mono text-[11px] font-extrabold uppercase tracking-[.15em] text-primary print:bg-slate-900 print:text-white">
            SCAN FOR ATTENDANCE
          </div>
          <p className="mt-2 font-mono text-[9px] text-muted-foreground print:text-slate-500">Authorized Event Attendance Token · Officers Scan at Door</p>
        </div>

        <div className="mt-6 flex justify-end gap-3 print:hidden">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint}><Printer className="size-4" /> Print Event QR Poster</Button>
        </div>
      </div>
    </div>
  );
}

function PrintStudentQrCardsModal({ event, token, onClose }: { event: Event; token: string; onClose: () => void }) {
  const studentsQuery = useListStudents();
  const students = studentsQuery.data || [];
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [printAll, setPrintAll] = useState(false);

  const filtered = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase()) ||
      s.program.toLowerCase().includes(search.toLowerCase())
  );

  const activeStudent = selectedStudent || filtered[0] || students[0];

  const handlePrintSingle = () => {
    setPrintAll(false);
    setTimeout(() => window.print(), 50);
  };

  const handlePrintAll = () => {
    setPrintAll(true);
    setTimeout(() => window.print(), 50);
  };

  const studentsToPrint = printAll ? filtered : activeStudent ? [activeStudent] : [];

  return (
    <>
      {/* ON-SCREEN MODAL */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/60 p-4 overflow-y-auto backdrop-blur-sm print:hidden">
        <div className="my-6 w-full max-w-4xl rounded-2xl bg-card p-6 shadow-2xl border border-card-border">
          <div className="flex items-start justify-between border-b border-border pb-4 mb-5">
            <div>
              <div className="font-mono text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">ZDSPGC – Dimataling Campus</div>
              <h2 className="text-xl font-extrabold text-foreground">Student Event QR Pass Generator (ID Card Size)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Generate individual ID card passes formatted for bond paper sheets (0.1in margin).</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
          </div>

          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            {/* Left: Roster List Selector */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student or program..."
                  className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                Certified Roster ({filtered.length})
              </div>

              <div className="max-h-[360px] overflow-y-auto grid gap-1 pr-1 border border-border rounded-xl p-1 bg-muted/20">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudent(s); setPrintAll(false); }}
                    className={`flex items-center justify-between rounded-lg p-2 text-left text-xs transition-colors ${
                      activeStudent?.id === s.id && !printAll ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="truncate min-w-0 pr-2">
                      <div className="truncate font-semibold">{s.fullName}</div>
                      <div className={`text-[10px] font-mono ${activeStudent?.id === s.id && !printAll ? 'opacity-80' : 'text-muted-foreground'}`}>
                        {s.studentId} · {s.program}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono">{s.yearLevel} Yr</span>
                  </button>
                ))}
                {!filtered.length && <div className="p-4 text-center text-xs text-muted-foreground">No matching student found.</div>}
              </div>
            </div>

            {/* Right: Printable ID Card Preview */}
            <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-2xl border border-dashed border-border">
              <div className="mb-4 text-[10px] font-mono font-bold uppercase tracking-widest text-primary">
                ID CARD FORMAT PREVIEW (CR80 Standard)
              </div>

              {activeStudent ? (
                <div className="w-[360px] h-[220px] rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-2xl flex flex-col justify-between relative overflow-hidden text-slate-900">
                  {/* Header ribbon */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                    <div>
                      <div className="font-mono text-[8px] font-black uppercase tracking-widest text-emerald-700">ZDSPGC – DIMATALING CAMPUS</div>
                      <div className="text-[11px] font-black tracking-tight uppercase text-slate-900 truncate max-w-[200px]">{event.name}</div>
                    </div>
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[8px] font-extrabold text-white uppercase">EVENT PASS</span>
                  </div>

                  {/* Body Content */}
                  <div className="my-auto flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[8px] font-bold text-slate-500 uppercase">STUDENT NAME</div>
                      <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 truncate leading-tight">{activeStudent.fullName}</h3>

                      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[9px]">
                        <div>
                          <span className="text-slate-400">ID:</span> <strong className="text-slate-900">{activeStudent.studentId}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">YEAR:</span> <strong className="text-slate-900">Level {activeStudent.yearLevel}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">PROG:</span> <strong className="text-slate-900">{activeStudent.program}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">SEX:</span> <strong className="text-slate-900">{activeStudent.sex}</strong>
                        </div>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="rounded-xl border-2 border-slate-900 bg-white p-1 shadow-sm shrink-0">
                      <QRCodeSVG value={`${token}:${activeStudent.studentId}`} size={75} level="M" />
                    </div>
                  </div>

                  {/* Footer Bar */}
                  <div className="border-t border-slate-200 pt-1 flex items-center justify-between font-mono text-[7px] text-slate-500 uppercase tracking-wider">
                    <span>OFFICIAL STUDENT ATTENDANCE PASS</span>
                    <span>OFFICER SCAN AT DOOR</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Select a student from the list on the left.</div>
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-2 w-full max-w-[380px]">
                <Button variant="ghost" onClick={onClose}>Close</Button>
                <Button variant="outline" onClick={handlePrintSingle} disabled={!activeStudent}>
                  <Printer className="size-3.5" /> Print 1 Card
                </Button>
                <Button onClick={handlePrintAll} disabled={!filtered.length}>
                  <Printer className="size-3.5" /> Print All ({filtered.length})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY CONTAINER (Bond Paper Grid 0.1in margin, 8 cards per page) */}
      <div className="hidden print:block print:fixed print:inset-0 print:z-[9999] print:bg-white print:p-0">
        <style>{`
          @page {
            size: letter portrait;
            margin: 0.1in;
          }
          @media print {
            body * {
              visibility: hidden !important;
            }
            .print-sheet-root, .print-sheet-root * {
              visibility: visible !important;
            }
            .print-sheet-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
            }
            .print-page-wrapper {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin-bottom: 0.2in !important;
              padding: 0 !important;
            }
            .print-page-wrapper:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .print-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 3.4in) !important;
              gap: 0.1in !important;
              justify-content: center !important;
              margin: 0 auto !important;
            }
            .id-card-print {
              width: 3.4in !important;
              height: 2.0in !important;
              box-sizing: border-box !important;
              border: 1.5pt solid #0f172a !important;
              border-radius: 8pt !important;
              padding: 0.08in !important;
              background: white !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
            }
          }
        `}</style>

        <div className="print-sheet-root">
          {(() => {
            const pages: Student[][] = [];
            for (let i = 0; i < studentsToPrint.length; i += 8) {
              pages.push(studentsToPrint.slice(i, i + 8));
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
                          <div className="text-[8.5pt] font-black tracking-tight uppercase text-slate-900 truncate max-w-[2.1in]">{event.name}</div>
                        </div>
                        <span className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[6.5pt] font-black text-white uppercase">EVENT PASS</span>
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
                          <QRCodeSVG value={`${token}:${s.studentId}`} size={62} level="M" />
                        </div>
                      </div>

                      {/* Footer Bar */}
                      <div className="border-t border-slate-200 pt-0.5 flex items-center justify-between font-mono text-[5pt] text-slate-500 uppercase tracking-wider">
                        <span>OFFICIAL STUDENT ATTENDANCE PASS</span>
                        <span>OFFICER SCAN AT DOOR</span>
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
  { name: 'Morning IN',    startTime: '07:00', endTime: '09:00', enabled: true },
  { name: 'Morning OUT',   startTime: '11:00', endTime: '12:00', enabled: true },
  { name: 'Afternoon IN',  startTime: '12:30', endTime: '14:00', enabled: true },
  { name: 'Afternoon OUT', startTime: '16:00', endTime: '17:00', enabled: true },
  { name: 'Evening IN',    startTime: '18:00', endTime: '19:00', enabled: true },
  { name: 'Evening OUT',   startTime: '21:00', endTime: '22:00', enabled: true },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 p-4 overflow-y-auto">
      <div className="my-4 w-full max-w-xl rounded-2xl bg-card p-6 shadow-2xl">
        <div className="flex justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">Event Setup</div>
            <h2 className="mt-2 text-xl font-extrabold">Create New Event</h2>
          </div>
          <button data-testid="button-close-event" onClick={close}><X className="size-4 text-muted-foreground" /></button>
        </div>

        <div className="mt-6 grid gap-4">
          <Field label="Event Name" value={name} onChange={setName} placeholder="e.g. Acquaintance Party 2026" />
          <Field label="Venue" value={venue} onChange={setVenue} placeholder="School Gymnasium" />
          <Field label="Event Date" value={date} onChange={setDate} type="date" />
          <Field label="Description" value={description} onChange={setDescription} placeholder="Brief event description" />
        </div>

        {/* Manual Sessions Builder */}
        <div className="mt-6">
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

          <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
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

        <div className="mt-6 flex justify-end gap-2">
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
  const [session, setSession] = useState('all');
  const q = useListAttendance({ search: search || undefined, session: session === 'all' ? undefined : session });
  const records = q.data || [];
  const present = records.filter(x => x.status === 'present').length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Records / attendance"
        title="Attendance Records"
        description="View and print official attendance records filtered by session, date, or student."
        action={<Button variant="outline" data-testid="button-print-attendance" onClick={() => window.print()}><Printer className="size-4" />Print Attendance Report</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
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

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="input-attendance-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student name, ID, event, or officer..."
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select data-testid="select-attendance-session" value={session} onChange={e => setSession(e.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-bold">
          <option value="all">All Sessions</option>
          <option value="Morning IN">Morning IN</option>
          <option value="Morning OUT">Morning OUT</option>
          <option value="Afternoon IN">Afternoon IN</option>
          <option value="Afternoon OUT">Afternoon OUT</option>
          <option value="Evening IN">Evening IN</option>
          <option value="Evening OUT">Evening OUT</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        {q.isLoading ? <div className="p-5"><Loading /></div> : q.isError ? <div className="p-5"><ErrorState retry={() => q.refetch()} /></div> : records.length ? (
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
        ) : <div className="p-5"><EmptyState title="No attendance records" text="Scanned student attendances will appear here." /></div>}
      </div>
    </AppShell>
  );
}

function Officers() {
  const q = useListOfficers();
  const create = useCreateOfficer();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [email, setEmail] = useState('');

  const submit = () => create.mutate({ data: { officerId: id, fullName: name, email } }, { onSuccess: () => { setOpen(false); setName(''); setId(''); setEmail(''); queryClient.invalidateQueries({ queryKey: getListOfficersQueryKey() }); } });

  return (
    <AppShell>
      <PageHeader eyebrow="Access / officers" title="Officer Management" description="Manage authorized attendance officers responsible for identity verification." action={<Button data-testid="button-open-add-officer" onClick={() => setOpen(true)}><UserPlus className="size-4" />Add Officer</Button>} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : (
        <div className="grid gap-3">
          {(q.data || []).length ? (q.data || []).map(o => (
            <div data-testid={`row-officer-${o.id}`} key={o.id} className="flex items-center gap-4 rounded-xl border border-card-border bg-card p-4">
              <div className="grid size-10 place-items-center rounded-full bg-accent/15 font-mono text-[11px] font-medium text-accent">
                {o.fullName.split(' ').map(x => x[0]).slice(0,2).join('')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{o.fullName}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{o.officerId} · {o.email}</div>
              </div>
              <Badge tone={o.status === 'active' ? 'success' : 'neutral'}>{o.status}</Badge>
            </div>
          )) : <EmptyState title="No officers registered" text="Add an officer account to grant scanning access." />}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl">
            <div className="flex justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">Access Control</div>
                <h2 className="mt-2 text-xl font-extrabold">Add Officer</h2>
              </div>
              <button data-testid="button-close-officer" onClick={() => setOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="mt-6 grid gap-4">
              <Field label="Officer ID" value={id} onChange={setId} placeholder="OFF-01" />
              <Field label="Full Name" value={name} onChange={setName} placeholder="Officer Name" />
              <Field label="Email" value={email} onChange={setEmail} placeholder="officer@zdspgc.edu.ph" />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="button-submit-officer" disabled={!id || !name || !email || create.isPending} onClick={submit}>
                {create.isPending ? 'Adding…' : 'Add Officer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SettingsPage() {
  const q = useGetSettings();
  const update = useUpdateSettings();
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
      setDupe(s.duplicateProtection ?? true);
      setConfirm(s.attendanceConfirmation ?? true);
    }
  }, [s]);

  const save = () =>
    update.mutate({
      data: {
        schoolName: school,
        campusName: campus,
        automaticSessions: auto,
        duplicateProtection: dupe,
        attendanceConfirmation: confirm,
        ...( { lateThresholdMinutes: lateThreshold } as Record<string, unknown> ),
      },
    });

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
  
  const [token, setToken] = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [candidate, setCandidate] = useState<Awaited<ReturnType<typeof useScanAttendance>>['data']>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [lastScan, setLastScan] = useState<{ name: string; id: string; session: string; status: string; time: string } | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [soundEnabled] = useState(true);
  // Prevent double-scan while modal is open or request in-flight
  const isScanLocked = useRef(false);

  const records = listAttendance.data || [];
  const students = studentsQuery.data || [];
  const activeEvent = eventsQuery.data?.find((e) => e.status === 'active') || eventsQuery.data?.[0];

  const totalScans = records.length;
  const presentScans = records.filter(r => r.status === 'present').length;
  const lateScans = records.filter(r => r.status === 'late').length;

  // Auto-fill active event token on page load
  useEffect(() => {
    if (activeEvent && !token) {
      generateQrMutation.mutate(
        { eventId: activeEvent.id },
        {
          onSuccess: (res) => {
            setToken(res.token);
          },
        }
      );
    }
  }, [activeEvent, token]);

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-amber-500">📷</span>
            <h1 className="text-2xl font-black tracking-tight text-foreground font-serif">Event QR Scanner</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Scan student QR codes to record event attendance in real-time</p>
        </div>
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
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Event QR Token</label>
                  {activeEvent && <span className="text-[9px] font-mono text-emerald-700 font-bold">Auto-Loaded: {activeEvent.name}</span>}
                </div>
                <input
                  data-testid="input-event-qr-token"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Scan or paste Event QR token"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium outline-none focus:border-primary"
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
                <div className="mt-5 flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="grid size-12 place-items-center rounded-full bg-amber-100 text-amber-600">
                    <Clock3 className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-foreground">{lastScan.name}</h3>
                    <p className="text-xs font-bold text-muted-foreground">{lastScan.id} · {lastScan.session}</p>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-semibold text-foreground">📅 {lastScan.session}</span>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700">{lastScan.status}</span>
                      <span className="text-muted-foreground">{lastScan.time}</span>
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