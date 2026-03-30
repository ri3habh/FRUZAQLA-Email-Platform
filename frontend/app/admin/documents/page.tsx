"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { SourceDocument } from "@/types";

const DOC_TYPES = [
  { value: "prescribing_info", label: "Prescribing Information" },
  { value: "clinical_trial", label: "Clinical Trial / Visual Aid" },
  { value: "style_guide", label: "Style Guide" },
  { value: "visual_aid", label: "Other Approved Material" },
];

const STATUS_COLORS: Record<SourceDocument["status"], string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-700",
  complete: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<SourceDocument[]>([]);
  const [docType, setDocType] = useState("prescribing_info");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    api.listDocuments().then(setDocs);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("doc_type", docType);
    try {
      await api.ingestDocument(form);
      load();
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Source Documents</h1>
        <Link href="/admin/claims" className="text-sm text-blue-600 hover:underline">
          Review claim queue
        </Link>
      </div>

      {/* Upload form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-sm">Ingest a document</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-500 mb-1">Document type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-500 mb-1">PDF file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-[var(--brand-primary_color)] text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-40 hover:opacity-90 whitespace-nowrap"
          >
            {uploading ? "Processing..." : "Ingest"}
          </button>
        </div>
        {uploading && (
          <p className="text-xs text-blue-600">
            Extracting claims with Claude — this may take 30-60s for large PDFs...
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Document list */}
      <div className="space-y-3">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-sm">{doc.filename}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {DOC_TYPES.find((t) => t.value === doc.doc_type)?.label ?? doc.doc_type}
                {" · "}
                {new Date(doc.uploaded_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {doc.status === "complete" && (
                <p className="text-xs text-gray-500">
                  {doc.approved_count}/{doc.candidate_count} approved
                </p>
              )}
              <span
                className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[doc.status]}`}
              >
                {doc.status}
              </span>
              {doc.status === "complete" && doc.candidate_count > 0 && (
                <Link
                  href={`/admin/claims?doc_id=${doc.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Review
                </Link>
              )}
            </div>
          </div>
        ))}

        {docs.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            No documents ingested yet.
          </p>
        )}
      </div>
    </main>
  );
}
