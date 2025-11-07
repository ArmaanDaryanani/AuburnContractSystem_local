import { pdfjs as reactPdfjs } from "react-pdf";

reactPdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${reactPdfjs.version}/build/pdf.worker.min.mjs`;

export {};
