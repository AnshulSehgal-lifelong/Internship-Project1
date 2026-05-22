"use client";

import React from "react";
import {
  Users,
  Briefcase,
  FileText,
  TrendingUp,
  ArrowUpRight,
  History,
  UserCheck,
  Clock,
  Plus,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-context";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardCard {
  name: string;
  value: number | string;
  icon: string;
  bg: string;
  color: string;
  change: string;
  href?: string;
}

interface RecentActivity {
  id: number;
  initials: string;
  user: string;
  action: string;
  time: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Users,
  Briefcase,
  FileText,
  UserCheck,
};

const QUICK_LINKS = [
  { title: "Activity Logs", desc: "Review the full activity feed", icon: History, href: "/activity-logs" },
  { title: "Company Handbook", desc: "View all policies", icon: FileText, href: "/knowledge-base" },
  { title: "Open Openings", desc: "Manage job posts", icon: Briefcase, href: "/recruitment" },
  { title: "Team Directory", desc: "Browse employees", icon: Users, href: "/employee-directory" },
];

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  show: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ stat }: { stat: DashboardCard }) {
  const router = useRouter();
  const Icon = ICON_MAP[stat.icon] ?? Users;

  return (
    <motion.div
      variants={cardVariants}
      onClick={stat.href ? () => router.push(stat.href!) : undefined}
      role={stat.href ? "button" : undefined}
      tabIndex={stat.href ? 0 : undefined}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-200",
        stat.href && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"
      )}
    >
      {/* Subtle background accent */}
      <div className={cn("absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10 blur-2xl", stat.bg)} />

      <div className="flex items-start justify-between">
        <div className={cn("rounded-xl p-2.5", stat.bg)}>
          <Icon className={stat.color} size={20} />
        </div>
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
          <TrendingUp size={10} />
          {stat.change}
        </span>
      </div>

      <div className="mt-5">
        <p className="text-sm text-muted-foreground">{stat.name}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{stat.value}</p>
      </div>
    </motion.div>
  );
}

function ActivityRow({ act }: { act: RecentActivity }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/activity-logs")}
      className="flex w-full items-center gap-4 border-b border-border/60 px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-secondary/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
        {act.initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {act.user}{" "}
          <span className="font-normal text-muted-foreground">{act.action}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={11} />
          {act.time}
        </p>
      </div>
      <ArrowUpRight size={14} className="shrink-0 text-muted-foreground/40" />
    </button>
  );
}

function QuickLink({ link }: { link: typeof QUICK_LINKS[number] }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(link.href)}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-secondary/40"
    >
      <div className="rounded-lg bg-secondary p-2.5 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <link.icon size={18} />
      </div>
      <div>
        <p className="text-sm font-semibold">{link.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{link.desc}</p>
      </div>
    </button>
  );
}

// ─── Loading / Error states ───────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4 text-destructive">
        <AlertCircle size={40} />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Connection error</h3>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = React.useState<DashboardCard[]>([]);
  const [activity, setActivity] = React.useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function loadData() {
      try {
        const data = await api.get<{
          employeeCount: number;
          departmentCount: number;
          jobCount: number;
          recentActivity: RecentActivity[];
        }>("/dashboard/summary");

        const employeeCount = data?.employeeCount ?? 0;
        const departmentCount = data?.departmentCount ?? 0;
        const jobCount = data?.jobCount ?? 0;

        setStats([
          { name: "Employees", value: employeeCount, icon: "Users", bg: "bg-blue-500/10", color: "text-blue-500", change: `${employeeCount} total`, href: "/employee-directory" },
          { name: "Departments", value: departmentCount, icon: "Briefcase", bg: "bg-violet-500/10", color: "text-violet-500", change: `${departmentCount} managed`, href: "/departments" },
          { name: "Open Jobs", value: jobCount, icon: "FileText", bg: "bg-emerald-500/10", color: "text-emerald-500", change: `${jobCount} openings`, href: "/recruitment" },
          { name: "Welcome", value: user?.first_name ?? "HR", icon: "UserCheck", bg: "bg-amber-500/10", color: "text-amber-500", change: "Signed in" },
        ]);
        setActivity(data?.recentActivity ?? []);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Could not connect to the backend server.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [authLoading, user, user?.first_name]);

  if (authLoading || isLoading) return <LoadingState />;
  if (!user) return null;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Overview</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight">
            Welcome back, {user?.first_name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A quick view of the current workforce and recruiting pipeline.
          </p>
        </div>

        {user?.role === "Administrator" && (
          <button
            onClick={() => router.push("/employee-directory")}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus size={16} />
            New hire
          </button>
        )}
      </div>

      {/* Stat cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.length > 0 ? (
          stats.map((stat) => <StatCard key={stat.name} stat={stat} />)
        ) : (
          <div className="col-span-full rounded-2xl border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No statistics available.
          </div>
        )}
      </motion.div>

      {/* Lower section */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Recent activity</h3>
            {activity.length > 0 && (
              <button
                onClick={() => router.push("/activity-logs")}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all <ArrowUpRight size={12} />
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {activity.length > 0 ? (
              activity.map((act) => <ActivityRow key={act.id} act={act} />)
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock size={28} className="mb-2 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="space-y-4">
          <h3 className="font-semibold">Quick links</h3>
          <div className="flex flex-col gap-3">
            {QUICK_LINKS.map((link) => (
              <QuickLink key={link.title} link={link} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}