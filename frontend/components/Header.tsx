"use client";

import React from "react";
import { Search, Bell, Moon, Sun, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Header() {
  const [isDark, setIsDark] = React.useState(false);

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" size={18} />
          <input 
            type="text" 
            placeholder="Search employees, documents, or candidates..." 
            className="w-full h-10 pl-10 pr-4 rounded-full bg-secondary border-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="h-5 px-1.5 rounded border border-border bg-background text-[10px] font-medium text-muted-foreground flex items-center">
              ⌘
            </kbd>
            <kbd className="h-5 px-1.5 rounded border border-border bg-background text-[10px] font-medium text-muted-foreground flex items-center">
              K
            </kbd>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 ml-8">
        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
        </button>
        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
          <HelpCircle size={20} />
        </button>
        <div className="w-px h-6 bg-border mx-1"></div>
        <button 
          onClick={toggleDarkMode}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
}
