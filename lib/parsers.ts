import * as XLSX from "xlsx";
import mammoth from "mammoth";
import type { CandidateRecord } from "./types";
import { sanitizeUntrustedDocument } from "./intelligence";

export type ImportCandidate = Partial<CandidateRecord> & { name: string; email?: string | null; sourceChannel?: string };
const splitList = (value: unknown) => String(value ?? "").split(/[;,|]/).map(x => x.trim()).filter(Boolean);
const numberOrNull = (value: unknown) => { const num = Number(value); return Number.isFinite(num) && num >= 0 ? num : null; };
const normal = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");
const valueFor = (row: Record<string, unknown>, ...aliases: string[]) => { const match = Object.keys(row).find(key => aliases.includes(normal(key))); return match ? row[match] : undefined; };

export function rowsToCandidates(rows: Record<string, unknown>[]): { candidates: ImportCandidate[]; errors: string[] } {
  const candidates: ImportCandidate[] = []; const errors: string[] = [];
  rows.forEach((row, index) => {
    const name = String(valueFor(row, "name", "fullname", "candidatename") ?? "").trim();
    if (!name) { errors.push(`Row ${index + 2}: name is required.`); return; }
    const emailValue = String(valueFor(row, "email", "emailaddress") ?? "").trim();
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) { errors.push(`Row ${index + 2}: email is not valid.`); return; }
    candidates.push({ name, email: emailValue || null, phone: String(valueFor(row, "phone", "telephone", "mobile") ?? "").trim() || null, location: String(valueFor(row, "location", "city", "locationcity") ?? "").trim() || null, visaStatus: String(valueFor(row, "visastatus", "visa", "workauthorization", "workauthorizationstatus") ?? "").trim() || null, roles: splitList(valueFor(row, "roles", "currentrole", "title", "currenttitle")), skills: splitList(valueFor(row, "skills", "technologies", "technicalskills")), certifications: splitList(valueFor(row, "certifications", "certs")), totalExperience: numberOrNull(valueFor(row, "totalexperience", "yearsexperience", "experienceyears")), relevantExperience: numberOrNull(valueFor(row, "relevantexperience", "relevantyears")), education: String(valueFor(row, "education") ?? "").trim() || null, projectExperience: String(valueFor(row, "projectexperience", "projects", "summary") ?? "").trim() || null, sourceChannel: String(valueFor(row, "source", "sourcechannel") ?? "spreadsheet").trim() || "spreadsheet", sourceUrl: String(valueFor(row, "sourceurl", "url") ?? "").trim() || null, availability: String(valueFor(row, "availability") ?? "").trim() || null, compensation: String(valueFor(row, "compensation", "salary", "rate") ?? "").trim() || null, contactPreference: String(valueFor(row, "contactpreference") ?? "email"), optOut: /^(yes|true|1)$/i.test(String(valueFor(row, "optout", "donotcontact") ?? "")), status: "IMPORTED" });
  });
  return { candidates, errors };
}
export function parseSpreadsheet(bytes: Buffer, filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    const [headerLine, ...lines] = bytes.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean); const headers = parseCsvLine(headerLine);
    return rowsToCandidates(lines.map(line => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ""]))));
  }
  if (extension === "xlsx" || extension === "xls") { const workbook = XLSX.read(bytes, { type: "buffer" }); const first = workbook.Sheets[workbook.SheetNames[0]]; if (!first) throw new Error("The spreadsheet has no readable worksheets."); return rowsToCandidates(XLSX.utils.sheet_to_json<Record<string, unknown>>(first, { defval: "" })); }
  throw new Error("Supported spreadsheet formats are CSV, XLSX, and XLS.");
}
function parseCsvLine(line: string) { const values: string[] = []; let value = "", quoted = false; for (let i = 0; i < line.length; i += 1) { const char = line[i]; if (char === '"' && line[i + 1] === '"') { value += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { values.push(value.trim()); value = ""; } else value += char; } values.push(value.trim()); return values; }

export async function parseResume(bytes: Buffer, filename: string, mimeType: string) {
  const ext = filename.split(".").pop()?.toLowerCase(); let text = "";
  if (ext === "docx" || mimeType.includes("wordprocessingml")) text = (await mammoth.extractRawText({ buffer: bytes })).value;
  else if (ext === "pdf" || mimeType === "application/pdf") { const parserModule = await import("pdf-parse") as unknown as { PDFParse: new (input: { data: Buffer }) => { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> } }; const parser = new parserModule.PDFParse({ data: bytes }); try { text = (await parser.getText()).text; } finally { await parser.destroy(); } }
  else if (ext === "txt" || mimeType.startsWith("text/")) text = bytes.toString("utf8");
  else throw new Error("Supported resume formats are PDF, DOCX, and TXT.");
  return { text: sanitizeUntrustedDocument(text), facts: extractResumeFacts(text) };
}
export function extractResumeFacts(raw: string) {
  const text = sanitizeUntrustedDocument(raw); const termList = ["JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python", "Java", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "SQL", "PostgreSQL", "Oracle", "Snowflake", "Tableau", "Power BI", "Splunk", "ServiceNow", "Salesforce", "DevOps", "Agile", "Public Trust", "Secret Clearance", "Security+"]; const skills = termList.filter(term => new RegExp(`\\b${term.replace(/[.+]/g, "\\$&")}\\b`, "i").test(text));
  const years = [...text.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)/gi)].map(m => Number(m[1])); const roles = [...text.matchAll(/(?:title|role|position)\s*[:\-]\s*([^\n]{2,80})/gi)].map(m => m[1].trim()).slice(0, 6);
  const certs = ["PMP", "CISSP", "Security+", "AWS Certified", "Azure Certified", "CCNA", "ITIL", "CSM"].filter(term => text.toLowerCase().includes(term.toLowerCase()));
  return { skills, roles, totalExperience: years.length ? Math.max(...years) : null, certifications: certs, projectExperience: text.slice(0, 1500) };
}
