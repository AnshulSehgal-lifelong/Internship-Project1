"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import ActivityLogs from "./ActivityLogs";
import { useAuth } from "@/components/auth-context";

export default function ActivityLogsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && (user.role || "") !== "Administrator") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null;
  }

  if ((user.role || "") !== "Administrator") {
    return null;
  }
  return <ActivityLogs />;
}