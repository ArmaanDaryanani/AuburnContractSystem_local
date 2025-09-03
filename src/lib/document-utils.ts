export enum DocumentType {
  PDF = 'pdf',
  DOCX = 'docx',
  DOC = 'doc',
  TXT = 'txt',
  UNKNOWN = 'unknown'
}

export interface DocumentInfo {
  type: DocumentType;
  mimeType: string;
  extension: string;
}

export function detectDocumentType(file: File): DocumentInfo {
  const mimeTypeMap: Record<string, DocumentType> = {
    'application/pdf': DocumentType.PDF,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocumentType.DOCX,
    'application/msword': DocumentType.DOC,
    'text/plain': DocumentType.TXT,
    'text/txt': DocumentType.TXT
  };
  
  // Get type from MIME type
  let type = mimeTypeMap[file.type] || DocumentType.UNKNOWN;
  
  // Fallback to extension if MIME type is not recognized
  if (type === DocumentType.UNKNOWN && file.name) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        type = DocumentType.PDF;
        break;
      case 'docx':
        type = DocumentType.DOCX;
        break;
      case 'doc':
        type = DocumentType.DOC;
        break;
      case 'txt':
        type = DocumentType.TXT;
        break;
    }
  }
  
  return {
    type,
    mimeType: file.type || 'application/octet-stream',
    extension: file.name.split('.').pop()?.toLowerCase() || ''
  };
}

export function isWordDocument(file: File): boolean {
  const docInfo = detectDocumentType(file);
  return docInfo.type === DocumentType.DOCX || docInfo.type === DocumentType.DOC;
}

export function isPDFDocument(file: File): boolean {
  const docInfo = detectDocumentType(file);
  return docInfo.type === DocumentType.PDF;
}

export function isTextDocument(file: File): boolean {
  const docInfo = detectDocumentType(file);
  return docInfo.type === DocumentType.TXT;
}

export function isSupportedDocument(file: File): boolean {
  const docInfo = detectDocumentType(file);
  return docInfo.type !== DocumentType.UNKNOWN && docInfo.type !== DocumentType.DOC;
}