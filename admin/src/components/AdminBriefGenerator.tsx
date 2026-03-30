"use client";

import { useEffect, useState } from "react";
import { fetchUGCDashboardData, type UGCDashboardData } from "@/lib/kpi";
import { generateBrief, exportBriefMarkdown, exportBriefWhatsApp, type BriefTemplate } from "@/lib/briefs";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";
import { getAllPlaybookIds } from "@/data/playbooks";

const LANGUAGES = ["NL", "DE", "FR", "EN", "ES", "IT"];
const NICHES = [{ id: "", label: "Auto-detect" }, ...getAllPlaybookIds().map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1).replace("-", " / ") }))];

export function AdminBriefGenerator() {
  const [ugcData, setUgcData] = useState<UGCDashboardData | null>(null);
  const [brief, setBrief] = useState<BriefTemplate | null>(null);
  const [language, setLanguage] = useState("NL");
  const [nicheId, setNicheId] = useState("");
  const [showBrandContext, setShowBrandContext] = useState(false);

  useEffect(() => { fetchUGCDashboardData(30).then(setUgcData); }, []);

  const handleGenerate = () => {
    if (!ugcData) return;
    const b = generateBrief({
      podLanguage: language,
      topHooks: ugcData.hookAnalysis,
      topFormats: ugcData.formatAnalysis,
      topVideos: ugcData.topPerformers,
      nicheId: nicheId || undefined,
    });
    setBrief(b);
  };

  const handleCopyMarkdown = () => {
    if (!brief) return;
    navigator.clipboard.writeText(exportBriefMarkdown(brief));
  };

  const handleCopyWhatsApp = () => {
    if (!brief) return;
    navigator.clipboard.writeText(exportBriefWhatsApp(brief));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-[#0D1B2A]">Brief Generator</h2>
      <AdminDemoBanner />

      <div className="flex items-center gap-3 flex-wrap">
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {LANGUAGES.map((l) => <option key={l} value={l}>{l} Pod</option>)}
        </select>
        <select value={nicheId} onChange={(e) => setNicheId(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {NICHES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
        <button onClick={handleGenerate} disabled={!ugcData} className="px-4 py-2 rounded-lg bg-[#E35205] text-white text-sm font-medium hover:bg-[#c44700] transition disabled:opacity-50">
          Generate Brief
        </button>
      </div>

      {brief && (
        <div className="rounded-2xl bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0D1B2A]">{brief.title}</h3>
            <div className="flex gap-2">
              <button onClick={handleCopyMarkdown} className="px-3 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200">Copy Markdown</button>
              <button onClick={handleCopyWhatsApp} className="px-3 py-1.5 text-xs bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200">Copy WhatsApp</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><span className="text-gray-400">Format:</span> <span className="font-medium capitalize">{brief.format.replace("-", " ")}</span></div>
            <div><span className="text-gray-400">Duration:</span> <span className="font-medium">{brief.duration}</span></div>
            <div><span className="text-gray-400">Due:</span> <span className="font-medium">{brief.dueDate}</span></div>
          </div>
          <div><p className="text-xs font-bold text-gray-500 mb-1">Objective</p><p className="text-sm text-gray-700">{brief.objective}</p></div>
          <div><p className="text-xs font-bold text-gray-500 mb-1">Hook Options</p>
            {brief.hookOptions.map((h, i) => <p key={i} className="text-sm text-gray-700">&quot;{h}&quot;</p>)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs font-bold text-emerald-600 mb-1">Do&apos;s</p>{brief.dosAndDonts.dos.map((d, i) => <p key={i} className="text-xs text-gray-600">+ {d}</p>)}</div>
            <div><p className="text-xs font-bold text-red-500 mb-1">Don&apos;ts</p>{brief.dosAndDonts.donts.map((d, i) => <p key={i} className="text-xs text-gray-600">- {d}</p>)}</div>
          </div>
          <div><p className="text-xs font-bold text-gray-500 mb-1">Key Messages</p>{brief.keyMessages.map((m, i) => <p key={i} className="text-sm text-gray-700">- {m}</p>)}</div>
          {brief.inspiration.length > 0 && (
            <div><p className="text-xs font-bold text-gray-500 mb-1">Inspiration (from data)</p>{brief.inspiration.map((ins, i) => <p key={i} className="text-xs text-gray-500">{ins}</p>)}</div>
          )}

          {/* Brand Context Toggle */}
          {brief.brandContext && (
            <>
              <button
                onClick={() => setShowBrandContext(!showBrandContext)}
                className="w-full text-left px-4 py-2.5 rounded-lg bg-orange-50 border border-orange-100 text-sm font-medium text-[#E35205] hover:bg-orange-100 transition"
              >
                {showBrandContext ? "Hide" : "Show"} Brand Context
                <span className="ml-2 text-xs text-orange-400">
                  {[
                    brief.brandContext.contentAngle && "angle",
                    brief.brandContext.playbook && "niche",
                    brief.brandContext.targetPersonas.length > 0 && `${brief.brandContext.targetPersonas.length} personas`,
                  ].filter(Boolean).join(" + ")}
                </span>
              </button>

              {showBrandContext && (
                <div className="space-y-4 pl-4 border-l-2 border-orange-200">
                  {/* Content Angle */}
                  {brief.brandContext.contentAngle && (
                    <div>
                      <p className="text-xs font-bold text-[#E35205] mb-1">Content Angle: {brief.brandContext.contentAngle.name}</p>
                      <p className="text-xs text-gray-600 mb-2">Arc: {brief.brandContext.contentAngle.emotionalTrigger}</p>
                      <p className="text-xs font-medium text-gray-500 mb-1">Hook patterns:</p>
                      {brief.brandContext.contentAngle.hookPatterns.map((h, i) => (
                        <p key={i} className="text-xs text-gray-600 italic">&quot;{h}&quot;</p>
                      ))}
                      <p className="text-xs font-medium text-gray-500 mt-2 mb-1">Example script:</p>
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">{brief.brandContext.contentAngle.exampleScript}</p>
                    </div>
                  )}

                  {/* Niche Playbook */}
                  {brief.brandContext.playbook && (
                    <div>
                      <p className="text-xs font-bold text-[#1E3A8A] mb-1">Niche: {brief.brandContext.playbook.communityName}</p>
                      <p className="text-xs text-gray-600 mb-1">Core desire: {brief.brandContext.playbook.coreDesire}</p>
                      <p className="text-xs text-gray-600 mb-2">Emotional driver: {brief.brandContext.playbook.emotionalDriver}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Insider language:</p>
                          {brief.brandContext.playbook.topSlang.map(([term, def], i) => (
                            <p key={i} className="text-xs text-gray-600"><span className="font-medium">{term}</span>: {def}</p>
                          ))}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Hot topics:</p>
                          {brief.brandContext.playbook.hotTopics.map((t, i) => (
                            <p key={i} className="text-xs text-gray-600">- {t}</p>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs font-medium text-red-500 mt-2 mb-1">Credibility killers:</p>
                      {brief.brandContext.playbook.credibilityKillers.map((k, i) => (
                        <p key={i} className="text-xs text-red-400">- {k}</p>
                      ))}
                    </div>
                  )}

                  {/* Target Personas */}
                  {brief.brandContext.targetPersonas.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-1">Target Personas</p>
                      {brief.brandContext.targetPersonas.map((p) => (
                        <div key={p.id} className="text-xs text-gray-600 mb-2 bg-gray-50 p-2 rounded">
                          <p className="font-medium">{p.name}</p>
                          <p className="text-gray-500">{p.headline}</p>
                          <p className="mt-1">Trigger: {p.topTrigger}</p>
                          <p>Objection: &quot;{p.topObjection}&quot;</p>
                          <p className="text-emerald-600">Reframe: &quot;{p.topReframe}&quot;</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Production Rules */}
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">Production Rules</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                      <p>Hook: {brief.brandContext.visualRules.editingPace.hookWindow}</p>
                      <p>Bridge: {brief.brandContext.visualRules.editingPace.retentionBridge}</p>
                      <p>Body: {brief.brandContext.visualRules.editingPace.contentBody}</p>
                      <p>CTA: {brief.brandContext.visualRules.editingPace.cta}</p>
                      <p>Cuts: {brief.brandContext.visualRules.editingPace.cutFrequency}</p>
                      <p>Sound: {brief.brandContext.visualRules.soundDesign.voiceover}</p>
                    </div>
                  </div>

                  {/* Voice Rules */}
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">Voice Rules</p>
                    {brief.brandContext.voiceRules.map((r, i) => (
                      <p key={i} className="text-xs text-gray-500">{r}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
