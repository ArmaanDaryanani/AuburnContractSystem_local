import React from 'react';
import { X, FileX, AlertTriangle } from 'lucide-react';
import { ViolationDetail } from '@/lib/contract-analysis';
import { Badge } from '@/components/ui/badge';

interface ViolationPopupProps {
  violation: ViolationDetail;
  onClose: () => void;
  position?: { x: number; y: number };
}

export function ViolationPopup({ violation, onClose, position }: ViolationPopupProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className={`relative max-w-lg w-full mx-4 p-6 rounded-lg border-2 shadow-xl max-h-[80vh] overflow-y-auto ${getSeverityColor(violation.severity || 'LOW')}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/50 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-4">
          {/* Missing clause indicator */}
          {violation.isMissingClause && (
            <div className="flex items-center gap-2 p-2 bg-gray-800 text-white rounded">
              <FileX className="h-4 w-4" />
              <span className="text-sm font-medium">Missing Required Clause</span>
            </div>
          )}

          {/* Title and severity */}
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              {violation.isMissingClause && <FileX className="h-5 w-5" />}
              {!violation.isMissingClause && <AlertTriangle className="h-5 w-5" />}
              {violation.type || 'Violation'}
            </h3>
            <div className="flex items-center gap-2">
              {violation.farReference && (
                <Badge variant="outline" className="text-xs">
                  {violation.farReference}
                </Badge>
              )}
              {violation.auburnPolicy && (
                <Badge variant="outline" className="text-xs">
                  {violation.auburnPolicy}
                </Badge>
              )}
              <Badge className={getSeverityColor(violation.severity || 'LOW')}>
                {violation.severity || 'LOW'}
              </Badge>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-sm">{violation.description}</p>
          </div>

          {/* Location and confidence */}
          {(violation.location || violation.confidence) && (
            <div className="text-xs text-gray-600 space-y-1">
              {violation.location && <p>Location: {violation.location}</p>}
              {violation.confidence && <p>Confidence: {(violation.confidence * 100).toFixed(0)}%</p>}
            </div>
          )}

          {/* Clause/Problematic text */}
          {violation.isMissingClause ? (
            <div className="p-3 bg-gray-100 rounded border border-gray-300">
              <p className="text-xs font-medium mb-1">Required Clause:</p>
              <p className="text-sm text-gray-600">{violation.clause}</p>
              <p className="text-xs text-gray-500 mt-2">
                ⚠️ This clause is required but was not found in the contract
              </p>
            </div>
          ) : violation.problematicText && violation.problematicText !== 'MISSING_CLAUSE' ? (
            <div className="p-3 bg-white/50 rounded border border-current/20">
              <p className="text-xs font-medium mb-1">Problematic Text Found:</p>
              <p className="text-sm italic">"{violation.problematicText}"</p>
            </div>
          ) : null}

          {/* Suggestion */}
          {violation.suggestion && (
            <div className="p-3 bg-green-50 rounded border border-green-200">
              <p className="text-xs font-medium text-green-800 mb-1">Suggested Fix:</p>
              <p className="text-sm text-green-700">{violation.suggestion}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}