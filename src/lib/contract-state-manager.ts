// Contract Review State Manager
// Persists state across navigation in SPA

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
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

interface ContractState {
  contractText: string;
  violations: ViolationDetail[];
  confidence: number;
  riskScore: number;
  hasAnalyzed: boolean;
  messages: Message[];
  fileName?: string;
  lastUpdated: string;
}

const STATE_KEY = 'contractReviewState';
const STATE_EXPIRY_HOURS = 24; // State expires after 24 hours

export class ContractStateManager {
  // Save state to localStorage
  static saveState(state: Partial<ContractState>) {
    try {
      const currentState = this.getState();
      const newState: ContractState = {
        ...currentState,
        ...state,
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem(STATE_KEY, JSON.stringify(newState));
      return true;
    } catch (error) {
      console.error('Error saving contract state:', error);
      return false;
    }
  }

  // Get state from localStorage
  static getState(): ContractState | null {
    try {
      const stored = localStorage.getItem(STATE_KEY);
      if (!stored) return null;
      
      const state = JSON.parse(stored) as ContractState;
      
      // Check if state is expired
      const lastUpdated = new Date(state.lastUpdated);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > STATE_EXPIRY_HOURS) {
        this.clearState();
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Error loading contract state:', error);
      return null;
    }
  }

  // Clear state
  static clearState() {
    try {
      localStorage.removeItem(STATE_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing contract state:', error);
      return false;
    }
  }

  // Save just the messages
  static saveMessages(messages: Message[]) {
    const state = this.getState();
    return this.saveState({
      ...state,
      messages
    });
  }

  // Save analysis results
  static saveAnalysis(analysis: {
    contractText: string;
    violations: ViolationDetail[];
    confidence: number;
    riskScore: number;
    hasAnalyzed: boolean;
    fileName?: string;
  }) {
    return this.saveState(analysis);
  }

  // Add a single message
  static addMessage(message: Message) {
    const state = this.getState();
    const messages = state?.messages || [];
    return this.saveMessages([...messages, message]);
  }

  // Check if there's a saved session
  static hasSession(): boolean {
    const state = this.getState();
    return !!(state && state.hasAnalyzed);
  }
}