"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (formData: FormData) => Promise<void>;
  logout: () => void;
}



const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function loadUser() {
      const token = sessionStorage.getItem("token") ?? localStorage.getItem("token");
      if (token) {
        api.setToken(token);
        try {
          const userData = await api.get<User>("/auth/me");
          setUser(userData ?? null);
        } catch (error) {
          console.error("Failed to load user:", error);
          api.setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const isPublicPage = pathname === "/login";
      if (!user && !isPublicPage) {
        router.push("/login");
      } else if (user && isPublicPage) {
        router.push("/dashboard");
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = async (formData: FormData) => {
    const data = await api.login(formData);
    api.setToken(data.access_token);
    const userData = await api.get<User>("/auth/me");
    setUser(userData ?? null);
    router.push("/dashboard");
  };



  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Failed to logout on backend:", err);
    } finally {
      api.setToken(null);
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
