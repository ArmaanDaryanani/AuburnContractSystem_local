"use client";

import { useState } from "react";
import { DocumentComparer } from "@/components/document-comparer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, GitCompare } from "lucide-react";

// Sample documents for testing
const SAMPLE_DOC_1 = `STATEMENT OF WORK
Effective Date: January 1, 2024

1. PROJECT SCOPE
The contractor shall provide software development services for the Auburn University Research Portal. The system shall include user authentication, data management, and reporting capabilities.

2. DELIVERABLES
- Phase 1: Requirements analysis and system design
- Phase 2: Core functionality implementation
- Phase 3: Testing and deployment
- Phase 4: Training and documentation

3. PAYMENT TERMS
Payment shall be made within 30 days of invoice receipt. Auburn University reserves the right to withhold payment for incomplete or unsatisfactory work.

4. INTELLECTUAL PROPERTY
All work products shall become the property of Auburn University upon payment. The contractor agrees to assign all rights, title, and interest to Auburn University.

5. INDEMNIFICATION
Each party shall be responsible for its own acts and omissions.`;

const SAMPLE_DOC_2 = `STATEMENT OF WORK
Effective Date: February 15, 2024

1. PROJECT SCOPE
The contractor shall provide comprehensive software development and maintenance services for the Auburn University Research Management System. The system shall include advanced user authentication, real-time data synchronization, automated reporting, and integration with existing university systems.

2. DELIVERABLES
- Phase 1: Requirements gathering, stakeholder analysis, and detailed system architecture
- Phase 2: Core module development including authentication and authorization
- Phase 3: Advanced features implementation and third-party integrations
- Phase 4: Quality assurance, performance testing, and security audit
- Phase 5: Deployment, training, ongoing support, and maintenance

3. PAYMENT TERMS
Payment shall be made within 45 days of invoice approval. Auburn University reserves the right to dispute charges and request detailed documentation for all billable hours.

4. INTELLECTUAL PROPERTY
All deliverables, including source code, documentation, and designs, shall be jointly owned by Auburn University and the contractor for the first year, after which full ownership transfers to Auburn University.

5. LIABILITY
Neither party shall be liable for indirect, incidental, or consequential damages. Total liability shall not exceed the contract value.`;

export default function TestComparisonPage() {
  const [doc1Content, setDoc1Content] = useState(SAMPLE_DOC_1);
  const [doc2Content, setDoc2Content] = useState(SAMPLE_DOC_2);
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Document Comparison Test</h1>
        <p className="text-muted-foreground">
          Test the document comparison functionality with sample contracts
        </p>
      </div>

      {!showComparison ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document 1 (Original)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={doc1Content}
                  onChange={(e) => setDoc1Content(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Enter or paste the first document content..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document 2 (Modified)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={doc2Content}
                  onChange={(e) => setDoc2Content(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Enter or paste the second document content..."
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={() => setShowComparison(true)}
              size="lg"
              className="gap-2"
              disabled={!doc1Content || !doc2Content}
            >
              <GitCompare className="h-5 w-5" />
              Compare Documents
            </Button>
          </div>
        </div>
      ) : (
        <DocumentComparer
          document1={{
            id: "doc1",
            name: "Original Contract.docx",
            content: doc1Content,
            type: "docx",
          }}
          document2={{
            id: "doc2",
            name: "Modified Contract.docx",
            content: doc2Content,
            type: "docx",
          }}
          onClose={() => setShowComparison(false)}
          violations={[]}
        />
      )}
    </div>
  );
}