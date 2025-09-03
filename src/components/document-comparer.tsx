"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import * as Diff from "diff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  FileText,
  GitCompare,
  Eye,
  EyeOff,
  Download,
  Settings,
  ArrowLeftRight,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle,
  BarChart,
  Type,
  AlignLeft,
  Hash,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ComparisonMode = 'character' | 'word' | 'line' | 'sentence';
export type ViewMode = 'side-by-side' | 'inline' | 'unified';

interface DiffStatistics {
  additions: number;
  deletions: number;
  changes: number;
  similarity: number;
  totalChanges: number;
}

interface DocumentComparisonProps {
  document1: {
    id: string;
    name: string;
    content: string;
    type?: string;
  };
  document2: {
    id: string;
    name: string;
    content: string;
    type?: string;
  };
  onClose?: () => void;
  highlightViolations?: boolean;
  violations?: Array<{
    documentId: string;
    text: string;
    severity: string;
  }>;
}

export function DocumentComparer({
  document1,
  document2,
  onClose,
  highlightViolations = false,
  violations = [],
}: DocumentComparisonProps) {
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('word');
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [showAdditions, setShowAdditions] = useState(true);
  const [showDeletions, setShowDeletions] = useState(true);
  const [synchronizeScroll, setSynchronizeScroll] = useState(true);
  const [isComparing, setIsComparing] = useState(false);
  
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef(false);

  // Calculate diff based on comparison mode
  const diffResult = useMemo(() => {
    setIsComparing(true);
    let diff;
    
    switch (comparisonMode) {
      case 'character':
        diff = Diff.diffChars(document1.content, document2.content);
        break;
      case 'word':
        diff = Diff.diffWords(document1.content, document2.content);
        break;
      case 'line':
        diff = Diff.diffLines(document1.content, document2.content);
        break;
      case 'sentence':
        diff = Diff.diffSentences(document1.content, document2.content);
        break;
      default:
        diff = Diff.diffWords(document1.content, document2.content);
    }
    
    setIsComparing(false);
    return diff;
  }, [document1.content, document2.content, comparisonMode]);

  // Calculate statistics
  const statistics: DiffStatistics = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    let changes = 0;
    let unchanged = 0;
    let total = 0;

    diffResult.forEach(part => {
      const length = part.value.length;
      total += length;
      
      if (part.added) {
        additions += length;
        changes++;
      } else if (part.removed) {
        deletions += length;
        changes++;
      } else {
        unchanged += length;
      }
    });

    const similarity = total > 0 ? (unchanged / total) * 100 : 0;

    return {
      additions,
      deletions,
      changes,
      similarity,
      totalChanges: changes,
    };
  }, [diffResult]);

  // Synchronized scrolling
  useEffect(() => {
    if (!synchronizeScroll) return;

    const leftScroll = leftScrollRef.current;
    const rightScroll = rightScrollRef.current;

    if (!leftScroll || !rightScroll) return;

    const handleLeftScroll = () => {
      if (isScrollingSyncRef.current) return;
      isScrollingSyncRef.current = true;
      
      const scrollPercentage = leftScroll.scrollTop / (leftScroll.scrollHeight - leftScroll.clientHeight);
      rightScroll.scrollTop = scrollPercentage * (rightScroll.scrollHeight - rightScroll.clientHeight);
      
      setTimeout(() => {
        isScrollingSyncRef.current = false;
      }, 10);
    };

    const handleRightScroll = () => {
      if (isScrollingSyncRef.current) return;
      isScrollingSyncRef.current = true;
      
      const scrollPercentage = rightScroll.scrollTop / (rightScroll.scrollHeight - rightScroll.clientHeight);
      leftScroll.scrollTop = scrollPercentage * (leftScroll.scrollHeight - leftScroll.clientHeight);
      
      setTimeout(() => {
        isScrollingSyncRef.current = false;
      }, 10);
    };

    leftScroll.addEventListener('scroll', handleLeftScroll);
    rightScroll.addEventListener('scroll', handleRightScroll);

    return () => {
      leftScroll.removeEventListener('scroll', handleLeftScroll);
      rightScroll.removeEventListener('scroll', handleRightScroll);
    };
  }, [synchronizeScroll]);

  // Render diff with highlighting
  const renderDiff = (side: 'left' | 'right' | 'unified') => {
    const elements: JSX.Element[] = [];
    let keyIndex = 0;

    diffResult.forEach((part) => {
      const isAddition = part.added;
      const isRemoval = part.removed;
      const show = (!isAddition && !isRemoval) || 
                   (isAddition && showAdditions) || 
                   (isRemoval && showDeletions);

      if (!show) return;

      // For side-by-side view
      if (viewMode === 'side-by-side') {
        if (side === 'left' && !isAddition) {
          elements.push(
            <span
              key={keyIndex++}
              className={cn(
                isRemoval && "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 line-through",
                !isRemoval && !isAddition && "text-gray-700 dark:text-gray-300"
              )}
            >
              {part.value}
            </span>
          );
        } else if (side === 'right' && !isRemoval) {
          elements.push(
            <span
              key={keyIndex++}
              className={cn(
                isAddition && "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300",
                !isRemoval && !isAddition && "text-gray-700 dark:text-gray-300"
              )}
            >
              {part.value}
            </span>
          );
        }
      } 
      // For inline/unified view
      else {
        elements.push(
          <span
            key={keyIndex++}
            className={cn(
              isAddition && "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300",
              isRemoval && "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 line-through",
              !isRemoval && !isAddition && "text-gray-700 dark:text-gray-300"
            )}
          >
            {part.value}
          </span>
        );
      }
    });

    return elements;
  };

  // Export comparison report
  const exportReport = () => {
    const report = {
      metadata: {
        document1: document1.name,
        document2: document2.name,
        comparisonDate: new Date().toISOString(),
        comparisonMode,
        statistics,
      },
      differences: diffResult.map(part => ({
        type: part.added ? 'addition' : part.removed ? 'deletion' : 'unchanged',
        content: part.value,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison-${document1.name}-${document2.name}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Header Controls */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                <CardTitle className="text-lg">Document Comparison</CardTitle>
                <Badge variant="outline" className="ml-2">
                  {Math.round(statistics.similarity)}% Similar
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={exportReport} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                {onClose && (
                  <Button onClick={onClose} variant="ghost" size="sm">
                    Close
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Comparison Settings */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Mode:</label>
                <Select value={comparisonMode} onValueChange={(v) => setComparisonMode(v as ComparisonMode)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="character">
                      <div className="flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        Character
                      </div>
                    </SelectItem>
                    <SelectItem value="word">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Word
                      </div>
                    </SelectItem>
                    <SelectItem value="line">
                      <div className="flex items-center gap-2">
                        <AlignLeft className="h-4 w-4" />
                        Line
                      </div>
                    </SelectItem>
                    <SelectItem value="sentence">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Sentence
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">View:</label>
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="side-by-side">Side by Side</SelectItem>
                    <SelectItem value="inline">Inline</SelectItem>
                    <SelectItem value="unified">Unified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showAdditions ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowAdditions(!showAdditions)}
                    >
                      {showAdditions ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      <Plus className="h-4 w-4 ml-1" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle additions</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showDeletions ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowDeletions(!showDeletions)}
                    >
                      {showDeletions ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      <Minus className="h-4 w-4 ml-1" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle deletions</TooltipContent>
                </Tooltip>

                {viewMode === 'side-by-side' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={synchronizeScroll ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSynchronizeScroll(!synchronizeScroll)}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Synchronized scrolling</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Statistics Bar */}
            <div className="grid grid-cols-4 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Additions</p>
                  <p className="font-semibold text-green-600">{statistics.additions}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Minus className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Deletions</p>
                  <p className="font-semibold text-red-600">{statistics.deletions}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Changes</p>
                  <p className="font-semibold text-orange-600">{statistics.totalChanges}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Similarity</p>
                  <p className="font-semibold text-blue-600">{Math.round(statistics.similarity)}%</p>
                </div>
              </div>
            </div>

            <Progress value={statistics.similarity} className="h-2" />
          </CardContent>
        </Card>

        {/* Comparison View */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-full">
            {isComparing ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Comparing documents...</p>
                </div>
              </div>
            ) : viewMode === 'side-by-side' ? (
              <div className="grid grid-cols-2 h-full">
                {/* Left Document */}
                <div className="border-r h-full flex flex-col">
                  <div className="p-3 border-b bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium text-sm truncate">{document1.name}</span>
                      <Badge variant="outline" className="ml-auto">Original</Badge>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-4" ref={leftScrollRef}>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {renderDiff('left')}
                      </pre>
                    </div>
                  </ScrollArea>
                </div>

                {/* Right Document */}
                <div className="h-full flex flex-col">
                  <div className="p-3 border-b bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium text-sm truncate">{document2.name}</span>
                      <Badge variant="outline" className="ml-auto">Modified</Badge>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-4" ref={rightScrollRef}>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {renderDiff('right')}
                      </pre>
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              /* Inline/Unified View */
              <div className="h-full flex flex-col">
                <div className="p-3 border-b bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium text-sm">{document1.name}</span>
                      <ArrowLeftRight className="h-4 w-4" />
                      <span className="font-medium text-sm">{document2.name}</span>
                    </div>
                    <Badge variant="outline">{viewMode === 'inline' ? 'Inline' : 'Unified'} View</Badge>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {renderDiff('unified')}
                    </pre>
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}