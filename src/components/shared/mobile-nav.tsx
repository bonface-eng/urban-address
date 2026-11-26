"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Wallet, User, Bot, BrainCircuit } from "lucide-react";
import type { AppView } from "@/lib/types";

interface MobileNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenBot: () => void;
}

const navItems = [
  { view: "dashboard" as AppView, icon: LayoutDashboard, label: "Trade" },
  { view: "wallet" as AppView, icon: Wallet, label: "Wallet" },
  { view: "account" as AppView, icon: User, label: "Account" },
];

export function MobileNav({ currentView, onNavigate, onOpenBot }: MobileNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border md:hidden z-50">
      <div className="flex h-full items-center justify-around">
        {navItems.map((item) => (
          <Button
            key={item.view}
            variant="ghost"
            className={cn(
              "flex flex-col h-full rounded-none px-2 text-muted-foreground",
              currentView === item.view && "text-primary"
            )}
            onClick={() => onNavigate(item.view)}
          >
            <item.icon className="h-5 w-5 mb-1" />
            <span className="text-xs">{item.label}</span>
          </Button>
        ))}
         <Button
            variant="ghost"
            className="flex flex-col h-full rounded-none px-2 text-muted-foreground"
            onClick={onOpenBot}
          >
            <Bot className="h-5 w-5 mb-1" />
            <span className="text-xs">Bot</span>
          </Button>
      </div>
    </div>
  );
}
