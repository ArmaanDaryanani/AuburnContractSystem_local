"use client";

import { NavigationMinimal } from "@/components/navigation-minimal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle, XCircle, AlertTriangle, BookOpen } from "lucide-react";

const auburnPolicies = [
  {
    policy: "Publication Rights",
    category: "Academic Freedom",
    requirement: "Auburn must retain the right to publish research results",
    typicalViolation: "Sponsor requires prior approval for all publications or indefinite embargo periods",
    acceptableLanguage: "Auburn retains the right to publish research results after a reasonable review period not to exceed thirty (30) days for patent or proprietary information review",
    riskLevel: "HIGH",
    farReference: "FAR 27.404",
  },
  {
    policy: "Termination Provisions",
    category: "Contract Management",
    requirement: "Contracts must include both convenience and cause termination clauses",
    typicalViolation: "Contract only allows sponsor to terminate or lacks termination provisions entirely",
    acceptableLanguage: "Either party may terminate this agreement for convenience upon thirty (30) days written notice, or immediately for cause including breach of contract terms",
    riskLevel: "MEDIUM",
    farReference: "FAR 49.502",
  },
  {
    policy: "Insurance Requirements",
    category: "Risk Management",
    requirement: "Auburn maintains insurance per state requirements and cannot provide additional coverage",
    typicalViolation: "Sponsor requires specific insurance amounts or additional insured status",
    acceptableLanguage: "Auburn maintains insurance coverage as required by the State of Alabama and will provide certificates of insurance upon request",
    riskLevel: "MEDIUM",
    farReference: "FAR 28.306",
  },
  {
    policy: "Export Control Compliance",
    category: "Regulatory",
    requirement: "All parties must comply with export control regulations",
    typicalViolation: "Contract lacks export control provisions or places sole responsibility on Auburn",
    acceptableLanguage: "Both parties shall comply with all applicable U.S. export control laws and regulations including ITAR and EAR",
    riskLevel: "HIGH",
    farReference: "FAR 52.225",
  },
  {
    policy: "Indemnification Prohibition",
    category: "Legal Protection",
    requirement: "As a state entity, Auburn cannot indemnify third parties",
    typicalViolation: "Contract contains indemnification, hold harmless, or defense obligations",
    acceptableLanguage: "To the extent permitted by law, each party shall be responsible for its own acts and omissions",
    riskLevel: "CRITICAL",
    farReference: "FAR 28.106",
  },
  {
    policy: "Governing Law",
    category: "Legal Framework",
    requirement: "Contracts should be governed by Alabama law without waiving state immunity",
    typicalViolation: "Contract specifies other state's law or waives sovereign immunity",
    acceptableLanguage: "This agreement shall be governed by the laws of the State of Alabama without waiving any immunity or defenses available to Auburn University",
    riskLevel: "HIGH",
    farReference: "N/A",
  },
];

const complianceChecklist = [
  { item: "State entity restrictions acknowledged", required: true },
  { item: "No indemnification clauses present", required: true },
  { item: "Publication rights preserved", required: true },
  { item: "Payment terms NET 30 or greater", required: true },
  { item: "Termination provisions included", required: true },
  { item: "Export control language present", required: false },
  { item: "IP rights based on contribution", required: true },
  { item: "No unlimited liability accepted", required: true },
];

export default function AuburnPoliciesPage() {
  return (
    <div className="flex h-screen bg-background">
      <NavigationMinimal />
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Auburn University Policies</h1>
            <p className="text-muted-foreground mt-2">
              University-specific contracting requirements and compliance guidelines
            </p>
          </div>

          {/* State Entity Notice */}
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <Shield className="h-4 w-4 text-orange-600" />
            <AlertTitle>State Entity Status</AlertTitle>
            <AlertDescription>
              Auburn University, as an agency of the State of Alabama, operates under specific legal constraints. 
              These policies ensure compliance with state law while maintaining the university's mission of 
              education and research.
            </AlertDescription>
          </Alert>

          {/* Policy Details */}
          <div className="space-y-4">
            {auburnPolicies.map((policy) => (
              <Card key={policy.policy}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{policy.policy}</CardTitle>
                        <CardDescription>{policy.category}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {policy.farReference !== "N/A" && (
                        <Badge variant="outline" className="text-xs">
                          {policy.farReference}
                        </Badge>
                      )}
                      <Badge 
                        variant={
                          policy.riskLevel === "CRITICAL" ? "destructive" :
                          policy.riskLevel === "HIGH" ? "secondary" :
                          "outline"
                        }
                      >
                        {policy.riskLevel} RISK
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">University Requirement</p>
                      <p className="text-sm text-muted-foreground">{policy.requirement}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-1 flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-500" />
                        Typical Violation
                      </p>
                      <p className="text-sm text-muted-foreground bg-red-50 dark:bg-red-950/20 p-2 rounded">
                        {policy.typicalViolation}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Acceptable Language
                      </p>
                      <p className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950/20 p-2 rounded font-mono text-xs">
                        "{policy.acceptableLanguage}"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Compliance Checklist */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Compliance Checklist</CardTitle>
              <CardDescription>Essential items to verify in every contract</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {complianceChecklist.map((item) => (
                  <div key={item.item} className="flex items-center gap-2 p-2">
                    {item.required ? (
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-sm">{item.item}</span>
                    {item.required && (
                      <Badge variant="outline" className="text-xs ml-auto">
                        Required
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}