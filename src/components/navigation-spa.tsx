"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  FileText,
  FolderOpen,
  BarChart3,
  Scale,
  Shield,
  Database,
} from "lucide-react";

export type ViewType = 
  | "contract-review" 
  | "batch-audit" 
  | "metrics" 
  | "far-matrix" 
  | "auburn-policies" 
  | "knowledge-base";

const navigation = [
  {
    name: "Contract Review",
    id: "contract-review" as ViewType,
    icon: FileText,
  },
  {
    name: "Batch Audit",
    id: "batch-audit" as ViewType,
    icon: FolderOpen,
  },
  {
    name: "FAR Matrix",
    id: "far-matrix" as ViewType,
    icon: Scale,
  },
  {
    name: "Auburn Policies",
    id: "auburn-policies" as ViewType,
    icon: Shield,
  },
  {
    name: "Metrics",
    id: "metrics" as ViewType,
    icon: BarChart3,
  },
  {
    name: "Knowledge Base + RAG",
    id: "knowledge-base" as ViewType,
    icon: Database,
  },
];

interface NavigationSPAProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function NavigationSPA({ currentView, onViewChange }: NavigationSPAProps) {
  return (
    <div className="flex h-full w-56 flex-col border-r border-gray-100 bg-gray-50/50">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded flex items-center justify-center bg-[#03244d] p-1">
            <Image 
              src="/auburn-logo.svg" 
              alt="Auburn Logo" 
              width={32} 
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-sm font-semibold text-gray-900">Auburn CR</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-0.5">
          {navigation.map((item) => {
            const isActive = currentView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all duration-150",
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-4">
        <div className="text-xs text-gray-500 space-y-0.5">
          <div>Armaan Daryanani</div>
          <div>v2.0 MVP</div>
          <div>© Auburn University</div>
        </div>
      </div>
    </div>
  );
}