"use client";

import { NavigationMinimal } from "@/components/navigation-minimal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, FileText, Download, BookOpen, ExternalLink, Sparkles } from "lucide-react";

const knowledgeCategories = [
  {
    title: "Contract Templates",
    description: "Pre-approved contract language and templates",
    items: [
      { name: "Standard Research Agreement", type: "DOCX", size: "45KB" },
      { name: "NDA Template - Mutual", type: "DOCX", size: "32KB" },
      { name: "Subcontract Template", type: "DOCX", size: "58KB" },
      { name: "Service Agreement", type: "DOCX", size: "41KB" },
    ],
  },
  {
    title: "Policy Documents",
    description: "Auburn policies and federal regulations",
    items: [
      { name: "Auburn Contracting Policy Manual", type: "PDF", size: "2.3MB" },
      { name: "FAR Quick Reference Guide", type: "PDF", size: "1.8MB" },
      { name: "Export Control Compliance Guide", type: "PDF", size: "890KB" },
      { name: "IP Rights Allocation Framework", type: "PDF", size: "456KB" },
    ],
  },
  {
    title: "Alternative Language Library",
    description: "Pre-approved alternative clauses for common violations",
    items: [
      { name: "Indemnification Alternatives", type: "TXT", size: "12KB" },
      { name: "Payment Terms Variations", type: "TXT", size: "8KB" },
      { name: "IP Rights Language Options", type: "TXT", size: "15KB" },
      { name: "Termination Clause Alternatives", type: "TXT", size: "10KB" },
    ],
  },
  {
    title: "Training Materials",
    description: "Educational resources for contract review",
    items: [
      { name: "Contract Review Best Practices", type: "PDF", size: "3.1MB" },
      { name: "Common Pitfalls and How to Avoid Them", type: "PDF", size: "1.2MB" },
      { name: "FAR Compliance Training", type: "PDF", size: "2.8MB" },
      { name: "Auburn Policy Overview", type: "PDF", size: "1.5MB" },
    ],
  },
];

const quickReferences = [
  { title: "FAR 52.245-1", description: "Government Property clause requirements" },
  { title: "FAR 28.106", description: "Indemnification restrictions" },
  { title: "FAR 27.402", description: "IP rights allocation" },
  { title: "NET 30 Policy", description: "Auburn payment terms requirement" },
  { title: "Publication Rights", description: "Academic freedom preservation" },
  { title: "State Entity Status", description: "Legal constraints and immunities" },
];

export default function KnowledgeBasePage() {
  return (
    <div className="flex h-screen bg-background">
      <NavigationMinimal />
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
            <p className="text-muted-foreground mt-2">
              Contract templates, policy documents, and compliance resources
            </p>
          </div>

          {/* AI Integration Notice */}
          <Alert className="border-primary/20">
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              <strong>AI-Enhanced Knowledge Base:</strong> All documents are indexed and searchable through our 
              TF-IDF engine. The system automatically suggests relevant templates and alternative language 
              based on detected violations.
            </AlertDescription>
          </Alert>

          {/* Quick References */}
          <Card>
            <CardHeader>
              <CardTitle>Quick References</CardTitle>
              <CardDescription>Frequently accessed compliance topics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-3">
                {quickReferences.map((ref) => (
                  <div key={ref.title} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <p className="font-medium text-sm">{ref.title}</p>
                    <p className="text-xs text-muted-foreground">{ref.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Knowledge Categories */}
          <div className="grid gap-6 lg:grid-cols-2">
            {knowledgeCategories.map((category) => (
              <Card key={category.title}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      <CardTitle>{category.title}</CardTitle>
                    </div>
                    <Badge variant="outline">{category.items.length} items</Badge>
                  </div>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {category.items.map((item) => (
                      <div key={item.name} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs">{item.type}</Badge>
                              <span className="text-xs text-muted-foreground">{item.size}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* External Resources */}
          <Card>
            <CardHeader>
              <CardTitle>External Resources</CardTitle>
              <CardDescription>Official sites and additional references</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Federal Acquisition Regulation (FAR)
                </Button>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Auburn OSP Website
                </Button>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Export Control (BIS)
                </Button>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  ITAR Guidelines
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}