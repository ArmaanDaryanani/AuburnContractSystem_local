"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamically import DOCX highlighter to avoid SSR issues with rangy
export const DOCXHighlighter = dynamic(
  () => import('./docx-highlighter').then((mod) => mod.DOCXHighlighter),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading DOCX viewer...</p>
        </div>
      </div>
    )
  }
);

export type { DOCXAnnotation } from './docx-highlighter';