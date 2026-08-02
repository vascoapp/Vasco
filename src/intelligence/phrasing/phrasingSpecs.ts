// =============================================================================
// PHRASING SPECS — which generator strings an LLM may rewrite, and how far
// =============================================================================
// A spec is a contract, not a suggestion: it names the gt() key being
// overridden, the placeholders the wording may use, which ones it MUST keep,
// and the character budget. Everything outside it is rejected by
// phrasingValidation.
//
// Adding a key to phrasingSpecs.json is the ONLY way to bring a generator
// string under LLM phrasing. That keeps the blast radius reviewable: `git diff`
// on one JSON file answers "what can the model touch?".
//
// The data lives in JSON rather than in this file so that scripts/generate-
// phrasing.mjs reads the SAME source. The repo has no TypeScript runner for
// scripts (every script is .mjs), so a TS-only registry would have forced the
// ops script to keep its own copy — and a duplicated contract that drifts is
// precisely the failure this codebase already paid for with four rival Country
// types and 58 casts.
// =============================================================================

import specData from './phrasingSpecs.json';
import type { PhrasingSpec } from './phrasingValidation';

// Tone guidance lives in phrasingSpecs.json and is read from there by
// scripts/generate-phrasing.mjs. It is deliberately NOT re-exported here: the
// app never needs it (generation is an ops step), and a sweep found the export
// unused. One consumer, one source.

export const PHRASING_SPECS: PhrasingSpec[] = specData.specs;

/** Spec lookup by gt() key. */
export const PHRASING_SPEC_BY_KEY: Record<string, PhrasingSpec> = Object.fromEntries(
  PHRASING_SPECS.map((s) => [s.key, s]),
);
