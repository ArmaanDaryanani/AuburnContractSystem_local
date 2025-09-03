"use client";

import { useState, lazy, Suspense } from "react";
import { NavigationSPA, type ViewType } from "@/components/navigation-spa";
import ContractReviewView from "@/components/views/contract-review-view";
import ContractReviewSimplified from "@/components/contract-review-simplified";
import { AuthWrapper } from "@/components/auth/auth-wrapper";
import { Loader2 } from "lucide-react";

// Lazy load views for better performance
const BatchAuditView = lazy(() => import("@/components/views/batch-audit-view"));
const MetricsView = lazy(() => import("@/components/views/metrics-view"));
const FARMatrixView = lazy(() => import("@/components/views/far-matrix-view"));
const AuburnPoliciesView = lazy(() => import("@/components/views/auburn-policies-view"));
const KnowledgeBaseView = lazy(() => import("@/components/views/knowledge-base-view-enhanced"));

function LoadingView() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [currentView, setCurrentView] = useState<ViewType>("contract-review");

  const renderView = () => {
    switch (currentView) {
      case "contract-review":
        return <ContractReviewSimplified />;
      case "batch-audit":
        return (
          <Suspense fallback={<LoadingView />}>
            <BatchAuditView />
          </Suspense>
        );
      case "metrics":
        return (
          <Suspense fallback={<LoadingView />}>
            <MetricsView />
          </Suspense>
        );
      case "far-matrix":
        return (
          <Suspense fallback={<LoadingView />}>
            <FARMatrixView />
          </Suspense>
        );
      case "auburn-policies":
        return (
          <Suspense fallback={<LoadingView />}>
            <AuburnPoliciesView />
          </Suspense>
        );
      case "knowledge-base":
        return (
          <Suspense fallback={<LoadingView />}>
            <KnowledgeBaseView />
          </Suspense>
        );
      default:
        return <ContractReviewSimplified />;
    }
  };

  return (
    <AuthWrapper>
      <div className="flex h-screen bg-white">
        <NavigationSPA currentView={currentView} onViewChange={setCurrentView} />
        
        <div className="flex-1 overflow-y-auto">
          {renderView()}
        </div>
      </div>
    </AuthWrapper>
  );
}