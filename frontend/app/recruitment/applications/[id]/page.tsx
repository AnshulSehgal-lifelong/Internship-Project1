"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Applications from "./Applications";
import { useAuth } from "@/components/auth-context";

export default function ApplicationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      const role = user.role || "";
      const departmentName = user.department_name ?? null;
      const isAdmin = role === "Administrator";
      const isHrManager = role === "Manager" && ["hr", "human resources"].includes(departmentName?.trim().toLowerCase() ?? "");
      if (!isAdmin && !isHrManager) {
        router.replace("/dashboard");
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null;
  }

  const role = user.role || "";
  const departmentName = user.department_name ?? null;
  const isAdmin = role === "Administrator";
  const isHrManager = role === "Manager" && ["hr", "human resources"].includes(departmentName?.trim().toLowerCase() ?? "");
  if (!isAdmin && !isHrManager) {
    return null;
  }

  return <Applications />;
}
