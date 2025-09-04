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
  // Remove duplicate violations based on description similarity but keep original indices
  const uniqueViolationsWithIndex = violations.reduce((acc, violation, originalIndex) => {
    const isDuplicate = acc.some(v => 
      v.violation.description?.substring(0, 30) === violation.description?.substring(0, 30) ||
      (v.violation.type === violation.type && v.violation.severity === violation.severity && 
       v.violation.description?.substring(0, 20) === violation.description?.substring(0, 20))
    );
    if (!isDuplicate) {
      acc.push({ violation, originalIndex });
    }
    return acc;
  }, [] as Array<{ violation: ViolationDetail, originalIndex: number }>);
  
  const getSeverityIcon = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <XCircle className="h-3.5 w-3.5" />;
      case 'HIGH':
        return <AlertCircle className="h-3.5 w-3.5" />;
      case 'MEDIUM':
        return <AlertTriangle className="h-3.5 w-3.5" />;
      default:
        return <Info className="h-3.5 w-3.5" />;
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
  const violationCounts = uniqueViolationsWithIndex.reduce((acc, item) => {
    const severity = item.violation.severity?.toUpperCase() || 'LOW';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (uniqueViolationsWithIndex.length === 0) {
    return null;
  }

  return (
    <div className={cn("bg-white border-b border-gray-200", className)}>
      <div className="px-4 py-1">
        {/* Minimal Summary Header */}
        <div className="flex items-center justify-center gap-3 mb-1">
          <span className="text-xs font-medium text-gray-900">
            {uniqueViolationsWithIndex.length} issues
          </span>
          <div className="flex items-center gap-1 text-xs">
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
          <div className="flex gap-2 justify-center px-2">
            {uniqueViolationsWithIndex.map((item, idx) => (
              <button
                key={item.violation.id || `${item.violation.type}_${idx}`}
                onClick={() => onViolationClick(item.violation, item.originalIndex)}
                className={cn(
                  "flex-shrink-0 w-[220px] h-[40px] px-2.5 py-1.5 rounded-md border",
                  getSeverityColor(item.violation.severity || 'MEDIUM'),
                  "cursor-pointer"
                )}
              >
                <div className="flex items-center gap-2 h-full">
                  {getSeverityIcon(item.violation.severity || 'MEDIUM')}
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="text-xs truncate">
                      {item.violation.description?.substring(0, 50)}...
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