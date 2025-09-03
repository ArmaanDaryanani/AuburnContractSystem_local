"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamically import PDF highlighter to avoid SSR issues
export const PDFHighlighter = dynamic(
  () => import('./pdf-highlighter').then((mod) => ({ default: mod.PDFHighlighter })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading PDF viewer...</p>
        </div>
      </div>
    )
  }
);

export type { PDFAnnotation } from './pdf-highlighter';