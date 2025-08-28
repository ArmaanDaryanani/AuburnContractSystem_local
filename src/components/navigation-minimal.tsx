"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText,
  FolderOpen,
  BarChart3,
  Scale,
  Shield,
  Database,
} from "lucide-react";

const navigation = [
  {
    name: "Contract Review",
    href: "/",
    icon: FileText,
  },
  {
    name: "Batch Audit",
    href: "/batch-audit",
    icon: FolderOpen,
  },
  {
    name: "Metrics",
    href: "/metrics",
    icon: BarChart3,
  },
  {
    name: "FAR Matrix",
    href: "/far-matrix",
    icon: Scale,
  },
  {
    name: "Auburn Policies",
    href: "/auburn-policies",
    icon: Shield,
  },
  {
    name: "Knowledge Base",
    href: "/knowledge-base",
    icon: Database,
  },
];

export function NavigationMinimal() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-56 flex-col border-r border-gray-100 bg-gray-50/50">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gray-900 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-900">Auburn CR</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-4">
        <div className="text-xs text-gray-500 space-y-0.5">
          <div>v2.0 MVP</div>
          <div>© Auburn University</div>
        </div>
      </div>
    </div>
  );
}