import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

export type LegalSlug =
  | "privacy-policy"
  | "terms-of-service"
  | "cookie-policy"
  | "acceptable-use-policy"
  | "data-processing-agreement"
  | "eula"
  | "gdpr-data-subject-request-process";

const TITLES: Record<LegalSlug, string> = {
  "privacy-policy": "Privacy Policy",
  "terms-of-service": "Terms of Service",
  "cookie-policy": "Cookie Policy",
  "acceptable-use-policy": "Acceptable Use Policy",
  "data-processing-agreement": "Data Processing Agreement",
  eula: "End User Licence Agreement",
  "gdpr-data-subject-request-process": "GDPR Data Subject Request Process",
};

export function legalTitle(slug: LegalSlug): string {
  return TITLES[slug];
}

export async function renderLegalPage(slug: LegalSlug): Promise<string> {
  const filePath = path.join(process.cwd(), "..", "docs", "legal", `${slug}.md`);
  const markdown = await readFile(filePath, "utf8");
  return marked.parse(markdown, { async: false }) as string;
}
