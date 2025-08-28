"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileSearch,
  Home,
  BarChart3,
  Settings,
  Shield,
  Activity,
  FileStack,
  CheckSquare,
  TrendingUp,
  AlertCircle,
  Database,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Contract Review", href: "/contract-review", icon: FileSearch },
  { name: "Batch Processing", href: "/batch", icon: FileStack },
  { name: "Compliance", href: "/compliance", icon: Shield },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Activity Log", href: "/activity", icon: Activity },
];

const secondary = [
  { name: "Knowledge Base", href: "/knowledge", icon: Database },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Shield className="h-6 w-6" />
        <span className="ml-2 text-lg font-semibold">Auburn CR</span>
        <Badge variant="outline" className="ml-auto text-[10px]">
          PRO
        </Badge>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <Separator className="my-4" />

        <nav className="space-y-1 px-3">
          {secondary.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Stats */}
      <div className="border-t p-4">
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-600" />
              <span className="text-xs text-muted-foreground">System Status</span>
            </div>
            <span className="text-xs font-medium">Operational</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Today</span>
              <p className="font-semibold">127 reviews</p>
            </div>
            <div>
              <span className="text-muted-foreground">Accuracy</span>
              <p className="font-semibold">94.2%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}