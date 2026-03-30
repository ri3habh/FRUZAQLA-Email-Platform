"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type {
  ApprovedClaim,
  BlockComment,
  CanvasBlock,
  CanvasState,
  ComplianceReport,
  ContentVersion,
  VisualAsset,
} from "@/types";

// ── Author name (persisted to localStorage) ───────────────────────────────────

function useAuthorName(): [string, () => string] {
  const getOrPrompt = useCallback((): string => {
    const stored = localStorage.getItem("solstice_author");
    if (stored) return stored;
    const name = window.prompt("Your name (for version history and comments):", "") ?? "Anonymous";
    const trimmed = name.trim() || "Anonymous";
    localStorage.setItem("solstice_author", trimmed);
    return trimmed;
  }, []);
  const [name] = useState<string>(() => {
    if (typeof window === "undefined") return "Anonymous";
    return localStorage.getItem("solstice_author") ?? "";
  });
  return [name, getOrPrompt];
}

// ── Compliance badge ──────────────────────────────────────────────────────────

function ComplianceBadge({ status }: { status: CanvasBlock["compliance_status"] }) {
  const map = {
    verified:   "bg-green-100 text-green-700",
    unverified: "bg-yellow-100 text-yellow-700",
    warning:    "bg-orange-100 text-orange-700",
    error:      "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${map[status]}`}>
      {status}
    </span>
  );
}


// ── Text block (with optional image attachment) ───────────────────────────────

function TextBlock({
  block,
  onTextChange,
  onAcceptClaim,
  onAttachAsset,
  onDetachAsset,
  onDelete,
  onAddComment,
  onDragStart,
  onDragOver,
  onDrop,
  claims,
  assets,
  commentCount,
}: {
  block: CanvasBlock;
  onTextChange: (id: string, text: string) => void;
  onAcceptClaim: (blockId: string, claim: ApprovedClaim) => void;
  onAttachAsset: (blockId: string, asset: VisualAsset) => void;
  onDetachAsset: (blockId: string) => void;
  onDelete: (id: string) => void;
  onAddComment: (blockId: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: () => void;
  claims: ApprovedClaim[];
  assets: VisualAsset[];
  commentCount: number;
}) {
  const [showClaims, setShowClaims] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const isVerified = block.compliance_status === "verified";
  const hasImage = !!block.content.asset_id;

  if (block.locked) {
    const isHeader = block.type === "header";
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
        {isHeader ? (
          <>
            <img
              src="/assets/hallmark-header.jpeg"
              alt="FRUZAQLA hallmark header"
              className="w-full block"
            />
            <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: "var(--brand-primary_color)" }}>
              <span className="text-white font-bold text-base">FRUZAQLA<sup className="text-xs">®</sup></span>
              <span className="text-white/70 text-xs">(fruquintinib)</span>
              <div className="ml-auto flex items-center gap-2">
                <svg className="w-3 h-3 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-white/50">Required</span>
                <ComplianceBadge status="verified" />
              </div>
            </div>
          </>
        ) : (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-gray-400">Required · {block.source?.document ?? block.type}</span>
              <ComplianceBadge status="verified" />
            </div>
            {block.type === "takeda_logo" ? (
              <div className="text-center">
                <img
                  src="/assets/takeda-footer-logo.jpg"
                  alt="Takeda Oncology"
                  className="block max-w-[240px] mx-auto mb-2"
                />
                <p className="text-[9px] text-gray-500 leading-relaxed">
                  TAKEDA® and the TAKEDA logo® are registered trademarks of Takeda Pharmaceutical Company Limited.
                  FRUZAQLA and Ô are trademarks of HUTCHMED Group Enterprises Limited, used under license.
                  © 20XX Takeda Pharmaceuticals U.S.A., Inc. All rights reserved. USO-FRQ-XXXX XX/20XX
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {block.content.text ?? `[${block.type} block]`}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="border border-gray-200 rounded-lg p-4 bg-white relative group"
      draggable
      onDragStart={() => onDragStart(block.id)}
      onDragOver={(e) => onDragOver(e, block.id)}
      onDrop={onDrop}
    >
      {/* Drag handle */}
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-gray-300 select-none" title="Drag to reorder">
        ⠿
      </div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ComplianceBadge status={block.compliance_status} />
          {isVerified && block.source && (
            <span className="text-xs text-gray-400">
              {block.source.document}{block.source.page ? `, p.${block.source.page}` : ""}
            </span>
          )}
          {!isVerified && block.content.text && (
            <span className="text-xs text-gray-400">Human-written</span>
          )}
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {isVerified && (
            <button onClick={() => onTextChange(block.id, "")} className="text-xs text-gray-300 hover:text-orange-400">
              Clear claim
            </button>
          )}
          <button onClick={() => onDelete(block.id)} className="text-xs text-gray-300 hover:text-red-500">
            Remove
          </button>
        </div>
      </div>

      {/* Attached image */}
      {hasImage && block.content.asset_url && (
        <div className="mb-3 relative">
          <img
            src={block.content.asset_url}
            alt={block.content.asset_name ?? ""}
            className="max-h-32 rounded border border-gray-100 object-contain"
          />
          <button
            onClick={() => onDetachAsset(block.id)}
            className="absolute top-1 left-1 bg-white border border-gray-200 rounded text-[10px] px-1.5 py-0.5 text-gray-400 hover:text-red-500"
          >
            ✕ Remove image
          </button>
        </div>
      )}

      {/* Text area */}
      <textarea
        value={block.content.text ?? ""}
        onChange={(e) => onTextChange(block.id, e.target.value)}
        onFocus={() => setShowClaims(true)}
        onBlur={() => setTimeout(() => { setShowClaims(false); }, 200)}
        placeholder={
          isVerified
            ? "Approved claim — edit to override"
            : "Write freely, or pick an approved claim below..."
        }
        rows={3}
        className="w-full text-sm text-gray-800 border-none outline-none resize-none bg-transparent placeholder-gray-300"
      />

      {/* Action bar */}
      <div className="flex items-center gap-2 mt-1 pt-1 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
        {!hasImage && (
          <button
            onMouseDown={(e) => { e.preventDefault(); setShowAssets((v) => !v); }}
            className="text-xs text-gray-400 hover:text-purple-600 flex items-center gap-1"
          >
            🖼 Attach image
          </button>
        )}
        <button
          onMouseDown={(e) => { e.preventDefault(); onAddComment(block.id); }}
          className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-1 ml-auto"
        >
          💬 {commentCount > 0 ? <span className="bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5 text-[10px] font-medium">{commentCount}</span> : "Comment"}
        </button>
      </div>

      {/* Claim suggestions popover */}
      {showClaims && !isVerified && claims.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          <p className="text-xs text-gray-400 px-3 pt-2 pb-1 border-b border-gray-100">Insert approved claim</p>
          {claims.map((claim) => (
            <button
              key={claim.id}
              onMouseDown={() => onAcceptClaim(block.id, claim)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-100 last:border-0"
            >
              <span className="text-blue-500 uppercase mr-1 font-medium">{claim.category}</span>
              {claim.text.slice(0, 120)}{claim.text.length > 120 ? "…" : ""}
            </button>
          ))}
        </div>
      )}

      {/* Asset picker popover */}
      {showAssets && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
          <p className="text-xs text-gray-400 px-1 pb-2 border-b border-gray-100 mb-2">Attach image to this block</p>
          <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
            {assets.map((asset) => (
              <button
                key={asset.id}
                onMouseDown={() => { onAttachAsset(block.id, asset); setShowAssets(false); }}
                className="border border-gray-100 rounded p-1 hover:border-blue-300 hover:bg-blue-50"
              >
                <img
                  src={asset.url}
                  alt={asset.tags?.[0] ?? asset.filename}
                  className="w-full h-10 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <p className="text-[9px] text-gray-400 mt-0.5 truncate">{asset.tags?.[0] ?? asset.filename}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drawing block ─────────────────────────────────────────────────────────────

const DRAW_COLORS = ["#000000", "#002855", "#8C4799", "#59CBE8", "#97D700", "#FF0000", "#ffffff"];

function DrawingBlock({
  block,
  onSave,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  block: CanvasBlock;
  onSave: (id: string, dataUrl: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);
  const [isEmpty, setIsEmpty] = useState(!block.content.drawing_data);

  // Restore saved drawing on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (block.content.drawing_data) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = block.content.drawing_data;
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? lineWidth * 6 : lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    setIsEmpty(false);
  }

  function endDraw() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current!;
    onSave(block.id, canvas.toDataURL("image/png"));
  }

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onSave(block.id, canvas.toDataURL("image/png"));
  }

  return (
    <div
      className="border border-gray-200 rounded-lg bg-white group relative"
      draggable
      onDragStart={() => onDragStart(block.id)}
      onDragOver={(e) => onDragOver(e, block.id)}
      onDrop={onDrop}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 flex-wrap">
        {/* Tool buttons */}
        <button
          onClick={() => setTool("pen")}
          className={`text-xs px-2 py-1 rounded border ${tool === "pen" ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
        >
          ✏️ Pen
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`text-xs px-2 py-1 rounded border ${tool === "eraser" ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
        >
          🧹 Eraser
        </button>

        {/* Color swatches */}
        <div className="flex gap-1 ml-1">
          {DRAW_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool("pen"); }}
              style={{ backgroundColor: c, borderColor: color === c ? "#555" : "#e5e7eb" }}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c && tool === "pen" ? "scale-125" : ""}`}
            />
          ))}
        </div>

        {/* Line width */}
        <input
          type="range"
          min={1}
          max={12}
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
          className="w-16 accent-gray-600"
          title="Brush size"
        />
        <span className="text-[10px] text-gray-400">{lineWidth}px</span>

        <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-orange-500">
            Clear
          </button>
          <button onClick={() => onDelete(block.id)} className="text-xs text-gray-300 hover:text-red-500">
            Remove
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="w-full cursor-crosshair touch-none block"
        style={{ background: "#fff" }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {isEmpty && (
        <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center text-xs text-gray-300" style={{ top: "2.5rem" }}>
          Draw here — signatures, diagrams, sketches
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  projectId,
  claims,
  assets,
  versions,
  comments,
  activeTab,
  onTabChange,
  onRestoreVersion,
  onSaveSnapshot,
  onResolveComment,
  onDeleteComment,
  onAddCommentSubmit,
  focusedBlockId,
}: {
  projectId: string;
  claims: ApprovedClaim[];
  assets: VisualAsset[];
  versions: ContentVersion[];
  comments: BlockComment[];
  activeTab: "claims" | "assets" | "history" | "comments";
  onTabChange: (t: "claims" | "assets" | "history" | "comments") => void;
  onRestoreVersion: (v: ContentVersion) => void;
  onSaveSnapshot: () => void;
  onResolveComment: (id: string) => void;
  onDeleteComment: (id: string) => void;
  onAddCommentSubmit: (text: string, blockId?: string) => void;
  focusedBlockId: string | null;
}) {
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [commentText, setCommentText] = useState("");
  const assetTypes = ["all", "icon", "graph", "logo", "graphic"];
  const filteredAssets = assetFilter === "all"
    ? assets
    : assets.filter((a) => a.asset_type === assetFilter);

  const openComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);

  function submitComment() {
    const text = commentText.trim();
    if (!text) return;
    onAddCommentSubmit(text, focusedBlockId ?? undefined);
    setCommentText("");
  }

  const TABS = [
    { id: "claims" as const, label: "Claims", count: claims.length },
    { id: "assets" as const, label: "Assets", count: assets.length },
    { id: "history" as const, label: "History", count: versions.length },
    { id: "comments" as const, label: "Comments", count: openComments.length },
  ];

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`flex-1 py-2.5 text-[10px] font-medium capitalize transition-colors relative ${
              activeTab === t.id
                ? "border-b-2 border-[var(--brand-secondary_color)] text-[var(--brand-secondary_color)]"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-0.5 text-[9px] ${activeTab === t.id ? "text-[var(--brand-secondary_color)]" : "text-gray-300"}`}>
                ({t.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Claims ── */}
      {activeTab === "claims" && (
        <>
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-400">Focus a text block, then click a claim to insert it as verified</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {claims.map((claim) => (
              <div key={claim.id} className="p-2 rounded border border-gray-100 text-xs text-gray-700 hover:border-blue-200 hover:bg-blue-50 cursor-default">
                <span className="text-blue-500 uppercase text-[10px] font-medium mr-1">{claim.category}</span>
                {claim.text.slice(0, 100)}{claim.text.length > 100 ? "…" : ""}
              </div>
            ))}
            {claims.length === 0 && (
              <p className="text-xs text-gray-400 p-2">
                No approved claims yet.{" "}
                <a href="/admin/claims" className="text-blue-500 underline">Admin → Claims</a>
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Assets ── */}
      {activeTab === "assets" && (
        <>
          <div className="px-3 py-2 border-b border-gray-100 flex gap-1 flex-wrap">
            {assetTypes.map((t) => (
              <button
                key={t}
                onClick={() => setAssetFilter(t)}
                className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${
                  assetFilter === t
                    ? "bg-[var(--brand-secondary_color)] text-white border-transparent"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
            <p className="col-span-2 text-xs text-gray-400 px-1 pb-1">Hover a text block and click "Attach image" to use these</p>
            {filteredAssets.map((asset) => (
              <div key={asset.id} className="border border-gray-100 rounded-lg p-2 text-left">
                <div className="w-full h-16 bg-gray-50 rounded mb-1 flex items-center justify-center overflow-hidden">
                  <img
                    src={asset.url}
                    alt={asset.description}
                    className="max-h-14 max-w-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 leading-tight line-clamp-2">{asset.tags?.[0] ?? asset.filename}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── History ── */}
      {activeTab === "history" && (
        <>
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">{versions.length} saved version{versions.length !== 1 ? "s" : ""}</p>
            <button
              onClick={onSaveSnapshot}
              className="text-xs bg-[var(--brand-secondary_color)] text-white px-2 py-1 rounded hover:opacity-90"
            >
              + Save version
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {versions.length === 0 && (
              <p className="text-xs text-gray-400 p-2">No versions yet. Click "Save version" to take a snapshot.</p>
            )}
            {versions.map((v) => {
              const statusColor =
                v.compliance_status === "pass" ? "text-green-600" :
                v.compliance_status === "warn" ? "text-yellow-600" :
                v.compliance_status === "fail" ? "text-red-600" : "text-gray-400";
              return (
                <div key={v.id} className="border border-gray-100 rounded-lg p-2.5 text-xs">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div>
                      <span className="font-medium text-gray-700">v{v.version_number}</span>
                      {v.label && <span className="ml-1.5 text-gray-500">{v.label}</span>}
                    </div>
                    <span className={`text-[10px] font-medium ${statusColor}`}>
                      {v.compliance_status !== "unknown" ? v.compliance_status : ""}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-1.5">
                    {v.created_by} · {new Date(v.created_at).toLocaleString()}
                  </p>
                  {v.has_canvas && (
                    <button
                      onClick={() => onRestoreVersion(v)}
                      className="text-[10px] text-blue-500 hover:text-blue-700 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50"
                    >
                      Restore
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Comments ── */}
      {activeTab === "comments" && (
        <>
          <div className="px-3 py-2 border-b border-gray-100">
            {focusedBlockId ? (
              <p className="text-xs text-blue-500">Commenting on selected block</p>
            ) : (
              <p className="text-xs text-gray-400">Click 💬 on a block to target it, or add a general comment</p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {openComments.length === 0 && resolvedComments.length === 0 && (
              <p className="text-xs text-gray-400 p-2">No comments yet.</p>
            )}
            {openComments.map((c) => (
              <div key={c.id} className="border border-blue-100 bg-blue-50/40 rounded-lg p-2.5 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-700">{c.author}</span>
                  <div className="flex gap-1">
                    <button onClick={() => onResolveComment(c.id)} className="text-[10px] text-green-600 hover:underline">Resolve</button>
                    <button onClick={() => onDeleteComment(c.id)} className="text-[10px] text-gray-300 hover:text-red-500">✕</button>
                  </div>
                </div>
                <p className="text-gray-600 leading-relaxed">{c.text}</p>
                {c.block_id && <p className="text-[10px] text-gray-400 mt-1">on block {c.block_id.slice(0, 8)}…</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(c.created_at).toLocaleString()}</p>
              </div>
            ))}
            {resolvedComments.length > 0 && (
              <>
                <p className="text-[10px] text-gray-400 px-1 pt-2">Resolved</p>
                {resolvedComments.map((c) => (
                  <div key={c.id} className="border border-gray-100 rounded-lg p-2.5 text-xs opacity-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-500 line-through">{c.author}</span>
                      <div className="flex gap-1">
                        <button onClick={() => onResolveComment(c.id)} className="text-[10px] text-gray-400 hover:underline">Reopen</button>
                        <button onClick={() => onDeleteComment(c.id)} className="text-[10px] text-gray-300 hover:text-red-500">✕</button>
                      </div>
                    </div>
                    <p className="text-gray-500 line-through leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </>
            )}
          </div>
          {/* Add comment input */}
          <div className="border-t border-gray-100 p-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment(); }}
              placeholder="Add a comment… (⌘↵ to send)"
              rows={2}
              className="w-full text-xs border border-gray-200 rounded p-2 resize-none outline-none focus:border-blue-300"
            />
            <button
              onClick={submitComment}
              disabled={!commentText.trim()}
              className="mt-1 w-full text-xs bg-[var(--brand-secondary_color)] text-white rounded py-1.5 hover:opacity-90 disabled:opacity-40"
            >
              Post comment
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

// ── Main canvas page ──────────────────────────────────────────────────────────

export default function CanvasPage() {
  const { id } = useParams<{ id: string }>();
  const [canvas, setCanvas]     = useState<CanvasState | null>(null);
  const [claims, setClaims]     = useState<ApprovedClaim[]>([]);
  const [assets, setAssets]     = useState<VisualAsset[]>([]);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [comments, setComments] = useState<BlockComment[]>([]);
  const [report, setReport]     = useState<ComplianceReport | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"claims" | "assets" | "history" | "comments">("claims");
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [, getOrPromptAuthor] = useAuthorName();
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    api.getCanvas(id).then(setCanvas);
    api.listClaims().then(setClaims);
    api.listAssets().then(setAssets);
    api.listVersions(id).then(setVersions);
    api.listComments(id).then(setComments);
    api.getProject(id).then((p) => setProjectTitle(p.title));
  }, [id]);

  async function commitTitleRename(newTitle: string) {
    const trimmed = newTitle.trim();
    if (trimmed && trimmed !== projectTitle) {
      await api.renameProject(id, trimmed);
      setProjectTitle(trimmed);
    }
    setEditingTitle(false);
  }

  // Inject brand tokens as CSS variables
  useEffect(() => {
    if (!canvas?.brand_tokens) return;
    const root = document.documentElement;
    Object.entries(canvas.brand_tokens).forEach(([k, v]) => {
      root.style.setProperty(`--brand-${k}`, v as string);
    });
  }, [canvas?.brand_tokens]);

  const save = useCallback(
    async (blocks: CanvasBlock[]) => {
      setSaving(true);
      await api.updateCanvas(id, blocks).finally(() => setSaving(false));
    },
    [id]
  );

  function updateBlock(blockId: string, text: string) {
    if (!canvas) return;
    const blocks = canvas.blocks.map((b) =>
      b.id === blockId
        ? {
            ...b,
            // Editing text clears claim linkage — becomes human-written
            content: { text },
            compliance_status: "unverified" as const,
            source: null,
          }
        : b
    );
    setCanvas({ ...canvas, blocks });
    save(blocks);
  }

  function acceptClaim(blockId: string, claim: ApprovedClaim) {
    if (!canvas) return;
    const blocks = canvas.blocks.map((b) =>
      b.id === blockId
        ? {
            ...b,
            content: { text: claim.text, claim_id: claim.id },
            compliance_status: "verified" as const,
            source: { document: claim.source_document, page: claim.source_page },
          }
        : b
    );
    setCanvas({ ...canvas, blocks });
    save(blocks);
  }

  function attachAsset(blockId: string, asset: VisualAsset) {
    if (!canvas) return;
    const blocks = canvas.blocks.map((b) =>
      b.id === blockId
        ? {
            ...b,
            content: {
              ...b.content,
              asset_id: asset.id,
              asset_url: asset.url,
              asset_name: asset.tags?.[0] ?? asset.filename,
            },
          }
        : b
    );
    setCanvas({ ...canvas, blocks });
    save(blocks);
  }

  function detachAsset(blockId: string) {
    if (!canvas) return;
    const blocks = canvas.blocks.map((b) => {
      if (b.id !== blockId) return b;
      const { asset_id, asset_url, asset_name, ...rest } = b.content;
      return { ...b, content: rest };
    });
    setCanvas({ ...canvas, blocks });
    save(blocks);
  }

  function handleDragStart(id: string) {
    dragId.current = id;
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!canvas || !dragId.current || dragId.current === overId) return;
    const drag = canvas.blocks.find((b) => b.id === dragId.current);
    const over = canvas.blocks.find((b) => b.id === overId);
    if (!drag || !over || drag.locked || over.locked) return;
    // Swap orders
    const blocks = canvas.blocks.map((b) => {
      if (b.id === drag.id) return { ...b, order: over.order };
      if (b.id === over.id) return { ...b, order: drag.order };
      return b;
    });
    setCanvas({ ...canvas, blocks });
  }

  function handleDrop() {
    if (!canvas || !dragId.current) return;
    save(canvas.blocks);
    dragId.current = null;
  }

  function _nextOrder() {
    if (!canvas) return 1;
    return Math.max(0, ...canvas.blocks.filter((b) => !b.locked).map((b) => b.order)) + 1;
  }

  function addTextBlock() {
    if (!canvas) return;
    const newBlock: CanvasBlock = {
      id: crypto.randomUUID(),
      type: "free_text",
      locked: false,
      order: _nextOrder(),
      compliance_status: "unverified",
      content: {},
      source: null,
    };
    const blocks = [...canvas.blocks, newBlock];
    setCanvas({ ...canvas, blocks });
    save(blocks);
  }

  function addDrawingBlock() {
    if (!canvas) return;
    const newBlock: CanvasBlock = {
      id: crypto.randomUUID(),
      type: "drawing",
      locked: false,
      order: _nextOrder(),
      compliance_status: "unverified",
      content: {},
      source: null,
    };
    const blocks = [...canvas.blocks, newBlock];
    setCanvas({ ...canvas, blocks });
    save(blocks);
  }

  function saveDrawing(blockId: string, dataUrl: string) {
    if (!canvas) return;
    const blocks = canvas.blocks.map((b) =>
      b.id === blockId ? { ...b, content: { ...b.content, drawing_data: dataUrl } } : b
    );
    setCanvas({ ...canvas, blocks });
    save(blocks);
  }

  function deleteBlock(blockId: string) {
    if (!canvas) return;
    const blocks = canvas.blocks.filter((b) => b.id !== blockId);
    setCanvas({ ...canvas, blocks });
    save(blocks);
  }

  async function handleSaveSnapshot() {
    const author = getOrPromptAuthor();
    const label = window.prompt("Version label (optional):", "") ?? "";
    const result = await api.saveSnapshot(id, label.trim(), author);
    const refreshed = await api.listVersions(id);
    setVersions(refreshed);
    setSidebarTab("history");
    alert(`Saved as v${result.version_number}`);
  }

  async function handleRestoreVersion(v: ContentVersion) {
    if (!window.confirm(`Restore to v${v.version_number}${v.label ? ` "${v.label}"` : ""}? Current state will be auto-saved first.`)) return;
    const author = getOrPromptAuthor();
    await api.restoreVersion(id, v.id, author);
    const [refreshedCanvas, refreshedVersions] = await Promise.all([
      api.getCanvas(id),
      api.listVersions(id),
    ]);
    setCanvas(refreshedCanvas);
    setVersions(refreshedVersions);
    setReport(null);
  }

  async function handleAddComment(text: string, blockId?: string) {
    const author = getOrPromptAuthor();
    const comment = await api.addComment(id, author, text, blockId);
    setComments((prev) => [...prev, comment]);
  }

  async function handleResolveComment(commentId: string) {
    const updated = await api.resolveComment(id, commentId);
    setComments((prev) => prev.map((c) => c.id === commentId ? updated : c));
  }

  async function handleDeleteComment(commentId: string) {
    await api.deleteComment(id, commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  function handleBlockComment(blockId: string) {
    setFocusedBlockId(blockId);
    setSidebarTab("comments");
  }

  async function checkCompliance() {
    setChecking(true);
    const result = await api.checkCompliance(id).finally(() => setChecking(false));
    setReport(result);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${id}/export`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Export failed" }));
        alert(err.message ?? "Export failed");
        return;
      }
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match?.[1] ?? "email.html";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      // Refresh versions — export auto-creates a snapshot
      api.listVersions(id).then(setVersions);
    } finally {
      setExporting(false);
    }
  }

  if (!canvas) {
    return <div className="p-8 text-gray-400">Loading canvas...</div>;
  }

  const sorted = [...canvas.blocks].sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar
        projectId={id}
        claims={claims}
        assets={assets}
        versions={versions}
        comments={comments}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        onRestoreVersion={handleRestoreVersion}
        onSaveSnapshot={handleSaveSnapshot}
        onResolveComment={handleResolveComment}
        onDeleteComment={handleDeleteComment}
        onAddCommentSubmit={handleAddComment}
        focusedBlockId={focusedBlockId}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">Emails</a>
          <span className="text-gray-300">/</span>
          {editingTitle ? (
            <input
              autoFocus
              className="text-sm font-medium border-b border-gray-400 outline-none bg-transparent px-0.5"
              defaultValue={projectTitle}
              onBlur={(e) => commitTitleRename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingTitle(false);
              }}
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-sm font-medium hover:text-[#8C4799] transition-colors"
              title="Click to rename"
            >
              {projectTitle || "Canvas"}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {saving && <span className="text-xs text-gray-400">Saving...</span>}
            <button
              onClick={handleSaveSnapshot}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50"
            >
              Save version
            </button>
            <button
              onClick={checkCompliance}
              disabled={checking}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
            >
              {checking ? "Checking..." : "Check Compliance"}
            </button>
            {report?.can_export && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="text-sm bg-green-600 text-white rounded-md px-3 py-1.5 hover:bg-green-700 disabled:opacity-40"
              >
                {exporting ? "Exporting..." : "Export HTML"}
              </button>
            )}
          </div>
        </div>

        {/* Compliance banner */}
        {report && (
          <div className={`px-6 py-2 text-sm border-b flex items-start gap-2 flex-wrap ${
            report.overall === "pass"  ? "bg-green-50 border-green-200 text-green-800" :
            report.overall === "warn"  ? "bg-yellow-50 border-yellow-200 text-yellow-800" :
                                         "bg-red-50 border-red-200 text-red-800"
          }`}>
            <strong>
              {report.overall === "pass" ? "All checks passed" :
               report.overall === "warn" ? "Warnings" : "Compliance issues"}
            </strong>
            {report.checks.map((c, i) => (
              <span key={i}>· {c.description}</span>
            ))}
          </div>
        )}

        {/* Canvas blocks */}
        <div className="flex-1 overflow-y-auto p-8">
          <div
            className="mx-auto space-y-3"
            style={{ maxWidth: "var(--brand-email_max_width, 600px)" }}
          >
            {sorted.map((block) =>
              block.type === "drawing" ? (
                <DrawingBlock
                  key={block.id}
                  block={block}
                  onSave={saveDrawing}
                  onDelete={deleteBlock}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ) : (
                <TextBlock
                  key={block.id}
                  block={block}
                  onTextChange={updateBlock}
                  onAcceptClaim={acceptClaim}
                  onAttachAsset={attachAsset}
                  onDetachAsset={detachAsset}
                  onDelete={deleteBlock}
                  onAddComment={handleBlockComment}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  claims={claims}
                  assets={assets}
                  commentCount={comments.filter((c) => c.block_id === block.id && !c.resolved).length}
                />
              )
            )}

            <div className="flex gap-2">
              <button
                onClick={addTextBlock}
                className="flex-1 border-2 border-dashed border-gray-200 rounded-lg py-4 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors"
              >
                + Add text block
              </button>
              <button
                onClick={addDrawingBlock}
                className="flex-1 border-2 border-dashed border-gray-200 rounded-lg py-4 text-sm text-gray-400 hover:border-purple-300 hover:text-purple-400 transition-colors"
              >
                ✏️ Add drawing
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
