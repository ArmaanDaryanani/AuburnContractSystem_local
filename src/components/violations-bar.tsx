"use client";

import React from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Info, XCircle } from "lucide-react";

interface ViolationsBarProps {
  violations: ViolationDetail[];
  onViolationClick: (violation: ViolationDetail, index: number) => void;
  className?: string;
}

export function ViolationsBar({ violations, onViolationClick, className }: ViolationsBarProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <XCircle className="h-4 w-4" />;
      case 'HIGH':
        return <AlertCircle className="h-4 w-4" />;
      case 'MEDIUM':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      default:
        return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  // Group violations by severity for summary
  const violationCounts = violations.reduce((acc, v) => {
    const severity = v.severity?.toUpperCase() || 'LOW';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (violations.length === 0) {
    return null;
  }

  return (
    <div className={cn("bg-white border-b border-gray-200", className)}>
      <div className="px-4 py-2">
        {/* Minimal Summary Header */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-gray-900">
            {violations.length} compliance issues found
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            {violationCounts.CRITICAL && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                {violationCounts.CRITICAL} Critical
              </span>
            )}
            {violationCounts.HIGH && (
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                {violationCounts.HIGH} High
              </span>
            )}
            {violationCounts.MEDIUM && (
              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                {violationCounts.MEDIUM} Medium
              </span>
            )}
            {violationCounts.LOW && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                {violationCounts.LOW} Low
              </span>
            )}
          </div>
        </div>

        {/* Minimal Horizontal Scrolling Cards */}
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-2">
            {violations.map((violation, index) => (
              <button
                key={violation.id || index}
                onClick={() => onViolationClick(violation, index)}
                className={cn(
                  "flex-shrink-0 w-[180px] h-[60px] px-2.5 py-2 rounded-md border",
                  getSeverityColor(violation.severity || 'MEDIUM'),
                  "cursor-pointer"
                )}
              >
                <div className="flex items-center gap-2 h-full">
                  {getSeverityIcon(violation.severity || 'MEDIUM')}
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="font-medium text-xs truncate">
                      {violation.type || `Issue ${index + 1}`}
                    </div>
                    <div className="text-xs opacity-75 truncate">
                      {violation.description?.substring(0, 40)}...
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Custom scrollbar styling */
        .overflow-x-auto::-webkit-scrollbar {
          height: 6px;
        }
        
        .overflow-x-auto::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 3px;
        }
        
        .overflow-x-auto::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        
        .overflow-x-auto::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
}