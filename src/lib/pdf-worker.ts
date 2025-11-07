"use client";

import { pdfjs as reactPdfjs } from "react-pdf";

if (typeof window !== 'undefined') {
  reactPdfjs.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${reactPdfjs.version}/build/pdf.worker.min.mjs`;
}

export {};
