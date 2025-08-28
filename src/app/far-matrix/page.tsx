"use client";

import { NavigationMinimal } from "@/components/navigation-minimal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Scale, AlertTriangle, FileText, ExternalLink } from "lucide-react";

const farRegulations = [
  {
    code: "FAR 52.245-1",
    title: "Government Property",
    description: "Requires specific clauses when government property is involved in contracts",
    violation: "Missing required government property management clauses",
    auburnImpact: "Auburn must track and manage any government-furnished property",
    alternativeLanguage: "Include standard FAR 52.245-1 Government Property clause with appropriate property management procedures",
    severity: "HIGH",
  },
  {
    code: "FAR 28.106",
    title: "Bonds and Other Financial Protections",
    description: "Addresses indemnification and hold harmless provisions",
    violation: "Contains indemnification or hold harmless clauses",
    auburnImpact: "Auburn, as a state entity, cannot provide indemnification to third parties",
    alternativeLanguage: "Each party shall be responsible for its own acts and omissions to the extent permitted by law",
    severity: "CRITICAL",
  },
  {
    code: "FAR 27.402",
    title: "Rights in Data - Special Works",
    description: "Governs intellectual property rights and data ownership",
    violation: "IP assignment not based on inventive contribution",
    auburnImpact: "Auburn must retain rights to intellectual property created by faculty and students",
    alternativeLanguage: "Intellectual property rights shall be allocated based on inventive contribution as per FAR 27.402",
    severity: "HIGH",
  },
  {
    code: "FAR 32.906",
    title: "Payment Terms",
    description: "Establishes standard payment terms for government contracts",
    violation: "Payment terms not aligned with NET 30 policy",
    auburnImpact: "Auburn requires NET 30 payment terms per state regulations",
    alternativeLanguage: "Payment shall be made within thirty (30) days of receipt of properly submitted invoice",
    severity: "MEDIUM",
  },
  {
    code: "FAR 28.103",
    title: "Bonds - General",
    description: "Addresses liability limitations and insurance requirements",
    violation: "Contains unlimited liability or liquidated damages clauses",
    auburnImpact: "Auburn cannot accept unlimited liability as a state institution",
    alternativeLanguage: "Liability shall be limited to the amount of the contract value or as permitted by applicable law",
    severity: "CRITICAL",
  },
];

export default function FARMatrixPage() {
  return (
    <div className="flex h-screen bg-background">
      <NavigationMinimal />
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">FAR Matrix Compliance</h1>
            <p className="text-muted-foreground mt-2">
              Federal Acquisition Regulation requirements and Auburn-specific implementation
            </p>
          </div>

          {/* Overview Alert */}
          <Alert>
            <Scale className="h-4 w-4" />
            <AlertTitle>Compliance Framework</AlertTitle>
            <AlertDescription>
              The FAR Matrix defines federal contracting requirements that Auburn University must follow when 
              entering into federally-funded research agreements. Each regulation has specific implications 
              for university operations and requires careful review.
            </AlertDescription>
          </Alert>

          {/* FAR Regulations Grid */}
          <div className="space-y-4">
            {farRegulations.map((regulation) => (
              <Card key={regulation.code}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{regulation.code}</CardTitle>
                        <CardDescription>{regulation.title}</CardDescription>
                      </div>
                    </div>
                    <Badge 
                      variant={
                        regulation.severity === "CRITICAL" ? "destructive" :
                        regulation.severity === "HIGH" ? "secondary" :
                        "outline"
                      }
                    >
                      {regulation.severity}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Description</p>
                        <p className="text-sm text-muted-foreground">{regulation.description}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-orange-500" />
                          Common Violation
                        </p>
                        <p className="text-sm text-muted-foreground">{regulation.violation}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Auburn Impact</p>
                        <p className="text-sm text-muted-foreground">{regulation.auburnImpact}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1 text-green-600">Recommended Alternative</p>
                        <p className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950/20 p-2 rounded">
                          {regulation.alternativeLanguage}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Resources */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Resources</CardTitle>
              <CardDescription>External references and documentation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="cursor-pointer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  FAR Official Site
                </Badge>
                <Badge variant="outline" className="cursor-pointer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Auburn OSP Guidelines
                </Badge>
                <Badge variant="outline" className="cursor-pointer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Contract Templates
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}