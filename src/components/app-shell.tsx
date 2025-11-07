"use client";

import { useState, useEffect } from "react";
import ContractReviewView from "@/components/views/contract-review-view";
import { migrateSessionStorage } from "@/lib/context-migration-helper";

export type ViewType = "contract-review";

export function AppShell() {
  // Run migration on mount
  useEffect(() => {
    migrateSessionStorage();
  }, []);

  return (
    <div className="flex h-screen bg-white">
      <div className="flex-1 overflow-y-auto">
        <ContractReviewView />
      </div>
    </div>
  );
}