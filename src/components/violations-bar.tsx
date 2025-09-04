"use client";

import React from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Info, XCircle, ChevronRight } from "lucide-react";

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
        return 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300';
      default:
        return 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300';
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
      <div className="px-4 py-3">
        {/* Summary Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-gray-900">
              {violations.length} compliance issue{violations.length !== 1 ? 's' : ''} found
            </span>
            <div className="flex items-center gap-2 text-sm">
              {violationCounts.CRITICAL && (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full">
                  {violationCounts.CRITICAL} Critical
                </span>
              )}
              {violationCounts.HIGH && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
                  {violationCounts.HIGH} High
                </span>
              )}
              {violationCounts.MEDIUM && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                  {violationCounts.MEDIUM} Medium
                </span>
              )}
              {violationCounts.LOW && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {violationCounts.LOW} Low
                </span>
              )}
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Click on an issue to navigate to its location
          </div>
        </div>

        {/* Horizontal Scrolling Violations */}
        <div className="overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {violations.map((violation, index) => (
              <button
                key={violation.id || index}
                onClick={() => onViolationClick(violation, index)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                  getSeverityColor(violation.severity || 'MEDIUM'),
                  "cursor-pointer group"
                )}
              >
                {getSeverityIcon(violation.severity || 'MEDIUM')}
                <div className="flex flex-col items-start text-left">
                  <span className="font-medium text-sm whitespace-nowrap">
                    {violation.type || `Issue ${index + 1}`}
                  </span>
                  <span className="text-xs opacity-75 max-w-[200px] truncate">
                    {violation.description}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
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