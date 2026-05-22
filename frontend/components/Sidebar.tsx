"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Building2,
  ClipboardList,
  UserCheck,
  History,
  BookOpen, 
  Settings, 
  ChevronRight,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth-context";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Activity Logs", href: "/activity-logs", icon: History },
  { name: "Employee Directory", href: "/employee-directory", icon: Users },
  { name: "Departments", href: "/departments", icon: Building2 },
  { name: "My Department", href: "/my-department", icon: UserCheck },
  { name: "Recruitment", href: "/recruitment", icon: UserPlus },
  { name: "Tasks", href: "/tasks", icon: ClipboardList },
  { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
  { name: "System", href: "/system", icon: Settings },
];

const HR_DEPARTMENTS = new Set(["hr", "human resources"]);

function isHrDepartment(name?: string | null) {
  if (!name) return false;
  return HR_DEPARTMENTS.has(name.trim().toLowerCase());
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const initials = user
    ? `${(user.first_name?.[0] ?? "").toUpperCase()}${(user.last_name?.[0] ?? "").toUpperCase()}` || "??"
    : "??";

  const visibleItems = React.useMemo(() => {
    if (!user) return [];
    const role = user.role || "";
    const isAdmin = role === "Administrator";
    const isHrManager = role === "Manager" && isHrDepartment(user.department_name);
    const namesToSkip = new Set(['Tasks', 'My Department']);
    if (isAdmin) return navItems.filter(item => !namesToSkip.has(item.name));
    if (isHrManager) {
      return navItems.filter(i => ["Employee Directory", "Recruitment", "Knowledge Base", "Dashboard", "Tasks", "My Department"].includes(i.name));
    }
    // other employees: only Knowledge Base and dashboard
    return navItems.filter(i => ["Knowledge Base", "Dashboard", "Tasks", "My Department"].includes(i.name)).concat([{ name: "Profile", href: "/profile", icon: Users }]);
  }, [user]);

  return (
    <aside className="w-64 h-full border-r border-border bg-card/50 backdrop-blur-xl flex flex-col">
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">TalentFlow</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">HR Module</p>
          </div>
        </div>

        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative",
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon size={20} className={cn("transition-transform duration-200 group-hover:scale-110", isActive ? "text-primary" : "")} />
                <span className="font-medium text-sm">{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {isActive && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-border">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
