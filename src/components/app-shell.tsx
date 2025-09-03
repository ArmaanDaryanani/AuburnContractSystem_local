"use client";

import { useState, useEffect } from "react";
import { NavigationMinimal } from "@/components/navigation-minimal";
import ContractReviewView from "@/components/views/contract-review-view";
import ContractReviewViewMulti from "@/components/views/contract-review-view-multi";
import BatchAuditView from "@/components/views/batch-audit-view";
import MetricsView from "@/components/views/metrics-view";
import FARMatrixView from "@/components/views/far-matrix-view";
import AuburnPoliciesView from "@/components/views/auburn-policies-view";
import KnowledgeBaseView from "@/components/views/knowledge-base-view";
import { migrateSessionStorage, isMultiDocumentMode } from "@/lib/context-migration-helper";

export type ViewType = 
  | "contract-review" 
  | "batch-audit" 
  | "metrics" 
  | "far-matrix" 
  | "auburn-policies" 
  | "knowledge-base";

export function AppShell() {
  const [currentView, setCurrentView] = useState<ViewType>("contract-review");
  const [useMultiDoc, setUseMultiDoc] = useState(true);

  // Run migration on mount
  useEffect(() => {
    migrateSessionStorage();
    setUseMultiDoc(isMultiDocumentMode());
  }, []);

  const renderView = () => {
    switch (currentView) {
      case "contract-review":
        // Use multi-document view by default, fall back to single if needed
        return useMultiDoc ? <ContractReviewViewMulti /> : <ContractReviewView />;
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
      <NavigationMinimal />
      
      <div className="flex-1 overflow-y-auto">
        {renderView()}
      </div>
    </div>
  );
}