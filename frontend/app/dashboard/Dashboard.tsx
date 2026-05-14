"use client";

import React from "react";
import { 
  Users, 
  Briefcase, 
  FileText, 
  TrendingUp, 
  ArrowUpRight,
  UserCheck,
  Clock,
  Plus,
  AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-context";
import { useRouter } from "next/navigation";

interface EmployeeRecord {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  role?: string | null;
  hire_date?: string | null;
}

interface DashboardCard {
  name: string;
  value: number | string;
  icon: string;
  bg: string;
  color: string;
  change: string;
}

interface RecentActivity {
  id: number;
  initials: string;
  user: string;
  action: string;
  time: string;
}

const container = {
  show: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Users,
  Briefcase,
  FileText,
  UserCheck
};

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = React.useState<DashboardCard[]>([]);
  const [activity, setActivity] = React.useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [employees, departments, jobs] = await Promise.all([
          api.get<EmployeeRecord[]>("/employees"),
          api.get<{ id: number }[]>("/departments"),
          api.get<{ id: number }[]>("/job-openings")
        ]);
        const employeeCount = employees.length;
        const departmentCount = departments.length;
        const jobCount = jobs.length;
        setStats([
          { name: "Employees", value: employeeCount, icon: "Users", bg: "bg-blue-500/10", color: "text-blue-500", change: `${employeeCount} total` },
          { name: "Departments", value: departmentCount, icon: "Briefcase", bg: "bg-violet-500/10", color: "text-violet-500", change: `${departmentCount} active` },
          { name: "Open Jobs", value: jobCount, icon: "FileText", bg: "bg-emerald-500/10", color: "text-emerald-500", change: `${jobCount} openings` },
          { name: "Welcome", value: user?.first_name || "HR", icon: "UserCheck", bg: "bg-amber-500/10", color: "text-amber-500", change: "Signed in" },
        ]);
        setActivity(employees.slice(0, 5).map((employee, index) => ({
          id: employee.id,
          initials: `${employee.first_name?.[0] || employee.name?.[0] || "E"}${employee.last_name?.[0] || ""}`,
          user: `${employee.first_name || employee.name} ${employee.last_name || ""}`.trim(),
          action: `joined the ${employee.role || "team"}`,
          time: employee.hire_date || `Recent hire #${index + 1}`,
        })));
        setError(null);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Could not connect to the backend server.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <AlertCircle size={48} />
        </div>
        <div>
          <h3 className="text-xl font-bold">Connection Error</h3>
          <p className="text-muted-foreground mt-1">{error}</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back, {user?.first_name}</h2>
          <p className="text-muted-foreground mt-1">Here is what&apos;s happening with your workforce today.</p>
        </div>
        <button onClick={() => router.push("/employee-directory")} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
          <Plus size={20} />
          <span>New Hire</span>
        </button>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {stats.length > 0 ? stats.map((stat) => {
          const Icon = ICON_MAP[stat.icon] || Users;
          return (
            <motion.div
              key={stat.name}
              variants={item}
              className="p-6 rounded-2xl bg-card border border-border hover:shadow-xl hover:shadow-primary/5 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className={cn("p-3 rounded-xl", stat.bg)}>
                  <Icon className={stat.color} size={24} />
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                  <TrendingUp size={12} />
                  <span>{stat.change}</span>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
              </div>
            </motion.div>
          );
        }) : (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-border rounded-3xl">
            <p className="text-muted-foreground">No statistics available.</p>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Recent Activity</h3>
            {activity.length > 0 && (
              <button className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                View all <ArrowUpRight size={14} />
              </button>
            )}
          </div>
          
          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden min-h-[200px]">
            {activity.length > 0 ? activity.map((act) => (
              <div key={act.id} className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors border-b border-border last:border-0">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                  {act.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {act.user}
                    <span className="font-normal text-muted-foreground"> {act.action}</span>
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock size={12} />
                    {act.time}
                  </p>
                </div>
                <button className="px-3 py-1 text-xs font-medium border border-border rounded-lg hover:bg-secondary transition-colors">
                  Review
                </button>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                <Clock size={32} className="text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No recent activity found.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold">Quick Links</h3>
          <div className="grid grid-cols-1 gap-4">
            {[
              { title: "Company Handbook", desc: "View all policies", icon: FileText },
              { title: "Open Openings", desc: "Manage job posts", icon: Briefcase },
              { title: "Team Directory", desc: "Browse employees", icon: Users },
            ].map((link) => (
              <button key={link.title} className="flex items-start gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-secondary/50 transition-all text-left group">
                <div className="p-2.5 rounded-xl bg-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <link.icon size={20} />
                </div>
                <div>
                  <p className="font-semibold text-sm">{link.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
