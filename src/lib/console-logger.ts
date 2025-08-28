// Console Logger Utility
// This ensures console logs are visible in the browser

export class ConsoleLogger {
  private static instance: ConsoleLogger;
  private enabled = true;
  
  private constructor() {
    // Initialize on page load
    if (typeof window !== 'undefined') {
      console.log('🚀 [ConsoleLogger] Initialized - Console logging is ACTIVE');
      console.log('📍 [ConsoleLogger] Current URL:', window.location.href);
      console.log('🌐 [ConsoleLogger] Environment:', {
        nodeEnv: process.env.NODE_ENV,
        apiUrl: process.env.NEXT_PUBLIC_APP_URL,
        hasApiKey: process.env.NEXT_PUBLIC_HAS_OPENROUTER_KEY,
        model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL
      });
    }
  }
  
  static getInstance(): ConsoleLogger {
    if (!ConsoleLogger.instance) {
      ConsoleLogger.instance = new ConsoleLogger();
    }
    return ConsoleLogger.instance;
  }
  
  log(source: string, message: string, data?: any) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${source}]`;
    
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
  
  error(source: string, message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `❌ [${timestamp}] [${source}]`;
    
    if (error) {
      console.error(`${prefix} ${message}`, error);
    } else {
      console.error(`${prefix} ${message}`);
    }
  }
  
  warn(source: string, message: string, data?: any) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `⚠️ [${timestamp}] [${source}]`;
    
    if (data) {
      console.warn(`${prefix} ${message}`, data);
    } else {
      console.warn(`${prefix} ${message}`);
    }
  }
  
  info(source: string, message: string, data?: any) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `ℹ️ [${timestamp}] [${source}]`;
    
    if (data) {
      console.info(`${prefix} ${message}`, data);
    } else {
      console.info(`${prefix} ${message}`);
    }
  }
  
  toggle() {
    this.enabled = !this.enabled;
    console.log(`🔧 [ConsoleLogger] Logging ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
  }
}

// Export singleton instance
export const logger = ConsoleLogger.getInstance();