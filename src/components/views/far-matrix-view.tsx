"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  Info,
  ExternalLink,
  Book,
} from "lucide-react";

export default function FARMatrixView() {
  const [farData, setFarData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredData, setFilteredData] = useState<any[]>([]);

  useEffect(() => {
    fetchFARData();
  }, []);

  useEffect(() => {
    if (farData?.farMatrix) {
      const filtered = farData.farMatrix.filter((item: any) =>
        item.clause.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
    }
  }, [searchTerm, farData]);

  const fetchFARData = async () => {
    try {
      const response = await fetch('/api/far-matrix');
      if (response.ok) {
        const data = await response.json();
        setFarData(data);
        setFilteredData(data.farMatrix || []);
      }
    } catch (error) {
      console.error('Error fetching FAR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'destructive';
      case 'active':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          FAR Compliance Matrix
        </h1>
        <p className="text-sm text-gray-600">
          Federal Acquisition Regulation requirements and Auburn compliance guidelines
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total FAR Clauses</p>
                <p className="text-2xl font-bold">{farData?.totalClauses || 0}</p>
              </div>
              <Book className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical Items</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredData.filter(d => d.status === 'critical').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Document Chunks</p>
                <p className="text-2xl font-bold">{farData?.totalChunks || 8203}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search FAR clauses, titles, or descriptions..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* FAR Matrix Table */}
      <div className="space-y-4">
        {filteredData.length === 0 ? (
          <Card className="border-gray-200">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No FAR clauses found matching your search.</p>
            </CardContent>
          </Card>
        ) : (
          filteredData.map((item, idx) => (
            <Card key={idx} className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{item.clause}</h3>
                        <Badge variant={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                        {item.hasFullText && (
                          <Badge variant="outline">Full Text Available</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-700">{item.title}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`https://www.acquisition.gov/far/part-${item.clause.split('.')[1]}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-900 mb-1">Auburn Impact:</p>
                    <p className="text-sm text-blue-800">{item.auburnImpact}</p>
                  </div>

                  {item.content && (
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                        View FAR Text Excerpt
                      </summary>
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                          {item.content}
                        </p>
                      </div>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          FAR data loaded from knowledge base with {farData?.totalChunks || 0} indexed chunks
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}