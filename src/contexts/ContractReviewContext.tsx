"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Document type enumeration
export type DocumentType = 'pdf' | 'docx' | 'txt' | 'unknown';

// Individual document interface
export interface ContractDocument {
  id: string;
  file: File | null;
  name: string;
  type: DocumentType;
  content: string;
  htmlContent?: string; // For DOCX highlighting
  uploadedAt: Date;
  lastModified?: Date;
  size: number;
  violations: ViolationDetail[];
  annotations?: DocumentAnnotation[];
  confidence: number;
  riskScore: number;
  hasAnalyzed: boolean;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    extractedText?: string;
    farClauses?: string[];
  };
}

// Annotation interface for database integration
export interface DocumentAnnotation {
  id: string;
  documentId: string;
  pageNumber?: number;
  text: string;
  position?: any; // Flexible for PDF/DOCX differences
  color: string;
  comment?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  createdBy?: string;
  createdAt: Date;
  updatedAt?: Date;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  documentId?: string; // Associate messages with specific documents
}

interface ViolationDetail {
  id: string;
  type: string;
  severity: string;
  title?: string;
  description: string;
  problematicText?: string;
  auburnPolicy?: string;
  farReference?: string;
  suggestion?: string;
  confidence?: number;
  location?: string; // Page or section reference
}

// Comparison mode state
interface ComparisonState {
  enabled: boolean;
  documentIds: [string, string] | null;
  differences?: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  similarityScore?: number;
}

interface ContractReviewState {
  // Multiple documents support
  documents: ContractDocument[];
  activeDocumentId: string | null;
  
  // Comparison mode
  comparison: ComparisonState;
  
  // Chat state (now global across documents)
  messages: Message[];
  chatInput: string;
  isStreaming: boolean;
  streamingContent: string;
  
  // UI state
  selectedViolationId: string | null;
  sidebarCollapsed: boolean;
  viewMode: 'single' | 'comparison' | 'grid';
  
  // Session metadata
  sessionId: string;
  lastActivity: Date;
}

interface ContractReviewContextType {
  state: ContractReviewState;
  
  // Document management
  addDocument: (file: File, content: string, htmlContent?: string) => Promise<string>;
  removeDocument: (documentId: string) => void;
  setActiveDocument: (documentId: string) => void;
  updateDocument: (documentId: string, updates: Partial<ContractDocument>) => void;
  getActiveDocument: () => ContractDocument | null;
  getDocument: (documentId: string) => ContractDocument | null;
  
  // Annotations
  addAnnotation: (documentId: string, annotation: Omit<DocumentAnnotation, 'id' | 'createdAt'>) => void;
  removeAnnotation: (documentId: string, annotationId: string) => void;
  updateAnnotation: (documentId: string, annotationId: string, updates: Partial<DocumentAnnotation>) => void;
  
  // Comparison
  enableComparison: (doc1Id: string, doc2Id: string) => void;
  disableComparison: () => void;
  
  // General state management
  updateState: (updates: Partial<ContractReviewState>) => void;
  clearState: () => void;
  addMessage: (message: Message) => void;
  clearSession: () => void;
}

// Helper to detect document type
function detectDocumentType(file: File): DocumentType {
  const extension = file.name.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    case 'txt':
      return 'txt';
    default:
      return 'unknown';
  }
}

// Generate unique document ID
function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Generate session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

const initialState: ContractReviewState = {
  documents: [],
  activeDocumentId: null,
  comparison: {
    enabled: false,
    documentIds: null,
  },
  messages: [],
  chatInput: '',
  isStreaming: false,
  streamingContent: '',
  selectedViolationId: null,
  sidebarCollapsed: false,
  viewMode: 'single',
  sessionId: generateSessionId(),
  lastActivity: new Date(),
};

const ContractReviewContext = createContext<ContractReviewContextType | undefined>(undefined);

export function ContractReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContractReviewState>(initialState);

  // Load state from sessionStorage on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('contractReviewState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Reconstruct dates and filter out file objects
        setState({
          ...parsed,
          documents: parsed.documents?.map((doc: any) => ({
            ...doc,
            file: null, // File objects can't be stored
            uploadedAt: new Date(doc.uploadedAt),
            lastModified: doc.lastModified ? new Date(doc.lastModified) : undefined,
            annotations: doc.annotations?.map((a: any) => ({
              ...a,
              createdAt: new Date(a.createdAt),
              updatedAt: a.updatedAt ? new Date(a.updatedAt) : undefined,
            })) || [],
          })) || [],
          messages: parsed.messages?.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })) || [],
          lastActivity: new Date(parsed.lastActivity || Date.now()),
        });
      } catch (error) {
        console.error('Error loading saved state:', error);
      }
    }
  }, []);

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    // Don't save empty sessions
    if (state.documents.length === 0 && state.messages.length === 0) return;
    
    // Create a serializable version of the state
    const stateToSave = {
      ...state,
      documents: state.documents.map(doc => ({
        ...doc,
        file: null, // Can't serialize File objects
      })),
    };
    
    sessionStorage.setItem('contractReviewState', JSON.stringify(stateToSave));
  }, [state]);

  // Document management functions
  const addDocument = async (file: File, content: string, htmlContent?: string): Promise<string> => {
    const documentId = generateDocumentId();
    const newDocument: ContractDocument = {
      id: documentId,
      file,
      name: file.name,
      type: detectDocumentType(file),
      content,
      htmlContent,
      uploadedAt: new Date(),
      lastModified: new Date(file.lastModified),
      size: file.size,
      violations: [],
      annotations: [],
      confidence: 0,
      riskScore: 0,
      hasAnalyzed: false,
      metadata: {
        wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      },
    };

    setState(prev => ({
      ...prev,
      documents: [...prev.documents, newDocument],
      activeDocumentId: documentId, // Auto-select new document
      lastActivity: new Date(),
    }));

    return documentId;
  };

  const removeDocument = (documentId: string) => {
    setState(prev => {
      const newDocuments = prev.documents.filter(doc => doc.id !== documentId);
      let newActiveId = prev.activeDocumentId;
      
      // If removing active document, select another
      if (prev.activeDocumentId === documentId) {
        newActiveId = newDocuments.length > 0 ? newDocuments[0].id : null;
      }

      // Disable comparison if one of the compared documents is removed
      let newComparison = prev.comparison;
      if (prev.comparison.documentIds?.includes(documentId)) {
        newComparison = { enabled: false, documentIds: null };
      }

      return {
        ...prev,
        documents: newDocuments,
        activeDocumentId: newActiveId,
        comparison: newComparison,
        lastActivity: new Date(),
      };
    });
  };

  const setActiveDocument = (documentId: string) => {
    setState(prev => ({
      ...prev,
      activeDocumentId: documentId,
      lastActivity: new Date(),
    }));
  };

  const updateDocument = (documentId: string, updates: Partial<ContractDocument>) => {
    setState(prev => ({
      ...prev,
      documents: prev.documents.map(doc =>
        doc.id === documentId
          ? { ...doc, ...updates, lastModified: new Date() }
          : doc
      ),
      lastActivity: new Date(),
    }));
  };

  const getActiveDocument = (): ContractDocument | null => {
    if (!state.activeDocumentId) return null;
    return state.documents.find(doc => doc.id === state.activeDocumentId) || null;
  };

  const getDocument = (documentId: string): ContractDocument | null => {
    return state.documents.find(doc => doc.id === documentId) || null;
  };

  // Annotation management
  const addAnnotation = (documentId: string, annotation: Omit<DocumentAnnotation, 'id' | 'createdAt'>) => {
    const newAnnotation: DocumentAnnotation = {
      ...annotation,
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      documentId,
      createdAt: new Date(),
    };

    setState(prev => ({
      ...prev,
      documents: prev.documents.map(doc =>
        doc.id === documentId
          ? { ...doc, annotations: [...(doc.annotations || []), newAnnotation] }
          : doc
      ),
      lastActivity: new Date(),
    }));
  };

  const removeAnnotation = (documentId: string, annotationId: string) => {
    setState(prev => ({
      ...prev,
      documents: prev.documents.map(doc =>
        doc.id === documentId
          ? { ...doc, annotations: doc.annotations?.filter(a => a.id !== annotationId) || [] }
          : doc
      ),
      lastActivity: new Date(),
    }));
  };

  const updateAnnotation = (documentId: string, annotationId: string, updates: Partial<DocumentAnnotation>) => {
    setState(prev => ({
      ...prev,
      documents: prev.documents.map(doc =>
        doc.id === documentId
          ? {
              ...doc,
              annotations: doc.annotations?.map(a =>
                a.id === annotationId
                  ? { ...a, ...updates, updatedAt: new Date() }
                  : a
              ) || []
            }
          : doc
      ),
      lastActivity: new Date(),
    }));
  };

  // Comparison functions
  const enableComparison = (doc1Id: string, doc2Id: string) => {
    setState(prev => ({
      ...prev,
      comparison: {
        enabled: true,
        documentIds: [doc1Id, doc2Id],
      },
      viewMode: 'comparison',
      lastActivity: new Date(),
    }));
  };

  const disableComparison = () => {
    setState(prev => ({
      ...prev,
      comparison: {
        enabled: false,
        documentIds: null,
      },
      viewMode: 'single',
      lastActivity: new Date(),
    }));
  };

  // General state management
  const updateState = (updates: Partial<ContractReviewState>) => {
    setState(prev => ({ ...prev, ...updates, lastActivity: new Date() }));
  };

  const addMessage = (message: Message) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
      lastActivity: new Date(),
    }));
  };

  const clearState = () => {
    setState(initialState);
    sessionStorage.removeItem('contractReviewState');
  };

  const clearSession = () => {
    setState({
      ...initialState,
      sessionId: generateSessionId(),
    });
    sessionStorage.removeItem('contractReviewState');
  };

  return (
    <ContractReviewContext.Provider 
      value={{ 
        state, 
        addDocument,
        removeDocument,
        setActiveDocument,
        updateDocument,
        getActiveDocument,
        getDocument,
        addAnnotation,
        removeAnnotation,
        updateAnnotation,
        enableComparison,
        disableComparison,
        updateState, 
        clearState,
        addMessage,
        clearSession,
      }}
    >
      {children}
    </ContractReviewContext.Provider>
  );
}

export function useContractReview() {
  const context = useContext(ContractReviewContext);
  if (context === undefined) {
    throw new Error('useContractReview must be used within a ContractReviewProvider');
  }
  return context;
}