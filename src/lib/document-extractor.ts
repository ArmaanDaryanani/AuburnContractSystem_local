import { detectDocumentType, DocumentType } from './document-utils';

export interface ExtractedDocument {
  text: string;
  html?: string;
  type: 'pdf' | 'docx' | 'text';
  pages?: number;
  info?: Record<string, any>;
  error?: string;
  warning?: string;
}

export async function extractTextFromFile(file: File): Promise<ExtractedDocument> {
  const docInfo = detectDocumentType(file);
  
  // For text files, read directly
  if (docInfo.type === DocumentType.TXT) {
    const text = await file.text();
    return {
      text,
      type: 'text',
      info: { size: file.size }
    };
  }
  
  // For PDF and DOCX, use the API endpoint
  if (docInfo.type === DocumentType.PDF || docInfo.type === DocumentType.DOCX) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/documents/extract-text', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to extract text: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result as ExtractedDocument;
      
    } catch (error: any) {
      console.error('Error extracting text from document:', error);
      
      // Fallback for development/testing
      if (docInfo.type === DocumentType.DOCX) {
        return {
          text: `[DOCX Document: ${file.name}]\n\nDocument text extraction in progress...`,
          type: 'docx',
          error: error.message
        };
      }
      
      return {
        text: `[PDF Document: ${file.name}]\n\nDocument text extraction in progress...`,
        type: 'pdf',
        error: error.message
      };
    }
  }
  
  // Unsupported file type
  return {
    text: '',
    type: 'text',
    error: `Unsupported file type: ${docInfo.type}`
  };
}