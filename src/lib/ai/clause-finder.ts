import { pipeline, Pipeline, env } from '@xenova/transformers';

env.backends.onnx.wasm.proxy = false;

export interface ClauseCandidate {
  text: string;
  type: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

let classifierInstance: any | null = null;

const CLAUSE_TYPES = [
  'dispute resolution',
  'arbitration',
  'termination',
  'indemnification',
  'liability',
  'equipment',
  'personnel',
  'records retention',
  'confidentiality',
  'intellectual property',
  'payment terms',
  'governing law',
  'warranties',
  'representations',
  'force majeure',
];

export async function initializeClauseFinder(): Promise<void> {
  if (!classifierInstance) {
    classifierInstance = await pipeline(
      'zero-shot-classification',
      'Xenova/mobilebert-uncased-mnli'
    );
  }
}

export async function findClauses(
  contractText: string,
  minConfidence: number = 0.3
): Promise<ClauseCandidate[]> {
  await initializeClauseFinder();
  
  if (!classifierInstance) {
    throw new Error('Clause finder not initialized');
  }

  const paragraphs = contractText
    .split(/\n\n+/)
    .map((p, idx) => ({
      text: p.trim(),
      startIndex: contractText.indexOf(p),
      endIndex: contractText.indexOf(p) + p.length,
      index: idx,
    }))
    .filter(p => p.text.length > 50);

  const candidates: ClauseCandidate[] = [];

  for (const paragraph of paragraphs) {
    try {
      const result = await classifierInstance(paragraph.text, CLAUSE_TYPES, {
        multi_label: true,
      });

      if (Array.isArray(result.labels)) {
        for (let i = 0; i < result.labels.length; i++) {
          if (result.scores[i] >= minConfidence) {
            candidates.push({
              text: paragraph.text,
              type: result.labels[i],
              confidence: result.scores[i],
              startIndex: paragraph.startIndex,
              endIndex: paragraph.endIndex,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error classifying paragraph:', error);
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  return candidates;
}

export function mapClauseTypeToCategory(clauseType: string): string {
  const mapping: Record<string, string> = {
    'dispute resolution': 'DisputeResolution',
    'arbitration': 'DisputeResolution',
    'termination': 'Termination',
    'equipment': 'Equipment',
    'personnel': 'Personnel',
    'records retention': 'RecordsRetention',
    'confidentiality': 'Confidential Information',
    'intellectual property': 'IP',
    'payment terms': 'Payment',
    'governing law': 'Governing Law',
    'warranties': 'Warranties',
    'indemnification': 'Indemnification',
    'liability': 'Liability',
  };

  return mapping[clauseType.toLowerCase()] || clauseType;
}
