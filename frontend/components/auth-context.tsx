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
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
}

interface SignupData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const userData = await api.get<User>("/auth/me");
          setUser(userData);
        } catch (error) {
          console.error("Failed to load user:", error);
          localStorage.removeItem("token");
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const isPublicPage = pathname === "/login" || pathname === "/signup";
      if (!user && !isPublicPage) {
        router.push("/login");
      } else if (user && isPublicPage) {
        router.push("/dashboard");
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = async (formData: FormData) => {
    const data = await api.login(formData);
    localStorage.setItem("token", data.access_token);
    const userData = await api.get<User>("/auth/me");
    setUser(userData);
    router.push("/dashboard");
  };

  const signup = async (signupData: SignupData) => {
    await api.signup(signupData);
    // After signup, automatically login
    const formData = new FormData();
    formData.append("username", signupData.email);
    formData.append("password", signupData.password);
    await login(formData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
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
