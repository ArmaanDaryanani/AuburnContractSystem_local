"use client";

import ContractReviewSimplified from "@/components/contract-review-simplified";
import { AuthWrapper } from "@/components/auth/auth-wrapper";

export default function HomePage() {
  return (
    <AuthWrapper>
      <div className="flex h-dvh bg-white overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <ContractReviewSimplified />
        </div>
      </div>
    </AuthWrapper>
  );
}