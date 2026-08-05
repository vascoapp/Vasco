"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Validator UI — runs entirely in the browser
// ═══════════════════════════════════════════════════════════════════════════
// Nothing is uploaded. An e-invoice contains the customer's name, address and
// VAT number, and there is no reason for us to receive any of that to tell
// someone whether their totals add up. Parsing client-side removes the question
// entirely, which is also the honest answer when an accountant asks where the
// file goes — and the reason they will be willing to paste a real invoice.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { validateXmlString, type ValidationResult } from "@/lib/einvoice-validator";

export function ValidatorClient() {
  const [xml, setXml] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);

  const run = (input: string) => {
    if (!input.trim()) {
      setResult(null);
      return;
    }
    setResult(
      validateXmlString(input, (x) => new DOMParser().parseFromString(x, "application/xml")),
    );
  };

  const onFile = async (file: File) => {
    const content = await file.text();
    setXml(content);
    run(content);
  };

  const errors = result?.findings.filter((f) => f.severity === "error") ?? [];
  const warnings = result?.findings.filter((f) => f.severity === "warning") ?? [];

  return (
    <div>
      <div
        style={{
          border: "1px solid #2A3038", borderRadius: 10, padding: "12px 14px",
          fontSize: 13, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 20,
        }}
      >
        <strong style={{ color: "#FFFFFF" }}>Your invoice stays in your browser.</strong>{" "}
        The file is parsed on your own device and never uploaded — we do not
        receive your customer&rsquo;s name, address or VAT number.
      </div>

      <textarea
        value={xml}
        onChange={(e) => { setXml(e.target.value); run(e.target.value); }}
        placeholder="Paste your e-invoice XML here (XRechnung, Peppol BIS, or any UBL invoice)…"
        spellCheck={false}
        style={{
          width: "100%", minHeight: 180, background: "#0B0E11", color: "#E5E7EB",
          border: "1px solid #2A3038", borderRadius: 10, padding: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5,
          lineHeight: 1.5, resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "12px 0 28px" }}>
        <label
          style={{
            display: "inline-block", padding: "9px 14px", borderRadius: 999,
            border: "1px solid #2A3038", color: "#E5E7EB", fontSize: 14, cursor: "pointer",
          }}
        >
          Choose a file
          <input
            type="file"
            accept=".xml,application/xml,text/xml"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
            style={{ display: "none" }}
          />
        </label>
        {xml && (
          <button
            onClick={() => { setXml(""); setResult(null); }}
            style={{
              padding: "9px 14px", borderRadius: 999, border: "1px solid #2A3038",
              background: "transparent", color: "#9CA3AF", fontSize: 14, cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {result && (
        <div>
          {/* Deliberately never the word "compliant". A partial check that says
              "valid" makes someone stop looking, which is worse than saying
              nothing. */}
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
            {errors.length === 0
              ? "No problems found in the checks below"
              : `${errors.length} problem${errors.length === 1 ? "" : "s"} found`}
          </h2>
          <p style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            Detected: {result.format}
            {result.profile ? ` · ${result.profile}` : ""}
          </p>

          {[...errors, ...warnings].map((f, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${f.severity === "error" ? "#EF444455" : "#F9731655"}`,
                background: f.severity === "error" ? "#EF444410" : "#F9731610",
                borderRadius: 10, padding: "12px 14px", marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{
                  fontFamily: "ui-monospace, monospace", fontSize: 12,
                  color: f.severity === "error" ? "#EF4444" : "#F97316", fontWeight: 700,
                }}>
                  {f.rule}
                </span>
                <span style={{ color: "#FFFFFF", fontSize: 14.5, flex: 1, minWidth: 220 }}>
                  {f.message}
                </span>
              </div>
              {f.hint && (
                <p style={{ color: "#9CA3AF", fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>
                  {f.hint}
                </p>
              )}
            </div>
          ))}

          {result.passed.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", color: "#9CA3AF", fontSize: 14 }}>
                {result.passed.length} checks passed
              </summary>
              <ul style={{ color: "#9CA3AF", fontSize: 13.5, lineHeight: 1.9, marginTop: 10, paddingLeft: 18 }}>
                {result.passed.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
