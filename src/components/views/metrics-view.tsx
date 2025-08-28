"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  TrendingUp,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Database,
  Cpu,
  Zap,
  Server,
  HardDrive,
} from "lucide-react";

export default function MetricsView() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics');
      if (response.ok) {
        const data = await response.json();
        console.log('[MetricsView] Fetched metrics:', data);
        setMetrics(data);
      } else {
        console.error('[MetricsView] Failed to fetch metrics:', response.status);
      }
    } catch (error) {
      console.error('[MetricsView] Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map(i => (
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
          System Metrics & Analytics
        </h1>
        <p className="text-sm text-gray-600">
          Real-time RAG system performance and knowledge base statistics
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-600">
                Total Documents
              </CardTitle>
              <FileText className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-gray-900">
              {metrics?.overview?.totalDocuments || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">In knowledge base</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-600">
                Vector Embeddings
              </CardTitle>
              <Database className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-gray-900">
              {metrics?.overview?.totalEmbeddings?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-gray-500 mt-1">OpenAI vectors</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-600">
                RAG Status
              </CardTitle>
              <Activity className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-gray-900">
              <Badge variant={metrics?.overview?.ragStatus === 'Operational' ? 'default' : 'secondary'}>
                {metrics?.overview?.ragStatus || 'Unknown'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">System health</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-600">
                Avg Chunks/Doc
              </CardTitle>
              <HardDrive className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-gray-900">
              {metrics?.overview?.embeddingsPerDoc || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Document granularity</p>
          </CardContent>
        </Card>
      </div>

      {/* Document Breakdown */}
      {metrics?.documentBreakdown && (
        <Card className="border-gray-200 shadow-sm mb-8">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Knowledge Base Composition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.documentBreakdown.map((doc: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{doc.type}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {doc.chunks.toLocaleString()} chunks • {doc.size}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{doc.count} doc{doc.count !== 1 ? 's' : ''}</Badge>
                    <div className="mt-1">
                      <Progress 
                        value={(doc.chunks / metrics.overview.totalEmbeddings) * 100} 
                        className="h-1 w-24" 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Search Performance */}
        {metrics?.searchMetrics && (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Search Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Average Search Time</span>
                  <span className="font-medium">{metrics.searchMetrics.avgSearchTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Semantic Accuracy</span>
                  <span className="font-medium">{metrics.searchMetrics.semanticAccuracy}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Embedding Model</span>
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                    {metrics.searchMetrics.embeddingModel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Vector Dimensions</span>
                  <span className="font-medium">{metrics.searchMetrics.vectorDimensions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Vectors</span>
                  <span className="font-medium">{metrics.searchMetrics.totalVectors?.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Health */}
        {metrics?.systemHealth && (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Server className="h-4 w-4" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">RAG System</span>
                  <Badge variant={metrics.systemHealth.ragStatus === 'Operational' ? 'default' : 'destructive'}>
                    {metrics.systemHealth.ragStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <Badge variant={metrics.systemHealth.databaseStatus === 'Connected' ? 'default' : 'destructive'}>
                    {metrics.systemHealth.databaseStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">OpenAI API</span>
                  <Badge variant={metrics.systemHealth.openAIStatus === 'Active' ? 'default' : 'destructive'}>
                    {metrics.systemHealth.openAIStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Supabase</span>
                  <Badge variant={metrics.systemHealth.supabaseStatus === 'Active' ? 'default' : 'destructive'}>
                    {metrics.systemHealth.supabaseStatus}
                  </Badge>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    Last sync: {new Date(metrics.systemHealth.lastSync).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Historical Performance */}
      <Card className="border-gray-200 shadow-sm mt-8">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Contract Review Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">95%</div>
              <div className="text-xs text-gray-600 mt-1">Avg Confidence</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">8.5s</div>
              <div className="text-xs text-gray-600 mt-1">Avg Analysis Time</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">11</div>
              <div className="text-xs text-gray-600 mt-1">Avg Violations/Contract</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">$0.04</div>
              <div className="text-xs text-gray-600 mt-1">Total Embedding Cost</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}