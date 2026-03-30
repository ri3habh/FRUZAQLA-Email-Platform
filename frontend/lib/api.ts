import type {
  ApprovedClaim,
  BlockComment,
  CanvasBlock,
  CanvasState,
  CandidateClaim,
  ComplianceReport,
  ContentProject,
  ContentType,
  ContentVersion,
  SourceDocument,
  VisualAsset,
} from "@/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // ── Projects ──────────────────────────────────────────────────────────────
  listProjects: () => request<ContentProject[]>("/api/projects"),

  createProject: (body: {
    title: string;
    content_type: ContentType;
    audience?: string;
    tone?: string;
  }) =>
    request<{ project_id: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getProject: (id: string) => request<ContentProject>(`/api/projects/${id}`),

  renameProject: (id: string, title: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),

  getCanvas: (projectId: string) =>
    request<CanvasState>(`/api/projects/${projectId}/canvas`),

  updateCanvas: (projectId: string, blocks: CanvasBlock[]) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}/canvas`, {
      method: "PUT",
      body: JSON.stringify({ blocks }),
    }),

  // ── Claims ────────────────────────────────────────────────────────────────
  listAssets: (asset_type?: string) => {
    const qs = asset_type ? `?asset_type=${asset_type}` : "";
    return request<VisualAsset[]>(`/api/assets${qs}`);
  },

  listClaims: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][]
    ).toString();
    return request<ApprovedClaim[]>(`/api/claims${qs ? `?${qs}` : ""}`);
  },

  // ── Compliance ────────────────────────────────────────────────────────────
  checkCompliance: (projectId: string) =>
    request<ComplianceReport>(`/api/compliance/${projectId}/check`, {
      method: "POST",
    }),

  // ── Versions ──────────────────────────────────────────────────────────────
  listVersions: (projectId: string) =>
    request<ContentVersion[]>(`/api/projects/${projectId}/versions`),

  saveSnapshot: (projectId: string, label: string, createdBy: string) =>
    request<{ version_number: number }>(`/api/projects/${projectId}/snapshot`, {
      method: "POST",
      body: JSON.stringify({ label, created_by: createdBy }),
    }),

  restoreVersion: (projectId: string, versionId: string, createdBy: string) =>
    request<{ ok: boolean; restored_version: number }>(
      `/api/projects/${projectId}/versions/${versionId}/restore`,
      { method: "POST", body: JSON.stringify({ created_by: createdBy }) }
    ),

  // ── Comments ──────────────────────────────────────────────────────────────
  listComments: (projectId: string) =>
    request<BlockComment[]>(`/api/projects/${projectId}/comments`),

  addComment: (projectId: string, author: string, text: string, blockId?: string) =>
    request<BlockComment>(`/api/projects/${projectId}/comments`, {
      method: "POST",
      body: JSON.stringify({ author, text, block_id: blockId ?? null }),
    }),

  resolveComment: (projectId: string, commentId: string) =>
    request<BlockComment>(`/api/projects/${projectId}/comments/${commentId}/resolve`, {
      method: "PATCH",
    }),

  deleteComment: (projectId: string, commentId: string) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}/comments/${commentId}`, {
      method: "DELETE",
    }),

  // ── Export ────────────────────────────────────────────────────────────────
  exportProject: (projectId: string) =>
    fetch(`/api/projects/${projectId}/export`, { method: "POST" }),

  // ── Admin: documents ──────────────────────────────────────────────────────
  listDocuments: () => request<SourceDocument[]>("/admin/documents"),

  ingestDocument: (formData: FormData) =>
    fetch("/admin/documents/ingest", { method: "POST", body: formData }).then(
      (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      }
    ),

  // ── Admin: claim queue ────────────────────────────────────────────────────
  getClaimQueue: (params?: {
    doc_id?: string;
    category?: string;
    min_confidence?: number;
    status?: string;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return request<CandidateClaim[]>(`/admin/claims/queue${qs ? `?${qs}` : ""}`);
  },

  approveClaim: (id: string) =>
    request<{ approved_claim_id: string }>(`/admin/claims/${id}/approve`, {
      method: "POST",
    }),

  rejectClaim: (id: string) =>
    request<{ ok: boolean }>(`/admin/claims/${id}/reject`, { method: "POST" }),

  editClaim: (id: string, exact_text: string) =>
    request<CandidateClaim>(`/admin/claims/${id}`, {
      method: "PUT",
      body: JSON.stringify({ exact_text }),
    }),

  bulkApproveClaims: (ids: string[]) =>
    request<{ approved_count: number }>("/admin/claims/bulk-approve", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  bulkRejectClaims: (ids: string[]) =>
    request<{ rejected_count: number }>("/admin/claims/bulk-reject", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};
