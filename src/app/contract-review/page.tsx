"use client";

import { ContractReviewProvider } from "@/contexts/ContractReviewContext";
import ContractReviewViewMulti from "@/components/views/contract-review-view-multi";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function ContractReviewPage() {
  return (
    <DashboardLayout>
      <ContractReviewProvider>
        <ContractReviewViewMulti />
      </ContractReviewProvider>
    </DashboardLayout>
  );
}