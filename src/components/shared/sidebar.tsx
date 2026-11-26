"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  User,
  LifeBuoy,
  FileText,
  Smartphone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AppView } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const navItems = [
  { view: "dashboard" as AppView, icon: LayoutDashboard, label: "Dashboard" },
  { view: "wallet" as AppView, icon: Wallet, label: "Wallet" },
  { view: "account" as AppView, icon: User, label: "Account" },
  { view: "mobile" as AppView, icon: Smartphone, label: "Mobile App" },
  { view: "help" as AppView, icon: LifeBuoy, label: "Support" },
  { view: "terms" as AppView, icon: FileText, label: "Legal" },
];

export function Sidebar({ isOpen, currentView, onNavigate }: SidebarProps) {
  const isMobile = useIsMobile();
  if (isMobile) return null;

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r bg-card text-card-foreground transition-all duration-300 ease-in-out",
        isOpen ? "w-56" : "w-16"
      )}
    >
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.view}>
              <Button
                variant={currentView === item.view ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  !isOpen && "justify-center"
                )}
                onClick={() => onNavigate(item.view)}
              >
                <item.icon className="h-5 w-5" />
                {isOpen && <span className="ml-3">{item.label}</span>}
              </Button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
