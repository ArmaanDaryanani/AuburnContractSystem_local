"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  FileSearch,
  FolderOpen,
  BookOpen,
  Shield,
  Database,
  FileText,
  Scale,
  AlertTriangle,
} from "lucide-react";

const navigation = [
  {
    name: "Contract Review",
    href: "/contract-review",
    icon: FileSearch,
    description: "AI-powered contract compliance analysis",
    badge: "AI",
  },
];

export function NavigationSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-bold">Auburn Contract Review</span>
            <span className="text-xs text-muted-foreground">AI-Powered Compliance</span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col gap-1 rounded-md px-3 py-3 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {item.badge && (
                    <Badge variant={isActive ? "secondary" : "outline"} className="text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground ml-6">
                  {item.description}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Status Footer */}
      <div className="border-t p-4">
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Compliance Engine</span>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="text-xs">Active</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">FAR Checks</span>
                <span className="font-mono">5 Active</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Auburn Rules</span>
                <span className="font-mono">4 Active</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">TF-IDF Model</span>
                <span className="font-mono">85% Conf</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}