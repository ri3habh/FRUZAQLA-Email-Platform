"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ContentProject } from "@/types";

// ── New email modal ───────────────────────────────────────────────────────────

function NewEmailModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (title: string, audience: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("HCP");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onCreate(title.trim(), audience);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">New email</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email name
            </label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. FRUZAQLA HCP Launch Q1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C4799]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Audience
            </label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C4799]"
            >
              <option value="HCP">Healthcare Provider (HCP)</option>
              <option value="Patient">Patient</option>
              <option value="Caregiver">Caregiver</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || loading}
              className="flex-1 bg-[#002855] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 hover:opacity-90"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Compliance dot ────────────────────────────────────────────────────────────

function ComplianceDot({ status }: { status?: string | null }) {
  if (!status || status === "unknown") return null;
  const map: Record<string, { color: string; label: string }> = {
    pass: { color: "bg-green-500",  label: "Compliance: pass" },
    warn: { color: "bg-yellow-400", label: "Compliance: warnings" },
    fail: { color: "bg-red-500",    label: "Compliance: errors" },
  };
  const cfg = map[status];
  if (!cfg) return null;
  return (
    <span title={cfg.label} className={`inline-block w-2 h-2 rounded-full ${cfg.color}`} />
  );
}

// ── Email card ────────────────────────────────────────────────────────────────

function EmailCard({
  project,
  onRename,
  onDelete,
}: {
  project: ContentProject;
  onRename: (id: string, currentTitle: string) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const date = new Date(project.created_at);
  const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const previews = project.preview_blocks ?? [];

  return (
    <div className="group relative flex flex-col rounded-xl border border-gray-200 hover:border-[#8C4799] hover:shadow-md transition-all bg-white overflow-hidden">
      {/* Thumbnail — click navigates */}
      <button
        onClick={() => router.push(`/projects/${project.id}/canvas`)}
        className="text-left w-full"
      >
        <div className="w-full bg-gray-50 border-b border-gray-100 overflow-hidden" style={{ height: "160px" }}>
          <div className="scale-[0.38] origin-top-left w-[600px]">
            {/* Hallmark header */}
            <div style={{ backgroundColor: "#002855" }}>
              <img src="/assets/hallmark-header.jpeg" alt="" style={{ width: "600px", display: "block" }} />
              <div style={{ padding: "10px 32px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#fff", fontWeight: "bold", fontSize: "20px", fontFamily: "Arial, sans-serif" }}>
                  FRUZAQLA<sup style={{ fontSize: "11px" }}>®</sup>
                </span>
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontFamily: "Arial, sans-serif" }}>(fruquintinib)</span>
              </div>
            </div>
            {/* Live content preview */}
            <div style={{ padding: "24px 32px", background: "#fff" }}>
              {previews.length > 0 ? (
                previews.map((text, i) => (
                  <p key={i} style={{
                    fontFamily: "Arial, sans-serif",
                    fontSize: i === 0 ? "16px" : "13px",
                    fontWeight: i === 0 ? "bold" : "normal",
                    color: i === 0 ? "#002855" : "#444",
                    marginBottom: "10px",
                    lineHeight: "1.4",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}>
                    {text}
                  </p>
                ))
              ) : (
                <>
                  <div style={{ height: "13px", background: "#e5e7eb", borderRadius: "3px", marginBottom: "10px", width: "65%" }} />
                  <div style={{ height: "10px", background: "#f3f4f6", borderRadius: "3px", marginBottom: "6px" }} />
                  <div style={{ height: "10px", background: "#f3f4f6", borderRadius: "3px", width: "80%" }} />
                </>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Card footer */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-medium text-gray-800 truncate flex-1 group-hover:text-[#002855]">
            {project.title}
          </p>
          {/* ··· menu */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity px-1 rounded leading-none text-base"
              title="More options"
            >
              ···
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-32 text-sm">
                  <button
                    onClick={() => { setMenuOpen(false); onRename(project.id, project.title); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(project.id, project.title); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <p className="text-xs text-gray-400">{dateStr}</p>
          {project.audience && <span className="text-gray-300 text-xs">·</span>}
          {project.audience && <p className="text-xs text-gray-400">{project.audience}</p>}
          <div className="ml-auto">
            <ComplianceDot status={project.compliance} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── New email card ────────────────────────────────────────────────────────────

function NewEmailCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left flex flex-col rounded-xl border-2 border-dashed border-gray-200 hover:border-[#8C4799] hover:bg-purple-50/30 transition-all bg-white overflow-hidden"
      style={{ minHeight: "220px" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-12 h-12 rounded-full border-2 border-gray-200 group-hover:border-[#8C4799] flex items-center justify-center transition-colors">
          <span className="text-2xl text-gray-300 group-hover:text-[#8C4799] leading-none" style={{ marginTop: "-2px" }}>+</span>
        </div>
        <span className="text-sm text-gray-400 group-hover:text-[#8C4799] font-medium">New email</span>
      </div>
    </button>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<ContentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    api.listProjects().then(setProjects).finally(() => setLoading(false));
  }, []);

  async function handleCreate(title: string, audience: string) {
    const { project_id } = await api.createProject({
      title,
      content_type: "email",
      audience,
      tone: "clinical",
    });
    router.push(`/projects/${project_id}/canvas`);
  }

  async function handleRename(id: string, currentTitle: string) {
    const next = window.prompt("Rename email:", currentTitle);
    if (!next || next.trim() === currentTitle) return;
    await api.renameProject(id, next.trim());
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, title: next.trim() } : p));
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await api.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Banner header ── */}
      <header style={{ backgroundColor: "#002855" }}>
        <img
          src="/assets/hallmark-header.jpeg"
          alt="FRUZAQLA"
          className="w-full block object-cover"
          style={{ maxHeight: "120px", objectPosition: "center" }}
        />
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-end justify-between">
          <div>
            <h1 className="text-white font-bold text-xl tracking-wide">
              FRUZAQLA<sup className="text-xs font-normal">®</sup>{" "}
              <span className="font-light">Email Platform</span>
            </h1>
            <p className="text-white/60 text-xs mt-0.5">FDA-compliant promotional emails · Takeda</p>
          </div>
          <a
            href="/admin/documents"
            className="text-white/50 text-xs hover:text-white/80 transition-colors"
          >
            Admin
          </a>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-6xl mx-auto px-8 py-8">
        {/* Section heading */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            {loading ? "Loading…" : projects.length === 0 ? "No emails yet" : `${projects.length} email${projects.length !== 1 ? "s" : ""}`}
          </h2>
        </div>

        {/* Grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {/* New email card always first */}
          <NewEmailCard onClick={() => setShowModal(true)} />

          {/* Existing emails */}
          {projects.map((p) => (
            <EmailCard
              key={p.id}
              project={p}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {/* Empty state nudge */}
        {!loading && projects.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-12">
            Click <strong>New email</strong> to get started.
          </p>
        )}
      </main>

      {showModal && (
        <NewEmailModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
