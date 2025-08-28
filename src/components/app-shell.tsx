"use client";

import { useState } from "react";
import { NavigationMinimal } from "@/components/navigation-minimal";
import ContractReviewView from "@/components/views/contract-review-view";
import BatchAuditView from "@/components/views/batch-audit-view";
import MetricsView from "@/components/views/metrics-view";
import FARMatrixView from "@/components/views/far-matrix-view";
import AuburnPoliciesView from "@/components/views/auburn-policies-view";
import KnowledgeBaseView from "@/components/views/knowledge-base-view";

export type ViewType = 
  | "contract-review" 
  | "batch-audit" 
  | "metrics" 
  | "far-matrix" 
  | "auburn-policies" 
  | "knowledge-base";

export function AppShell() {
  const [currentView, setCurrentView] = useState<ViewType>("contract-review");

  const renderView = () => {
    switch (currentView) {
      case "contract-review":
        return <ContractReviewView />;
      case "batch-audit":
        return <BatchAuditView />;
      case "metrics":
        return <MetricsView />;
      case "far-matrix":
        return <FARMatrixView />;
      case "auburn-policies":
        return <AuburnPoliciesView />;
      case "knowledge-base":
        return <KnowledgeBaseView />;
      default:
        return <ContractReviewView />;
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <NavigationMinimal currentView={currentView} onViewChange={setCurrentView} />
      
      <div className="flex-1 overflow-y-auto">
        {renderView()}
      </div>
    </div>
  );
}