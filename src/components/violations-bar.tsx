"use client";

import React, { useState } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Info, XCircle, FileX } from "lucide-react";

interface ViolationsBarProps {
  violations: ViolationDetail[];
  onViolationClick: (violation: ViolationDetail, index: number) => void;
  selectedViolationId?: string | null;
  className?: string;
}

export function ViolationsBar({ violations, onViolationClick, selectedViolationId, className }: ViolationsBarProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
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
  
  const getSeverityIcon = (severity: string, isMissing?: boolean) => {
    // Special icon for missing clauses
    if (isMissing) {
      return <FileX className="h-3.5 w-3.5" />;
    }
    
    // Icons for found problematic text
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
        <div className="overflow-x-auto pb-1 mx-2">
          <div className="flex gap-2 justify-start">
            {uniqueViolationsWithIndex.map((item, idx) => {
              const isActive = activeIndex === idx || 
                              (selectedViolationId && item.violation.id === selectedViolationId);
              
              return (
                <button
                  key={item.violation.id || `${item.violation.type}_${idx}`}
                  onClick={() => {
                    setActiveIndex(idx);
                    onViolationClick(item.violation, item.originalIndex);
                  }}
                  title={item.violation.isMissingClause 
                    ? "Missing required clause - cannot highlight" 
                    : "Click to see highlighted text"}
                  className={cn(
                    "flex-shrink-0 min-w-[200px] max-w-[200px] h-[40px] px-2 py-1.5 rounded-md border transition-all relative",
                    // Dashed border for missing clauses, solid for found text
                    item.violation.isMissingClause ? "border-dashed" : "border-solid",
                    isActive ? [
                      "ring-2 ring-offset-1",
                      item.violation.severity?.toUpperCase() === 'CRITICAL' ? "ring-red-500 border-red-500" :
                      item.violation.severity?.toUpperCase() === 'HIGH' ? "ring-orange-500 border-orange-500" :
                      item.violation.severity?.toUpperCase() === 'MEDIUM' ? "ring-yellow-500 border-yellow-500" :
                      "ring-blue-500 border-blue-500",
                      "shadow-md"
                    ] : getSeverityColor(item.violation.severity || 'MEDIUM'),
                    "cursor-pointer hover:shadow-md"
                  )}
                >
                <div className="flex items-center gap-2 h-full">
                  {getSeverityIcon(item.violation.severity || 'MEDIUM', item.violation.isMissingClause)}
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="text-xs truncate">
                      {item.violation.description?.substring(0, 45)}...
                    </div>
                  </div>
                  {/* Badge for missing clauses */}
                  {item.violation.isMissingClause && (
                    <span className="absolute top-0.5 right-0.5 text-[9px] px-1 py-0 bg-gray-600 text-white rounded">
                      Missing
                    </span>
                  )}
                </div>
              </button>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Custom scrollbar styling */
        .overflow-x-auto::-webkit-scrollbar {
          height: 4px;
        }
        
        .overflow-x-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .overflow-x-auto::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 2px;
        }
        
        .overflow-x-auto::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
}