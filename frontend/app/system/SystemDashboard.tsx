"use client";

import React from "react";
import { 
  Activity, 
  Terminal, 
  Globe,
  ExternalLink,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface ServiceStatus {
  name: string;
  status: string;
  latency: string;
  icon: "Globe" | "Activity";
  bg: string;
  color: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Globe,
  Activity
};

export default function SystemDashboard() {
  const [services, setServices] = React.useState<ServiceStatus[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadHealth = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<{ status: string }>("/health");
      setServices([
        {
          name: "API",
          status: data.status === "healthy" ? "Operational" : "Degraded",
          latency: "<50ms",
          icon: "Globe",
          bg: "bg-emerald-500/10",
          color: "text-emerald-500",
        },
      ]);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch system health:", err);
      setError("Backend connection timed out.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        void loadHealth();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadHealth]);

  if (isLoading && services.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Status</h2>
          <p className="text-muted-foreground mt-1">Monitor backend health and API performance.</p>
        </div>
        <button 
          onClick={loadHealth}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg font-medium hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>

      {error ? (
        <div className="p-20 text-center border-2 border-dashed border-destructive/20 bg-destructive/5 rounded-3xl">
          <AlertCircle size={48} className="text-destructive mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold">System Health Offline</h3>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <button 
            onClick={loadHealth}
            className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, idx) => {
            const Icon = ICON_MAP[service.icon] || Globe;
            return (
              <motion.div
                key={service.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 rounded-3xl border border-border bg-card shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-2.5 rounded-xl", service.bg || "bg-secondary", service.color || "text-foreground")}>
                    <Icon size={20} />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-secondary rounded-lg">{service.latency}</span>
                </div>
                <h4 className="font-bold text-sm">{service.name}</h4>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full", service.status === "Operational" ? "bg-emerald-500" : "bg-blue-500")}></div>
                  <p className="text-xs text-muted-foreground">{service.status}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-8 rounded-3xl border border-border bg-card flex items-start gap-6">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-primary shrink-0">
              <Terminal size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold">OpenAPI Documentation</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Our backend exposes a comprehensive RESTful API. Explore endpoints and try out live requests.
              </p>
              <div className="mt-6">
                <a 
                  href="http://localhost:8000/docs" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg shadow-primary/20"
                >
                  <ExternalLink size={18} />
                  <span>Open Swagger UI</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
