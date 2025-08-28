"use client";

import { NavigationMinimal } from "@/components/navigation-minimal";
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
} from "lucide-react";

const metrics = {
  overview: {
    totalReviewed: 1284,
    violationsDetected: 89,
    complianceRate: 94.2,
    avgReviewTime: 32,
  },
  monthlyTrends: [
    { month: "Jan", contracts: 198, violations: 12 },
    { month: "Feb", contracts: 187, violations: 8 },
    { month: "Mar", contracts: 223, violations: 14 },
    { month: "Apr", contracts: 201, violations: 7 },
    { month: "May", contracts: 195, violations: 9 },
    { month: "Jun", contracts: 180, violations: 5 },
  ],
  violationTypes: [
    { type: "FAR 28.106 - Indemnification", count: 23, percentage: 26 },
    { type: "FAR 27.402 - IP Rights", count: 18, percentage: 20 },
    { type: "Payment Terms", count: 15, percentage: 17 },
    { type: "FAR 52.245-1 - Gov Property", count: 12, percentage: 13 },
    { type: "Auburn Publication Rights", count: 8, percentage: 9 },
    { type: "Other", count: 13, percentage: 15 },
  ],
  performanceMetrics: {
    detectionAccuracy: 94.2,
    processingSpeed: 98.5,
    systemUptime: 99.9,
    userSatisfaction: 87.3,
    tfidfConfidence: 85.0,
  },
};

export default function MetricsPage() {
  return (
    <div className="flex h-screen bg-white">
      <NavigationMinimal />
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Performance Metrics
            </h1>
            <p className="text-sm text-gray-600">
              System performance and compliance analytics
            </p>
          </div>

          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-gray-600">
                    Total Reviews
                  </CardTitle>
                  <FileText className="h-4 w-4 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold text-gray-900">
                  {metrics.overview.totalReviewed.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 mt-1">All time</p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-gray-600">
                    Violations Found
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold text-gray-900">
                  {metrics.overview.violationsDetected}
                </div>
                <p className="text-xs text-gray-500 mt-1">This month</p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-gray-600">
                    Compliance Rate
                  </CardTitle>
                  <CheckCircle className="h-4 w-4 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold text-gray-900">
                  {metrics.overview.complianceRate}%
                </div>
                <Progress value={metrics.overview.complianceRate} className="h-1 mt-2" />
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-gray-600">
                    Avg Review Time
                  </CardTitle>
                  <Clock className="h-4 w-4 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold text-gray-900">
                  {metrics.overview.avgReviewTime}s
                </div>
                <p className="text-xs text-gray-500 mt-1">Per contract</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Monthly Trends */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-900">
                  Monthly Review Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.monthlyTrends.map((month) => (
                    <div key={month.month} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700">{month.month}</span>
                        <span className="text-gray-600">
                          {month.contracts} contracts • {month.violations} violations
                        </span>
                      </div>
                      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="absolute h-full bg-gray-900 rounded-full"
                          style={{ width: `${(month.contracts / 250) * 100}%` }}
                        />
                        <div 
                          className="absolute h-full bg-red-500 rounded-full"
                          style={{ width: `${(month.violations / 250) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Violation Distribution */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-900">
                  Violation Types Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.violationTypes.map((type) => (
                    <div key={type.type} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700 truncate flex-1 mr-2">
                          {type.type}
                        </span>
                        <span className="text-gray-600">
                          {type.count} ({type.percentage}%)
                        </span>
                      </div>
                      <Progress value={type.percentage} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Performance */}
          <Card className="border-gray-200 shadow-sm mt-6">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-900">
                System Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {metrics.performanceMetrics.detectionAccuracy}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Detection Accuracy</p>
                  <Progress value={metrics.performanceMetrics.detectionAccuracy} className="h-1 mt-2" />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {metrics.performanceMetrics.processingSpeed}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Processing Speed</p>
                  <Progress value={metrics.performanceMetrics.processingSpeed} className="h-1 mt-2" />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {metrics.performanceMetrics.systemUptime}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">System Uptime</p>
                  <Progress value={metrics.performanceMetrics.systemUptime} className="h-1 mt-2" />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {metrics.performanceMetrics.userSatisfaction}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">User Satisfaction</p>
                  <Progress value={metrics.performanceMetrics.userSatisfaction} className="h-1 mt-2" />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {metrics.performanceMetrics.tfidfConfidence}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">TF-IDF Confidence</p>
                  <Progress value={metrics.performanceMetrics.tfidfConfidence} className="h-1 mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Info */}
          <Card className="border-gray-200 shadow-sm mt-6">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-900">
                Technical Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 text-xs">
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-700">FAR Compliance Engine</h3>
                  <div className="space-y-1 text-gray-600">
                    <div>• 5 Active FAR rules</div>
                    <div>• Pattern matching algorithm</div>
                    <div>• Real-time violation detection</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-700">Auburn Policy Engine</h3>
                  <div className="space-y-1 text-gray-600">
                    <div>• 4 University policies</div>
                    <div>• State entity compliance</div>
                    <div>• Alternative language suggestions</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-700">AI Analysis</h3>
                  <div className="space-y-1 text-gray-600">
                    <div>• TF-IDF with cosine similarity</div>
                    <div>• 85% confidence threshold</div>
                    <div>• OpenRouter API ready</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}