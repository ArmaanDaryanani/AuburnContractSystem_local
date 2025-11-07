"use client";

import ContractReviewSimplified from "@/components/contract-review-simplified";
import { AuthWrapper } from "@/components/auth/auth-wrapper";

export default function HomePage() {
  return (
    <AuthWrapper>
      <div className="flex h-screen bg-white">
        <div className="flex-1 overflow-y-auto">
          <ContractReviewSimplified />
        </div>
      </div>
    </AuthWrapper>
  );
}