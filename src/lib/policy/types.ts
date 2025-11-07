export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type PolicySource = 'FAR' | 'AUBURN';

export interface PolicyRule {
  id: string;
  source: PolicySource;
  category: string;
  requirementText?: string;
  prohibitedPatterns?: string[];
  risk: RiskLevel;
  references?: string[];
  acceptanceStatus?: 'OK' | 'REMOVE' | 'C';
  acceptanceCriteria?: string;
  requestToSponsor?: string;
}

export interface FARClause {
  clause: string;
  title: string;
  date: string;
  acceptanceStatus: 'OK' | 'REMOVE' | 'C';
  criteria?: string;
  requestToSponsor?: string;
}

export interface AuburnTnC {
  category: string;
  preferredLanguage?: string;
  commonProblems?: string[];
  why?: string;
  firstResponse?: string;
  secondResponse?: string;
  thirdResponse?: string;
}

export interface ClauseDetection {
  id: string;
  type: 'MISSING_CLAUSE' | 'PROBLEMATIC_TEXT';
  severity: RiskLevel;
  category: string;
  exactText?: string;
  pageNumber?: number;
  startIndex?: number;
  endIndex?: number;
  reference?: string;
  explanation?: string;
  preferredLanguage?: string;
  confidence: number;
}
