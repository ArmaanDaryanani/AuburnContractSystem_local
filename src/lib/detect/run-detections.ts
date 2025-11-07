import { ClauseDetection, PolicyRule } from '../policy/types';
import { loadFARRules } from '../policy/load-far';
import { loadAuburnTnCRules } from '../policy/load-tnc';
import { findClauses, mapClauseTypeToCategory } from '../ai/clause-finder';
import { fuzzySearchClause, extractExactSpan } from '../rag/fuzzy-matcher';

export interface DetectionOptions {
  useAI?: boolean;
  minConfidence?: number;
  fuzzyThreshold?: number;
}

export async function runDetections(
  contractText: string,
  options: DetectionOptions = {}
): Promise<ClauseDetection[]> {
  const {
    useAI = true,
    minConfidence = 0.3,
    fuzzyThreshold = 0.35,
  } = options;

  const detections: ClauseDetection[] = [];
  
  const [farRules, auburnRules] = await Promise.all([
    loadFARRules(),
    loadAuburnTnCRules(),
  ]);

  const allRules = [...farRules, ...auburnRules];

  let aiCandidates: any[] = [];
  if (useAI) {
    try {
      aiCandidates = await findClauses(contractText, minConfidence);
    } catch (error) {
      console.error('AI clause finding failed, falling back to fuzzy matching:', error);
    }
  }

  for (const rule of allRules) {
    if (rule.prohibitedPatterns && rule.prohibitedPatterns.length > 0) {
      for (const pattern of rule.prohibitedPatterns) {
        const fuzzyMatch = fuzzySearchClause(contractText, pattern, fuzzyThreshold);

        if (fuzzyMatch.matched && fuzzyMatch.exactText !== 'MISSING_CLAUSE') {
          const exactSpan = extractExactSpan(fuzzyMatch.exactText, pattern);
          
          detections.push({
            id: `${rule.id}-${detections.length}`,
            type: 'PROBLEMATIC_TEXT',
            severity: rule.risk,
            category: rule.category,
            exactText: exactSpan?.text || fuzzyMatch.exactText,
            startIndex: fuzzyMatch.startIndex,
            endIndex: fuzzyMatch.endIndex,
            reference: rule.references?.join(', '),
            explanation: rule.requestToSponsor || `Prohibited pattern found: ${pattern}`,
            preferredLanguage: rule.requirementText,
            confidence: 1 - fuzzyMatch.score,
          });
        }
      }
    }

    if (rule.requirementText && rule.acceptanceStatus !== 'OK') {
      const fuzzyMatch = fuzzySearchClause(contractText, rule.requirementText, fuzzyThreshold);

      if (!fuzzyMatch.matched || fuzzyMatch.exactText === 'MISSING_CLAUSE') {
        if (rule.risk === 'CRITICAL' || rule.risk === 'HIGH') {
          detections.push({
            id: `${rule.id}-missing`,
            type: 'MISSING_CLAUSE',
            severity: rule.risk,
            category: rule.category,
            reference: rule.references?.join(', '),
            explanation: `Missing required clause: ${rule.category}`,
            preferredLanguage: rule.requirementText,
            confidence: 0.9,
          });
        }
      }
    }
  }

  if (useAI && aiCandidates.length > 0) {
    for (const candidate of aiCandidates) {
      const category = mapClauseTypeToCategory(candidate.type);
      const relevantRules = allRules.filter(r => 
        r.category.toLowerCase().includes(category.toLowerCase()) ||
        category.toLowerCase().includes(r.category.toLowerCase())
      );

      for (const rule of relevantRules) {
        if (rule.prohibitedPatterns) {
          for (const pattern of rule.prohibitedPatterns) {
            const paragraphMatch = fuzzySearchClause(candidate.text, pattern, fuzzyThreshold);
            
            if (paragraphMatch.matched && paragraphMatch.exactText !== 'MISSING_CLAUSE') {
              const alreadyDetected = detections.some(d => 
                d.exactText === paragraphMatch.exactText &&
                d.category === rule.category
              );

              if (!alreadyDetected) {
                detections.push({
                  id: `AI-${rule.id}-${detections.length}`,
                  type: 'PROBLEMATIC_TEXT',
                  severity: rule.risk,
                  category: rule.category,
                  exactText: paragraphMatch.exactText,
                  startIndex: candidate.startIndex + paragraphMatch.startIndex,
                  endIndex: candidate.startIndex + paragraphMatch.endIndex,
                  reference: rule.references?.join(', '),
                  explanation: `AI detected ${candidate.type} clause with prohibited language`,
                  preferredLanguage: rule.requirementText,
                  confidence: candidate.confidence * (1 - paragraphMatch.score),
                });
              }
            }
          }
        }
      }
    }
  }

  detections.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return detections;
}

export async function runDetectionsWithPages(
  pages: { pageNumber: number; text: string }[],
  options: DetectionOptions = {}
): Promise<ClauseDetection[]> {
  const allDetections: ClauseDetection[] = [];

  for (const page of pages) {
    const pageDetections = await runDetections(page.text, options);
    
    pageDetections.forEach(detection => {
      detection.pageNumber = page.pageNumber;
      allDetections.push(detection);
    });
  }

  return allDetections;
}
