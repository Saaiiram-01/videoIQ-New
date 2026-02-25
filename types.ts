
export type VideoType = 'Social Media' | 'Ad / Commercial' | 'Educational' | 'Entertainment';

export interface SubMetric {
  name: string;
  score: number;
  status: 'Pass' | 'Fail' | 'Warning';
}

export interface AgencyCategory {
  score: number; // 1-10
  issues: string[];
  recommendations: string[];
  sub_metrics?: SubMetric[];
}

export interface CreativeSuggestion {
  title: string;
  description: string;
  trendFactor: string;
}

export interface KeyInsight {
  topic: string;
  summary: string;
  significance: string;
}

export interface ShotBreakdown {
  timestamp: string;
  visualDescription: string;
  technicalNote: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface SectionScore {
  section_id: string;
  section_label: string;
  score: number;
  points_earned: number;
  points_possible: number;
  failed_items: string[];
}

export interface ItemResult {
  item_id: string;
  result: 'passed' | 'failed' | 'skipped';
  reviewer_note?: string;
  override_reason?: string;
  reviewed_by: 'human' | 'ai' | 'system';
}

export interface AnalysisResult {
  review_id?: string;
  video_id?: string;
  reviewer?: string;
  reviewed_at?: string;
  platform?: string;
  overall_summary: string;
  hook_performance: AgencyCategory;
  motion_graphics: AgencyCategory;
  visual_technical: AgencyCategory;
  messaging_copy: AgencyCategory;
  audio_captions: AgencyCategory;
  platform_policy: AgencyCategory;
  
  // New scoring metrics
  overall_score: number;
  verdict: 'PASS' | 'NEEDS_REVIEW' | 'FAIL';
  verdict_message: string;
  points_earned: number;
  points_possible: number;
  critical_failures: number;
  high_failures: number;
  section_scores: SectionScore[];
  item_results?: ItemResult[];
  recommended_actions?: string[];
  resubmission_required: boolean;
  
  final_verdict: 'APPROVED' | 'MINOR FIX REQUIRED' | 'REJECTED'; // Keep for backward compat if needed, but verdict is primary
  creative_suggestions: CreativeSuggestion[];
  key_insights: KeyInsight[];
  videoType: VideoType;
  overallScore: number; // Keep for backward compat
  isHeuristic?: boolean;
  timestamped_betterment: Array<{
    timestamp: string;
    description: string;
    actionable_fix: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    chat_history?: ChatMessage[]; 
    isIgnored?: boolean;
    item_id?: string; // Link to checklist
  }>;
}

export interface HistoryItem {
  id: string;
  date: string;
  fileName: string;
  auditorName: string;
  result: AnalysisResult;
}

export interface FeedItem {
  id: string;
  title: string;
  description: string;
  url: string; // URL to video or thumbnail
  category: string;
  addedBy: string;
  date: string;
  tags: string[];
}

export interface UserFeedback {
  id: string;
  user: string;
  rating: number;
  type: 'Bug' | 'Feature' | 'Improvement' | 'Other';
  message: string;
  date: string;
}

export interface FrameData {
  data: string;
  timestamp: number;
}
