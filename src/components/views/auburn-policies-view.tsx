"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle, XCircle, AlertTriangle, BookOpen, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AuburnPoliciesView() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await fetch('/api/auburn-policies');
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.policies || []);
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching Auburn policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = searchTerm === "" || 
      policy.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policy.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policy.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || 
      policy.category?.toLowerCase() === selectedCategory.toLowerCase();
    
    return matchesSearch && matchesCategory;
  });

  const getRiskBadge = (critical: boolean) => {
    if (critical) {
      return <Badge variant="destructive">CRITICAL</Badge>;
    }
    return <Badge variant="default">STANDARD</Badge>;
  };

  const getRiskIcon = (critical: boolean) => {
    if (critical) {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Auburn University Policies
        </h1>
        <p className="text-sm text-gray-600">
          University-specific contracting requirements from knowledge base
        </p>
      </div>

      {/* State Entity Alert */}
      <Alert className="mb-8 border-blue-200 bg-blue-50">
        <Shield className="h-4 w-4" />
        <AlertTitle>State Entity Status</AlertTitle>
        <AlertDescription>
          Auburn University, as an agency of the State of Alabama, operates under specific legal constraints. 
          These policies are derived from actual Auburn documents in our knowledge base.
        </AlertDescription>
      </Alert>

      {/* Search and Filter */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search policies..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="px-4 py-2 border border-gray-300 rounded-lg"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Policies Grid */}
      <div className="space-y-6">
        {filteredPolicies.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No policies found matching your search.</p>
            </CardContent>
          </Card>
        ) : (
          filteredPolicies.map((policy, idx) => (
            <Card key={idx} className="overflow-hidden">
              <CardHeader className={policy.critical ? "bg-red-50" : "bg-gray-50"}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getRiskIcon(policy.critical)}
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {policy.title}
                        {getRiskBadge(policy.critical)}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <span className="font-medium">{policy.category}</span>
                        {policy.source && (
                          <span className="ml-2 text-xs">• Source: {policy.source}</span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Policy Requirement</h4>
                    <p className="text-sm text-gray-600">{policy.content}</p>
                  </div>

                  {policy.alternatives && policy.alternatives.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Approved Alternatives</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        {policy.alternatives.map((alt: string, i: number) => (
                          <li key={i}>{alt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {policy.hasFullDocument && (
                    <div className="pt-2">
                      <Badge variant="outline" className="text-xs">
                        <BookOpen className="h-3 w-3 mr-1" />
                        Full document available in knowledge base
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Compliance Checklist */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Compliance Checklist</CardTitle>
          <CardDescription>Essential items from Auburn policies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[
              "State entity restrictions acknowledged",
              "No indemnification clauses present",
              "Publication rights preserved",
              "Payment terms NET 30 or greater",
              "Termination provisions included",
              "Export control language present",
              "IP rights based on contribution",
              "No unlimited liability accepted"
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-700">{item}</span>
                <Badge variant="outline" className="ml-auto text-xs">Required</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          {policies.length} policies loaded from knowledge base
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Documents indexed: Auburn Contract Management Guide, General Terms & Conditions
        </p>
      </div>
    </div>
  );
}