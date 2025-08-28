"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Lock } from "lucide-react";
import Image from "next/image";

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || "Invalid password");
        setPassword("");
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
      setPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-gray-200 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded flex items-center justify-center bg-[#03244d] p-2">
              <Image 
                src="/auburn-logo.svg" 
                alt="Auburn Logo" 
                width={64} 
                height={64}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Auburn Contract Review System
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 mt-2">
            Enter your access password to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="password"
                  placeholder="Enter access password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 border-gray-200 focus:border-gray-400"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-sm text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-gray-900 hover:bg-gray-800 text-white"
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Access System
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Secured System</span>
              <span>© Auburn University</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}