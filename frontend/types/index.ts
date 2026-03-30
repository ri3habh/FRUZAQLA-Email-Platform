export type ContentType = "email" | "banner" | "social" | "slide";
export type BlockType = "header" | "free_text" | "isi" | "footer" | "takeda_logo" | "image" | "divider" | "drawing";
export type ComplianceStatus = "verified" | "unverified" | "warning" | "error";
export type ClaimCategory =
  | "efficacy"
  | "safety"
  | "dosing"
  | "mechanism"
  | "indication"
  | "contraindication"
  | "boilerplate";

export interface CanvasBlock {
  id: string;
  type: BlockType;
  locked: boolean;
  order: number;
  compliance_status: ComplianceStatus;
  content: {
    text?: string;
    claim_id?: string;
    asset_id?: string;      // attached image asset id
    asset_url?: string;     // attached image url (for rendering)
    asset_name?: string;    // attached image display name
    drawing_data?: string;  // base64 PNG data URL for drawing blocks
  };
  source?: {
    document: string;
    page?: number;
  } | null;
}

export interface CanvasState {
  project_id: string;
  blocks: CanvasBlock[];
  brand_tokens: Record<string, string>;
  updated_at: string;
}

export interface ContentProject {
  id: string;
  title: string;
  content_type: ContentType;
  audience: string;
  status: string;
  created_at: string;
  compliance?: string | null;
  preview_blocks?: string[];
}

export interface ApprovedClaim {
  id: string;
  text: string;
  category: ClaimCategory;
  source_document: string;
  source_page?: number;
}

export interface CandidateClaim {
  id: string;
  exact_text: string;
  surrounding_context: string;
  category: ClaimCategory;
  confidence: number;
  source_document: string;
  source_page: number;
  status: "pending_review" | "approved" | "rejected";
  source_doc_id: string;
}

export interface VisualAsset {
  id: string;
  filename: string;
  url: string;
  asset_type: "icon" | "graph" | "logo" | "graphic";
  description: string;
  tags: string[];
}

export interface SourceDocument {
  id: string;
  filename: string;
  doc_type: string;
  status: "pending" | "processing" | "complete" | "failed";
  candidate_count: number;
  approved_count: number;
  rejected_count: number;
  uploaded_at: string;
}

export interface ComplianceCheck {
  rule: string;
  description: string;
  severity: "error" | "warning";
  block_ids?: string[];
}

export interface ComplianceReport {
  project_id: string;
  overall: "pass" | "warn" | "fail";
  checks: ComplianceCheck[];
  can_export: boolean;
}

export interface ContentVersion {
  id: string;
  version_number: number;
  label: string;
  created_by: string;
  compliance_status: string;
  created_at: string;
  has_canvas: boolean;
}

export interface BlockComment {
  id: string;
  project_id: string;
  block_id: string | null;
  author: string;
  text: string;
  resolved: boolean;
  created_at: string;
}
