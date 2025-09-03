/**
 * Migration helper for transitioning from single-document to multi-document context
 * This provides compatibility layer for existing components
 */

import { useContractReview, type ContractDocument } from '@/contexts/ContractReviewContext';

/**
 * Hook providing backward compatibility for components expecting single document state
 * @deprecated Use useContractReview directly for new components
 */
export function useSingleDocumentCompat() {
  const context = useContractReview();
  const activeDoc = context.getActiveDocument();

  // Map multi-document context to single-document interface
  const singleDocState = {
    // File and text
    file: activeDoc?.file || null,
    contractText: activeDoc?.content || '',
    
    // Analysis results
    violations: activeDoc?.violations || [],
    confidence: activeDoc?.confidence || 0,
    riskScore: activeDoc?.riskScore || 0,
    hasAnalyzed: activeDoc?.hasAnalyzed || false,
    
    // Chat state (global across documents)
    messages: context.state.messages,
    chatInput: context.state.chatInput,
    isStreaming: context.state.isStreaming,
    streamingContent: context.state.streamingContent,
    
    // UI state
    selectedViolationId: context.state.selectedViolationId,
  };

  // Map update functions
  const updateState = (updates: any) => {
    // Update active document if document-specific fields are changed
    if (activeDoc && (updates.violations || updates.confidence || updates.riskScore || updates.hasAnalyzed)) {
      context.updateDocument(activeDoc.id, {
        violations: updates.violations,
        confidence: updates.confidence,
        riskScore: updates.riskScore,
        hasAnalyzed: updates.hasAnalyzed,
      });
    }
    
    // Update global state for non-document fields
    const globalUpdates: any = {};
    if (updates.messages) globalUpdates.messages = updates.messages;
    if (updates.chatInput !== undefined) globalUpdates.chatInput = updates.chatInput;
    if (updates.isStreaming !== undefined) globalUpdates.isStreaming = updates.isStreaming;
    if (updates.streamingContent !== undefined) globalUpdates.streamingContent = updates.streamingContent;
    if (updates.selectedViolationId !== undefined) globalUpdates.selectedViolationId = updates.selectedViolationId;
    
    if (Object.keys(globalUpdates).length > 0) {
      context.updateState(globalUpdates);
    }
  };

  const addMessage = context.addMessage;
  const clearState = context.clearState;

  return {
    state: singleDocState,
    updateState,
    clearState,
    addMessage,
  };
}

/**
 * Helper to convert old violation format to new DocumentAnnotation format
 */
export function violationToAnnotation(violation: any, documentId: string) {
  return {
    documentId,
    text: violation.problematicText || violation.description,
    position: violation.location,
    color: severityToColor(violation.severity),
    comment: violation.suggestion,
    severity: violation.severity,
    createdBy: 'system',
  };
}

/**
 * Convert severity level to color
 */
function severityToColor(severity: string): string {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return '#ef4444'; // red-500
    case 'HIGH': return '#f97316'; // orange-500
    case 'MEDIUM': return '#eab308'; // yellow-500
    case 'LOW': return '#22c55e'; // green-500
    default: return '#6b7280'; // gray-500
  }
}

/**
 * Helper to migrate session storage from old format to new format
 */
export function migrateSessionStorage() {
  const oldStateKey = 'contractReviewState';
  const oldState = sessionStorage.getItem(oldStateKey);
  
  if (!oldState) return;
  
  try {
    const parsed = JSON.parse(oldState);
    
    // Check if this is the old format (has contractText directly)
    if (parsed.contractText && !parsed.documents) {
      // Create a document from old state
      const migratedDocument: Partial<ContractDocument> = {
        id: `migrated_${Date.now()}`,
        name: parsed.fileName || 'Migrated Document',
        type: 'unknown' as any,
        content: parsed.contractText,
        uploadedAt: new Date(),
        violations: parsed.violations || [],
        confidence: parsed.confidence || 0,
        riskScore: parsed.riskScore || 0,
        hasAnalyzed: parsed.hasAnalyzed || false,
        annotations: [],
        size: 0,
      };
      
      // Create new state format
      const newState = {
        documents: [migratedDocument],
        activeDocumentId: migratedDocument.id,
        comparison: {
          enabled: false,
          documentIds: null,
        },
        messages: parsed.messages || [],
        chatInput: parsed.chatInput || '',
        isStreaming: false,
        streamingContent: '',
        selectedViolationId: parsed.selectedViolationId || null,
        sidebarCollapsed: false,
        viewMode: 'single',
        sessionId: `session_${Date.now()}`,
        lastActivity: new Date(),
      };
      
      // Save migrated state
      sessionStorage.setItem(oldStateKey, JSON.stringify(newState));
      console.log('Successfully migrated session storage to multi-document format');
    }
  } catch (error) {
    console.error('Error migrating session storage:', error);
  }
}

/**
 * Detect if running in single or multi-document mode based on URL or config
 */
export function isMultiDocumentMode(): boolean {
  // Check URL parameters
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'multi') return true;
  if (params.get('mode') === 'single') return false;
  
  // Check localStorage preference
  const preference = localStorage.getItem('documentMode');
  if (preference === 'multi') return true;
  if (preference === 'single') return false;
  
  // Default to multi-document mode
  return true;
}

/**
 * Set document mode preference
 */
export function setDocumentMode(mode: 'single' | 'multi') {
  localStorage.setItem('documentMode', mode);
}