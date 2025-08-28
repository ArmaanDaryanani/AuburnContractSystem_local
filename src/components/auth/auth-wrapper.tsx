"use client";

import { useState, useEffect } from "react";
import { LoginScreen } from "./login-screen";

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/check");
      setIsAuthenticated(response.ok);
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  // Show loading state while checking authentication
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-gray-900 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onSuccess={handleLoginSuccess} />;
  }

  // Show the main application if authenticated
  return <>{children}</>;
}