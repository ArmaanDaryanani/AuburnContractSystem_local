"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Database, 
  FileText, 
  Download, 
  BookOpen, 
  ExternalLink, 
  Sparkles, 
  Loader2,
  RefreshCw,
  Trash2,
  CheckCircle,
  Clock
} from "lucide-react";

export default function KnowledgeBaseView() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  const fetchKnowledgeBase = async () => {
    try {
      const response = await fetch('/api/knowledge-base');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
        setStatistics(data.statistics || {});
        setLastUpdated(data.lastUpdated || new Date().toISOString());
      }
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async (documentId: string) => {
    try {
      const response = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reindex', documentId })
      });
      
      if (response.ok) {
        fetchKnowledgeBase(); // Refresh the list
      }
    } catch (error) {
      console.error('Error reindexing document:', error);
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'far_matrix':
        return <BookOpen className="h-5 w-5 text-blue-500" />;
      case 'auburn_policy':
        return <FileText className="h-5 w-5 text-orange-500" />;
      case 'contract_template':
        return <FileText className="h-5 w-5 text-green-500" />;
      default:
        return <Database className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'indexed') {
      return <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Indexed
      </Badge>;
    }
    return <Badge variant="secondary" className="flex items-center gap-1">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>;
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
          Knowledge Base
        </h1>
        <p className="text-sm text-gray-600">
          Document repository with {statistics?.totalChunks?.toLocaleString() || 0} indexed chunks
        </p>
      </div>

      {/* AI Enhancement Alert */}
      <Alert className="mb-8 border-purple-200 bg-purple-50">
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          <strong>AI-Enhanced Knowledge Base:</strong> All documents are indexed with OpenAI embeddings 
          for semantic search. The system uses these {statistics?.totalChunks?.toLocaleString() || 0} vectors 
          to provide context-aware contract analysis and suggest relevant alternatives.
        </AlertDescription>
      </Alert>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Documents</p>
                <p className="text-2xl font-bold">{statistics?.totalDocuments || 0}</p>
              </div>
              <Database className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Chunks</p>
                <p className="text-2xl font-bold">{statistics?.totalChunks?.toLocaleString() || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">FAR Documents</p>
                <p className="text-2xl font-bold">{statistics?.documentTypes?.far_matrix || 0}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Auburn Policies</p>
                <p className="text-2xl font-bold">
                  {(statistics?.documentTypes?.auburn_policy || 0) + 
                   (statistics?.documentTypes?.approved_alternative || 0)}
                </p>
              </div>
              <FileText className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Indexed Documents</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fetchKnowledgeBase()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Documents ingested into the RAG system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No documents found in knowledge base
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div 
                  key={doc.id} 
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {getDocumentIcon(doc.type)}
                    <div>
                      <h4 className="font-medium text-gray-900">{doc.title}</h4>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-gray-500">
                          {doc.chunks} chunks
                        </span>
                        <span className="text-sm text-gray-500">
                          {doc.size}
                        </span>
                        <span className="text-sm text-gray-500">
                          {doc.characterCount?.toLocaleString()} characters
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(doc.status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReindex(doc.id)}
                      title="Reindex document"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Type Breakdown */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Document Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-900">Federal Acquisition Regulation</h4>
              </div>
              <p className="text-sm text-blue-700">
                Complete FAR document with {documents.find(d => d.type === 'far_matrix')?.chunks || 0} searchable chunks
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-orange-600" />
                <h4 className="font-medium text-orange-900">Auburn Policies</h4>
              </div>
              <p className="text-sm text-orange-700">
                Contract management guide and general terms with {
                  documents
                    .filter(d => d.type === 'auburn_policy' || d.type === 'approved_alternative')
                    .reduce((sum, d) => sum + d.chunks, 0)
                } chunks
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-green-600" />
                <h4 className="font-medium text-green-900">Contract Templates</h4>
              </div>
              <p className="text-sm text-green-700">
                Vendor agreement forms with {
                  documents.find(d => d.type === 'contract_template')?.chunks || 0
                } chunks
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-5 w-5 text-purple-600" />
                <h4 className="font-medium text-purple-900">Vector Database</h4>
              </div>
              <p className="text-sm text-purple-700">
                {statistics?.totalChunks?.toLocaleString() || 0} OpenAI embeddings (1536 dimensions)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* External Resources */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>External Resources</CardTitle>
          <CardDescription>Official sites and additional references</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "Federal Acquisition Regulation (FAR)", url: "https://www.acquisition.gov/far" },
              { name: "Auburn OSP Website", url: "https://cws.auburn.edu/osp" },
              { name: "Export Control (BIS)", url: "https://www.bis.doc.gov" },
              { name: "ITAR Guidelines", url: "https://www.pmddtc.state.gov" }
            ].map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{link.name}</span>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Powered by OpenAI text-embedding-3-small • Supabase pgvector
        </p>
      </div>
    </div>
  );
}