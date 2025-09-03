declare module 'react-pdf' {
  import { ComponentProps, ReactElement } from 'react';

  export interface DocumentProps {
    file: string | File | { url: string } | { data: Uint8Array | BufferSource } | null;
    onLoadSuccess?: (pdf: any) => void;
    onLoadError?: (error: Error) => void;
    onSourceError?: (error: Error) => void;
    onSourceSuccess?: () => void;
    loading?: ReactElement | string;
    error?: ReactElement | string;
    noData?: ReactElement | string;
    className?: string;
    children?: React.ReactNode;
  }

  export interface PageProps {
    pageNumber: number;
    scale?: number;
    width?: number;
    height?: number;
    renderTextLayer?: boolean;
    renderAnnotationLayer?: boolean;
    className?: string;
    onClick?: (event: React.MouseEvent) => void;
  }

  export const Document: React.FC<DocumentProps>;
  export const Page: React.FC<PageProps>;
  
  export const pdfjs: {
    version: string;
    GlobalWorkerOptions: {
      workerSrc: string;
    };
  };
}

declare module 'react-pdf/dist/Page/AnnotationLayer.css' {}
declare module 'react-pdf/dist/Page/TextLayer.css' {}