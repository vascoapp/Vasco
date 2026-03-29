"use client";

import { useState } from "react";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";

// =============================================================================
// VIDEO GENERATOR — Admin panel for Remotion video pipeline
// =============================================================================
// Generates video scripts from trade data, renders via Remotion.
// Integrates with the content pipeline Kanban for review workflow.
// =============================================================================

const TEMPLATES = [
  { id: "did-you-know", label: "Did You Know", icon: "💡", description: "Trade fact with stat counter animation", duration: "21s" },
  { id: "price-check", label: "Price Check", icon: "💰", description: "Supplier price comparison with savings callout", duration: "21s" },
  { id: "before-after", label: "Before / After", icon: "🔄", description: "Job showcase with swipe transition", duration: "16s" },
  { id: "eve-says", label: "EVE Says", icon: "🤖", description: "AI tip with typewriter effect", duration: "16s" },
  { id: "compliance-alert", label: "Compliance Alert", icon: "🛡️", description: "Country-specific regulation countdown", duration: "21s" },
];

const TRADES = [
  { id: "plumbing", label: "Plumbing", emoji: "🔧" },
  { id: "electrical", label: "Electrical", emoji: "⚡" },
  { id: "gas", label: "Gas / HVAC", emoji: "🔥" },
  { id: "painting", label: "Painting", emoji: "🎨" },
  { id: "carpentry", label: "Carpentry", emoji: "🪚" },
  { id: "roofing", label: "Roofing", emoji: "🏠" },
  { id: "tiling", label: "Tiling", emoji: "🔲" },
  { id: "plastering", label: "Plastering", emoji: "🧱" },
  { id: "flooring", label: "Flooring", emoji: "🪵" },
  { id: "insulation", label: "Insulation", emoji: "🧊" },
  { id: "solar", label: "Solar / PV", emoji: "☀️" },
  { id: "glazing", label: "Glazing", emoji: "🪟" },
  { id: "landscaping", label: "Landscaping", emoji: "🌿" },
];

const LANGUAGES = [
  { code: "EN", flag: "🇬🇧", label: "English" },
  { code: "NL", flag: "🇳🇱", label: "Dutch" },
  { code: "DE", flag: "🇩🇪", label: "German" },
  { code: "FR", flag: "🇫🇷", label: "French" },
  { code: "ES", flag: "🇪🇸", label: "Spanish" },
  { code: "IT", flag: "🇮🇹", label: "Italian" },
];

interface GeneratedScript {
  templateId: string;
  trade: string;
  language: string;
  outputFilename: string;
  estimatedDurationSec: number;
  props: Record<string, unknown>;
  status: "pending" | "rendering" | "done" | "error";
}

export function AdminVideoGenerator() {
  const [selectedTemplate, setSelectedTemplate] = useState("all");
  const [selectedTrade, setSelectedTrade] = useState("plumbing");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["EN"]);
  const [replicateAll, setReplicateAll] = useState(false);
  const [scripts, setScripts] = useState<GeneratedScript[]>([]);
  const [generating, setGenerating] = useState(false);

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const handleGenerate = () => {
    setGenerating(true);
    const langs = replicateAll ? LANGUAGES.map((l) => l.code) : selectedLanguages;
    const templates = selectedTemplate === "all" ? TEMPLATES.map((t) => t.id) : [selectedTemplate];

    const generated: GeneratedScript[] = [];
    for (const lang of langs) {
      for (const tpl of templates) {
        generated.push({
          templateId: tpl,
          trade: selectedTrade,
          language: lang,
          outputFilename: `${tpl}_${selectedTrade}_${lang.toLowerCase()}.mp4`,
          estimatedDurationSec: TEMPLATES.find((t) => t.id === tpl)?.duration === "16s" ? 16 : 21,
          props: { trade: selectedTrade, language: lang },
          status: "pending",
        });
      }
    }

    setScripts(generated);
    // Simulate generation (in production, this would call the Remotion API)
    setTimeout(() => {
      setScripts((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
      setGenerating(false);
    }, 2000);
  };

  const totalEstimatedCost = scripts.length * 0.03; // ~€0.03 per video via Lambda

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-[#0D1B2A]">Video Generator</h2>
      <AdminDemoBanner />

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Template Selection */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Template</p>
          <div className="space-y-2">
            <button
              onClick={() => setSelectedTemplate("all")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${selectedTemplate === "all" ? "bg-[#E35205] text-white font-medium" : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
            >
              🎬 All Templates ({TEMPLATES.length})
            </button>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setSelectedTemplate(tpl.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${selectedTemplate === tpl.id ? "bg-[#E35205] text-white font-medium" : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
              >
                {tpl.icon} {tpl.label}
                <span className="block text-[10px] opacity-70">{tpl.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Trade Selection */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Trade</p>
          <select
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white mb-3"
          >
            {TRADES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.emoji} {t.label}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-400">
            Selected trade determines: materials, certifications, seasonal tips, pricing data
          </div>
        </div>

        {/* Language Selection */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Languages</p>
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={replicateAll}
              onChange={(e) => setReplicateAll(e.target.checked)}
              className="rounded accent-[#E35205]"
            />
            <span className="text-sm font-medium text-gray-700">Replicate to all 6 markets</span>
          </label>
          {!replicateAll && (
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => toggleLanguage(lang.code)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${selectedLanguages.includes(lang.code) ? "bg-[#E35205] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {lang.flag} {lang.code}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-6 py-3 rounded-xl bg-[#E35205] text-white font-semibold text-sm hover:bg-[#c44700] transition disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? (
            <>
              <span className="animate-spin">⏳</span> Generating...
            </>
          ) : (
            <>🎬 Generate {replicateAll ? `${(selectedTemplate === "all" ? TEMPLATES.length : 1) * 6}` : `${(selectedTemplate === "all" ? TEMPLATES.length : 1) * selectedLanguages.length}`} Videos</>
          )}
        </button>
        {scripts.length > 0 && (
          <span className="text-xs text-gray-400">
            Est. cost: €{totalEstimatedCost.toFixed(2)} via Lambda · {scripts.reduce((s, v) => s + v.estimatedDurationSec, 0)}s total
          </span>
        )}
      </div>

      {/* Generated Scripts Queue */}
      {scripts.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-bold text-[#0D1B2A]">
              Generated Videos ({scripts.filter((s) => s.status === "done").length}/{scripts.length})
            </span>
            <button className="text-xs text-[#E35205] font-medium hover:underline">
              Export All Scripts (JSON)
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {scripts.map((script, i) => {
              const tpl = TEMPLATES.find((t) => t.id === script.templateId);
              const lang = LANGUAGES.find((l) => l.code === script.language);
              return (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{tpl?.icon ?? "🎬"}</span>
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {tpl?.label ?? script.templateId}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {lang?.flag} {script.language} · {script.estimatedDurationSec}s
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{script.outputFilename}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        script.status === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : script.status === "rendering"
                          ? "bg-amber-100 text-amber-700"
                          : script.status === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {script.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pipeline Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Templates</p>
          <p className="mt-1 text-2xl font-bold text-[#0D1B2A]">{TEMPLATES.length}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Trades</p>
          <p className="mt-1 text-2xl font-bold text-[#0D1B2A]">{TRADES.length}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Languages</p>
          <p className="mt-1 text-2xl font-bold text-[#0D1B2A]">6</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Max Videos</p>
          <p className="mt-1 text-2xl font-bold text-[#E35205]">{TEMPLATES.length * TRADES.length * 6}</p>
          <p className="text-[10px] text-gray-400">at €{(TEMPLATES.length * TRADES.length * 6 * 0.03).toFixed(0)} total</p>
        </div>
      </div>
    </div>
  );
}
