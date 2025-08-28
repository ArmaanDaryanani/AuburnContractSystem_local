"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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
}

interface ContractReviewState {
  // File and text
  file: File | null;
  contractText: string;
  
  // Analysis results
  violations: ViolationDetail[];
  confidence: number;
  riskScore: number;
  hasAnalyzed: boolean;
  
  // Chat state
  messages: Message[];
  chatInput: string;
  isStreaming: boolean;
  streamingContent: string;
  
  // UI state
  selectedViolationId: string | null;
}

interface ContractReviewContextType {
  state: ContractReviewState;
  updateState: (updates: Partial<ContractReviewState>) => void;
  clearState: () => void;
  addMessage: (message: Message) => void;
}

const initialState: ContractReviewState = {
  file: null,
  contractText: '',
  violations: [],
  confidence: 0,
  riskScore: 0,
  hasAnalyzed: false,
  messages: [],
  chatInput: '',
  isStreaming: false,
  streamingContent: '',
  selectedViolationId: null,
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
        // Reconstruct dates and filter out file object (can't be serialized)
        setState({
          ...parsed,
          file: null, // File objects can't be stored in sessionStorage
          messages: parsed.messages?.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })) || []
        });
      } catch (error) {
        console.error('Error loading saved state:', error);
      }
    }
  }, []);

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    // Don't save if there's nothing analyzed yet
    if (!state.hasAnalyzed && state.messages.length === 0) return;
    
    // Create a serializable version of the state
    const stateToSave = {
      ...state,
      file: null, // Can't serialize File objects
    };
    
    sessionStorage.setItem('contractReviewState', JSON.stringify(stateToSave));
  }, [state]);

  const updateState = (updates: Partial<ContractReviewState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const addMessage = (message: Message) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message]
    }));
  };

  const clearState = () => {
    setState(initialState);
    sessionStorage.removeItem('contractReviewState');
  };

  return (
    <ContractReviewContext.Provider value={{ state, updateState, clearState, addMessage }}>
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