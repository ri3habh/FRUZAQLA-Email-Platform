"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { CandidateClaim } from "@/types";

const CATEGORIES = [
  "all",
  "efficacy",
  "safety",
  "dosing",
  "mechanism",
  "indication",
  "contraindication",
];

const CONFIDENCE_BADGE = (confidence: number) => {
  if (confidence >= 0.85) return "bg-green-100 text-green-700";
  if (confidence >= 0.6) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
};

function ClaimCard({
  claim,
  onApprove,
  onReject,
  onEdit,
  selected,
  onToggle,
}: {
  claim: CandidateClaim;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(claim.exact_text);

  return (
    <div
      className={`bg-white border rounded-lg p-4 space-y-3 ${
        selected ? "border-blue-400" : "border-gray-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(claim.id)}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium uppercase text-blue-600">
              {claim.category}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${CONFIDENCE_BADGE(claim.confidence)}`}
            >
              {Math.round(claim.confidence * 100)}% confidence
            </span>
            <span className="text-xs text-gray-400">
              {claim.source_document} · p.{claim.source_page}
            </span>
          </div>
        </div>
      </div>

      {/* Context */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded p-3 leading-relaxed">
        {claim.surrounding_context}
      </div>

      {/* Extracted claim */}
      <div>
        <p className="text-xs text-gray-400 mb-1">Extracted claim</p>
        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full text-sm border border-blue-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        ) : (
          <p className="text-sm text-gray-800">{claim.exact_text}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {editing ? (
          <>
            <button
              onClick={() => {
                onEdit(claim.id, editText);
                setEditing(false);
              }}
              className="text-xs border border-blue-400 text-blue-600 rounded px-3 py-1.5 hover:bg-blue-50"
            >
              Save edit
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onReject(claim.id)}
              className="text-xs border border-gray-300 text-gray-600 rounded px-3 py-1.5 hover:bg-gray-50"
            >
              Reject
            </button>
            <button
              onClick={() => setEditing(true)}
              className="text-xs border border-gray-300 text-gray-600 rounded px-3 py-1.5 hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={() => onApprove(claim.id)}
              className="text-xs bg-green-600 text-white rounded px-3 py-1.5 hover:bg-green-700 ml-auto"
            >
              Approve
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ClaimsPageInner() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("doc_id") ?? undefined;

  const [claims, setClaims] = useState<CandidateClaim[]>([]);
  const [category, setCategory] = useState("all");
  const [minConfidence, setMinConfidence] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .getClaimQueue({
        doc_id: docId,
        category: category === "all" ? undefined : category,
        min_confidence: minConfidence || undefined,
      })
      .then(setClaims)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [docId, category, minConfidence]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === claims.length
        ? new Set()
        : new Set(claims.map((c) => c.id))
    );
  }

  async function handleApprove(id: string) {
    await api.approveClaim(id);
    setClaims((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleReject(id: string) {
    await api.rejectClaim(id);
    setClaims((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleEdit(id: string, text: string) {
    await api.editClaim(id, text);
    load();
  }

  async function handleBulkApprove() {
    const ids = [...selected];
    await api.bulkApproveClaims(ids);
    setClaims((prev) => prev.filter((c) => !selected.has(c.id)));
    setSelected(new Set());
  }

  async function handleBulkReject() {
    const ids = [...selected];
    await api.bulkRejectClaims(ids);
    setClaims((prev) => prev.filter((c) => !selected.has(c.id)));
    setSelected(new Set());
  }

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Claim Review Queue</h1>
        <Link href="/admin/documents" className="text-sm text-blue-600 hover:underline">
          Documents
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                category === c
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <select
          value={minConfidence}
          onChange={(e) => setMinConfidence(Number(e.target.value))}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 ml-auto"
        >
          <option value={0}>All confidence</option>
          <option value={0.85}>High only (≥85%)</option>
          <option value={0.6}>Medium+ (≥60%)</option>
        </select>
      </div>

      {/* Bulk actions */}
      {claims.length > 0 && (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          <input
            type="checkbox"
            checked={selected.size === claims.length}
            onChange={toggleAll}
          />
          <span className="text-xs text-gray-500">
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </span>
          {selected.size > 0 && (
            <>
              <button
                onClick={handleBulkReject}
                className="text-xs border border-gray-300 rounded px-3 py-1 hover:bg-gray-100 ml-auto"
              >
                Reject selected
              </button>
              <button
                onClick={handleBulkApprove}
                className="text-xs bg-green-600 text-white rounded px-3 py-1 hover:bg-green-700"
              >
                Approve selected
              </button>
            </>
          )}
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {!loading && claims.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">
          No pending claims. All done!
        </p>
      )}

      <div className="space-y-4">
        {claims.map((claim) => (
          <ClaimCard
            key={claim.id}
            claim={claim}
            selected={selected.has(claim.id)}
            onToggle={toggleSelect}
            onApprove={handleApprove}
            onReject={handleReject}
            onEdit={handleEdit}
          />
        ))}
      </div>
    </main>
  );
}

export default function ClaimsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
      <ClaimsPageInner />
    </Suspense>
  );
}
