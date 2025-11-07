"use client";

import React from 'react';
import { ClauseDetection } from '@/lib/policy/types';

interface ContractPDFProps {
  pdfUrl: string;
  findings: ClauseDetection[];
  selectedFindingId?: string;
  onFindingClick?: (id: string) => void;
}

export function ContractPDF({ 
  pdfUrl, 
  findings, 
  selectedFindingId,
  onFindingClick 
}: ContractPDFProps) {
  return (
    <div style={{ height: '100vh', position: 'relative' }}>
      <div className="p-4 bg-yellow-50 border-b">
        <p className="text-sm text-yellow-800">
          Advanced PDF highlighting coming soon. Using basic PDF viewer for now.
        </p>
        <p className="text-xs text-yellow-600 mt-1">
          {findings.filter(f => f.type === 'PROBLEMATIC_TEXT').length} issues detected in this document
        </p>
      </div>
      <iframe
        src={pdfUrl}
        style={{ width: '100%', height: 'calc(100% - 60px)', border: 'none' }}
        title="Contract PDF"
      />
    </div>
  );
}
