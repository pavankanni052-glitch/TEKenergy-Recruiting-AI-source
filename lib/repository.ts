import { all, audit, newId, now, one, run, transaction } from "./db";
import type { CandidateRecord, CandidateStatus, JobRecord, JobStatus, Requirement, ScreeningResult } from "./types";

type Row = Record<string, unknown>;
const json = <T>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback; } catch { return fallback; } };
const bool = (v: unknown) => Number(v) === 1;

function candidate(row: Row): CandidateRecord {
  return {
    id: String(row.id), name: String(row.name), email: row.email ? String(row.email) : null, phone: row.phone ? String(row.phone) : null,
    location: row.location ? String(row.location) : null, visaStatus: row.visa_status ? String(row.visa_status) : null,
    roles: json(row.roles_json, []), totalExperience: row.total_experience === null ? null : Number(row.total_experience),
    relevantExperience: row.relevant_experience === null ? null : Number(row.relevant_experience), skills: json(row.skills_json, []), certifications: json(row.certifications_json, []),
    education: row.education ? String(row.education) : null, projectExperience: row.project_experience ? String(row.project_experience) : null,
    sourceChannel: String(row.source_channel), sourceUrl: row.source_url ? String(row.source_url) : null, availability: row.availability ? String(row.availability) : null,
    compensation: row.compensation ? String(row.compensation) : null, contactPreference: String(row.contact_preference), optOut: bool(row.opt_out),
    status: String(row.status) as CandidateStatus, archived: bool(row.archived), createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  };
}

function job(row: Row): JobRecord {
  return {
    id: String(row.id), title: String(row.title), description: String(row.description), location: row.location ? String(row.location) : null,
    workArrangement: row.work_arrangement ? String(row.work_arrangement) : null, compensation: row.compensation ? String(row.compensation) : null,
    startDate: row.start_date ? String(row.start_date) : null, submissionDeadline: row.submission_deadline ? String(row.submission_deadline) : null,
    recruiterId: row.recruiter_id ? String(row.recruiter_id) : null, status: String(row.status) as JobStatus,
    criteriaApprovedAt: row.criteria_approved_at ? String(row.criteria_approved_at) : null, requirements: json<Requirement[]>(row.requirements_json, []),
    rubricVersion: Number(row.rubric_version), createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  };
}

export function listJobs() { return all<Row>("SELECT * FROM jobs ORDER BY updated_at DESC").map(job); }
export function getJob(id: string) { const row = one<Row>("SELECT * FROM jobs WHERE id = ?", id); return row ? job(row) : undefined; }
export function listCandidates(query = "", includeArchived = false) {
  const suffix = includeArchived ? "" : "AND archived = 0";
  const like = `%${query.trim()}%`;
  return all<Row>(`SELECT * FROM candidates WHERE (name LIKE ? OR email LIKE ? OR skills_json LIKE ? OR location LIKE ?) ${suffix} ORDER BY updated_at DESC`, like, like, like, like).map(candidate);
}
export function getCandidate(id: string) { const row = one<Row>("SELECT * FROM candidates WHERE id = ?", id); return row ? candidate(row) : undefined; }
export function candidateDocuments(candidateId: string) { return all<Row>("SELECT * FROM candidate_documents WHERE candidate_id = ? ORDER BY created_at DESC", candidateId); }

export function createJob(input: { title?: string; description: string; location?: string; workArrangement?: string; compensation?: string; startDate?: string; submissionDeadline?: string; requirements: Requirement[] }, actorId: string) {
  const id = newId("job"), timestamp = now();
  run(`INSERT INTO jobs (id,title,description,location,work_arrangement,compensation,start_date,submission_deadline,recruiter_id,status,requirements_json,rubric_version,created_at,updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, 1, ?, ?)`,
    id, input.title?.trim() || "Untitled requirement", input.description, input.location || null, input.workArrangement || null, input.compensation || null,
    input.startDate || null, input.submissionDeadline || null, actorId, JSON.stringify(input.requirements), timestamp, timestamp);
  audit(actorId, "job.created", "job", id, { requirementCount: input.requirements.length });
  return id;
}

export function updateJobRequirements(id: string, requirements: Requirement[], actorId: string) {
  const existing = getJob(id); if (!existing) throw new Error("Job not found");
  run("UPDATE jobs SET requirements_json = ?, rubric_version = ?, criteria_approved_at = NULL, status = 'PENDING_APPROVAL', updated_at = ? WHERE id = ?", JSON.stringify(requirements), existing.rubricVersion + 1, now(), id);
  audit(actorId, "job.rubric_updated", "job", id, { version: existing.rubricVersion + 1 });
}
export function setJobStatus(id: string, status: JobStatus, actorId: string) {
  const existing = getJob(id); if (!existing) throw new Error("Job not found");
  if (status === "ACTIVE" && !existing.criteriaApprovedAt) throw new Error("Approve job criteria before activating screening.");
  const approved = existing.criteriaApprovedAt;
  run("UPDATE jobs SET status = ?, criteria_approved_at = ?, updated_at = ? WHERE id = ?", status, approved, now(), id);
  audit(actorId, `job.${status.toLowerCase()}`, "job", id);
}
export function approveJobCriteria(id: string, actorId: string) {
  const existing = getJob(id); if (!existing) throw new Error("Job not found");
  if (!existing.requirements.length) throw new Error("Add at least one documented screening requirement before approval.");
  run("UPDATE jobs SET criteria_approved_at = ?, status = 'PENDING_APPROVAL', updated_at = ? WHERE id = ?", now(), now(), id);
  audit(actorId, "job.criteria_approved", "job", id, { rubricVersion: existing.rubricVersion });
}

export function findDuplicate(input: { email?: string | null; name: string; phone?: string | null }) {
  if (input.email) return one<Row>("SELECT * FROM candidates WHERE lower(email) = lower(?)", input.email);
  if (input.phone) return one<Row>("SELECT * FROM candidates WHERE phone = ?", input.phone);
  return one<Row>("SELECT * FROM candidates WHERE lower(name) = lower(?)", input.name);
}

export function createCandidate(input: Partial<CandidateRecord> & { name: string; sourceChannel?: string }, actorId: string, sourceTaskId?: string) {
  const existing = findDuplicate(input);
  if (existing) return { id: String(existing.id), duplicate: true };
  const id = newId("cand"), timestamp = now();
  transaction(() => {
    run(`INSERT INTO candidates (id,name,email,phone,location,visa_status,roles_json,total_experience,relevant_experience,skills_json,certifications_json,education,project_experience,source_channel,source_url,availability,compensation,contact_preference,opt_out,status,archived,created_at,updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      id, input.name.trim(), input.email || null, input.phone || null, input.location || null, input.visaStatus || null, JSON.stringify(input.roles ?? []), input.totalExperience ?? null,
      input.relevantExperience ?? null, JSON.stringify(input.skills ?? []), JSON.stringify(input.certifications ?? []), input.education || null,
      input.projectExperience || null, input.sourceChannel || "manual", input.sourceUrl || null, input.availability || null, input.compensation || null,
      input.contactPreference || "email", input.optOut ? 1 : 0, input.status || "IMPORTED", timestamp, timestamp);
    if (sourceTaskId || input.sourceUrl) run("INSERT INTO external_sources (id,candidate_id,sourcing_task_id,channel,source_url,discovered_at) VALUES (?, ?, ?, ?, ?, ?)", newId("source"), id, sourceTaskId || null, input.sourceChannel || "manual", input.sourceUrl || null, timestamp);
    audit(actorId, "candidate.created", "candidate", id, { source: input.sourceChannel || "manual" });
  });
  return { id, duplicate: false };
}

export function updateCandidateStatus(id: string, status: CandidateStatus, reason: string, actorId: string) {
  const cand = getCandidate(id); if (!cand) throw new Error("Candidate not found");
  if (cand.optOut && status === "CONTACTED") throw new Error("Candidate has opted out; outreach is blocked.");
  run("UPDATE candidates SET status = ?, updated_at = ? WHERE id = ?", status, now(), id);
  audit(actorId, "candidate.status_changed", "candidate", id, { from: cand.status, to: status, reason });
}
export function updateCandidateOptOut(id: string, optOut: boolean, actorId: string) {
  run("UPDATE candidates SET opt_out = ?, contact_preference = ?, updated_at = ? WHERE id = ?", optOut ? 1 : 0, optOut ? "do not contact" : "email", now(), id);
  audit(actorId, optOut ? "candidate.opted_out" : "candidate.opt_in", "candidate", id);
}
export function archiveCandidate(id: string, actorId: string) { run("UPDATE candidates SET archived = 1, updated_at = ? WHERE id = ?", now(), id); audit(actorId, "candidate.archived", "candidate", id); }
export function deleteCandidate(id: string, actorId: string) { const cand = getCandidate(id); if (!cand) return; transaction(() => { audit(actorId, "candidate.deleted", "candidate", id, { name: cand.name }); run("DELETE FROM candidates WHERE id = ?", id); }); }

export function addDocument(candidateId: string, input: { filename: string; mimeType: string; storagePath: string; rawText?: string; extracted?: unknown; parserStatus: string; source: string }, actorId: string) {
  const id = newId("doc");
  run("INSERT INTO candidate_documents (id,candidate_id,filename,mime_type,storage_path,raw_text,extracted_json,parser_status,source,created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id, candidateId, input.filename, input.mimeType, input.storagePath, input.rawText || null, JSON.stringify(input.extracted || {}), input.parserStatus, input.source, now());
  audit(actorId, "document.imported", "candidate_document", id, { candidateId, parserStatus: input.parserStatus }); return id;
}
export function updateCandidateExtractedFacts(id: string, facts: { skills?: string[]; roles?: string[]; totalExperience?: number | null; certifications?: string[]; projectExperience?: string | null }, actorId: string) {
  const cand = getCandidate(id); if (!cand) throw new Error("Candidate not found");
  run("UPDATE candidates SET skills_json=?, roles_json=?, total_experience=?, certifications_json=?, project_experience=?, updated_at=? WHERE id=?",
    JSON.stringify(facts.skills?.length ? facts.skills : cand.skills), JSON.stringify(facts.roles?.length ? facts.roles : cand.roles), facts.totalExperience ?? cand.totalExperience,
    JSON.stringify(facts.certifications?.length ? facts.certifications : cand.certifications), facts.projectExperience ?? cand.projectExperience, now(), id);
  audit(actorId, "candidate.facts_extracted", "candidate", id);
}

export function getLatestScreening(jobId: string, candidateId: string): ScreeningResult | undefined {
  const row = one<Row>("SELECT * FROM screening_results WHERE job_id = ? AND candidate_id = ? ORDER BY rubric_version DESC, created_at DESC LIMIT 1", jobId, candidateId);
  if (!row) return undefined;
  const evidence = all<Row>("SELECT * FROM screening_evidence WHERE screening_id = ?", row.id).map(e => ({ requirementId: String(e.requirement_id), requirementDescription: String(e.requirement_description), mandatory: bool(e.mandatory), assessment: String(e.assessment) as any, evidence: e.evidence ? String(e.evidence) : null, documentReference: e.document_reference ? String(e.document_reference) : null, explanation: String(e.explanation), missingInformation: e.missing_information ? String(e.missing_information) : null, clarificationQuestion: e.clarification_question ? String(e.clarification_question) : null, points: Number(e.points) }));
  return { id: String(row.id), jobId: String(row.job_id), candidateId: String(row.candidate_id), rubricVersion: Number(row.rubric_version), score: Number(row.score), mandatoryMet: bool(row.mandatory_met), status: String(row.status) as any, createdAt: String(row.created_at), reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null, evidence };
}
export function storeScreening(result: Omit<ScreeningResult, "id" | "createdAt" | "reviewedAt">, actorId: string) {
  const id = newId("screen"), timestamp = now();
  transaction(() => {
    run("DELETE FROM screening_results WHERE job_id = ? AND candidate_id = ? AND rubric_version = ?", result.jobId, result.candidateId, result.rubricVersion);
    run("INSERT INTO screening_results (id,job_id,candidate_id,rubric_version,score,mandatory_met,status,created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, result.jobId, result.candidateId, result.rubricVersion, result.score, result.mandatoryMet ? 1 : 0, result.status, timestamp);
    for (const item of result.evidence) run("INSERT INTO screening_evidence (id,screening_id,requirement_id,requirement_description,mandatory,assessment,evidence,document_reference,explanation,missing_information,clarification_question,points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", newId("ev"), id, item.requirementId, item.requirementDescription, item.mandatory ? 1 : 0, item.assessment, item.evidence, item.documentReference, item.explanation, item.missingInformation, item.clarificationQuestion, item.points);
    run("UPDATE candidates SET status = 'RECRUITER_REVIEW', updated_at = ? WHERE id = ?", timestamp, result.candidateId);
    audit(actorId, "candidate.screened", "screening", id, { jobId: result.jobId, candidateId: result.candidateId, score: result.score, rubricVersion: result.rubricVersion });
  });
  return id;
}

export function createSourcingTask(jobId: string, provider: string, queryText: string, actorId: string) {
  const id = newId("source_task");
  run("INSERT INTO sourcing_tasks (id,job_id,provider,query_text,status,manual_instructions,created_by,created_at) VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?)", id, jobId, provider, queryText, provider === "manual" ? "Run this Boolean string only in approved channels. Import candidates only where TEKenergy has permission." : null, actorId, now());
  audit(actorId, "sourcing.task_created", "sourcing_task", id, { jobId, provider }); return id;
}
export function listSourcingTasks() { return all<Row>("SELECT st.*, j.title AS job_title FROM sourcing_tasks st JOIN jobs j ON j.id=st.job_id ORDER BY st.created_at DESC"); }

export function createOutreach(jobId: string, candidateId: string, subject: string, body: string, type: string, actorId: string) {
  const id = newId("outreach");
  run("INSERT INTO outreach_messages (id,job_id,candidate_id,subject,body,message_type,approval_status,delivery_status,idempotency_key,created_at) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', 'NOT_SENT', ?, ?)", id, jobId, candidateId, subject, body, type, `outreach:${jobId}:${candidateId}:${type}`, now());
  audit(actorId, "outreach.drafted", "outreach", id, { jobId, candidateId }); return id;
}
export function listOutreach() { return all<Row>("SELECT o.*, c.name AS candidate_name, c.email AS candidate_email, c.opt_out, j.title AS job_title FROM outreach_messages o JOIN candidates c ON c.id=o.candidate_id JOIN jobs j ON j.id=o.job_id ORDER BY o.created_at DESC"); }
export function approveOutreach(id: string, actorId: string) {
  const item = one<Row>("SELECT o.*, c.opt_out, c.email FROM outreach_messages o JOIN candidates c ON c.id=o.candidate_id WHERE o.id=?", id); if (!item) throw new Error("Message not found");
  if (bool(item.opt_out)) throw new Error("Approval blocked: candidate has opted out.");
  if (!item.email) throw new Error("Approval blocked: candidate has no permitted email address.");
  run("UPDATE outreach_messages SET approval_status='APPROVED', approved_by=?, approved_at=? WHERE id=?", actorId, now(), id); audit(actorId, "outreach.approved", "outreach", id);
}
export function markOutreachManualSent(id: string, actorId: string) {
  const item = one<Row>("SELECT * FROM outreach_messages WHERE id=?", id); if (!item) throw new Error("Message not found"); if (String(item.approval_status) !== "APPROVED") throw new Error("Recruiter approval is required before recording a send."); if (String(item.delivery_status) !== "NOT_SENT") throw new Error("This message was already sent or recorded.");
  transaction(() => { run("UPDATE outreach_messages SET delivery_status='MANUAL_SENT', sent_at=? WHERE id=?", now(), id); run("UPDATE candidates SET status='CONTACTED', updated_at=? WHERE id=?", now(), item.candidate_id); run("INSERT INTO communication_events (id,candidate_id,job_id,direction,channel,summary,message_id,recorded_by,created_at) VALUES (?, ?, ?, 'OUTBOUND', 'manual', ?, ?, ?, ?)", newId("comm"), item.candidate_id, item.job_id, `Manual outreach recorded: ${item.subject}`, id, actorId, now()); audit(actorId, "outreach.manual_sent", "outreach", id); });
}

export function recordResponse(candidateId: string, jobId: string, summary: string, newStatus: CandidateStatus, actorId: string) {
  transaction(() => { updateCandidateStatus(candidateId, newStatus, "Recorded candidate response", actorId); run("INSERT INTO communication_events (id,candidate_id,job_id,direction,channel,summary,recorded_by,created_at) VALUES (?, ?, ?, 'INBOUND', 'manual', ?, ?, ?)", newId("comm"), candidateId, jobId, summary, actorId, now()); audit(actorId, "response.recorded", "candidate", candidateId, { jobId, newStatus }); });
}

export function createInterview(jobId: string, candidateId: string, availability: string, questions: string, actorId: string) {
  const id = newId("interview"), timestamp = now();
  transaction(() => { run("INSERT INTO interviews (id,job_id,candidate_id,status,format,availability,question_template,created_by,created_at,updated_at) VALUES (?, ?, ?, 'PENDING_SCHEDULING', 'human-led', ?, ?, ?, ?, ?)", id, jobId, candidateId, availability, questions, actorId, timestamp, timestamp); updateCandidateStatus(candidateId, "INTERVIEW_PENDING", "Interview coordination created", actorId); audit(actorId, "interview.created", "interview", id, { jobId, candidateId }); }); return id;
}
export function listInterviews() { return all<Row>("SELECT i.*,c.name AS candidate_name,j.title AS job_title FROM interviews i JOIN candidates c ON c.id=i.candidate_id JOIN jobs j ON j.id=i.job_id ORDER BY i.updated_at DESC"); }
export function addInterviewFeedback(interviewId: string, recommendation: string, technicalScore: number | null, functionalScore: number | null, notes: string, evidence: string, actorId: string) {
  const intv = one<Row>("SELECT * FROM interviews WHERE id=?", interviewId); if (!intv) throw new Error("Interview not found");
  transaction(() => { run("INSERT INTO interview_feedback (id,interview_id,reviewer_id,recommendation,technical_score,functional_score,notes,evidence,created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", newId("feedback"), interviewId, actorId, recommendation, technicalScore, functionalScore, notes, evidence, now()); run("UPDATE interviews SET status='COMPLETED', updated_at=? WHERE id=?", now(), interviewId); updateCandidateStatus(String(intv.candidate_id), "INTERVIEW_COMPLETED", "Structured interview feedback received", actorId); audit(actorId, "interview.feedback_added", "interview", interviewId); });
}

export function createShortlist(jobId: string, items: Array<{ candidateId: string; score: number; strengths: string; weaknesses: string; rationale: string; questions: string }>, actorId: string) {
  const id = newId("shortlist");
  transaction(() => { run("INSERT INTO shortlist_decisions (id,job_id,status,generated_at) VALUES (?, ?, 'PENDING_RECRUITER_APPROVAL', ?)", id, jobId, now()); items.slice(0, 2).forEach((item, index) => { run("INSERT INTO shortlist_items (id,shortlist_id,candidate_id,rank,rationale,strengths,weaknesses,next_questions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", newId("shortitem"), id, item.candidateId, index + 1, item.rationale, item.strengths, item.weaknesses, item.questions); updateCandidateStatus(item.candidateId, "SHORTLISTED", "Included in evidence-based shortlist", actorId); }); audit(actorId, "shortlist.generated", "shortlist", id, { jobId, count: items.length }); }); return id;
}
export function approveShortlist(id: string, notes: string, actorId: string) { run("UPDATE shortlist_decisions SET status='APPROVED', approved_by=?, approved_at=?, notes=? WHERE id=?", actorId, now(), notes, id); audit(actorId, "shortlist.approved", "shortlist", id); }
export function listShortlists() { return all<Row>("SELECT s.*,j.title AS job_title FROM shortlist_decisions s JOIN jobs j ON j.id=s.job_id ORDER BY s.generated_at DESC"); }
export function getShortlist(id: string): any { const data = one<Row>("SELECT s.*,j.title AS job_title FROM shortlist_decisions s JOIN jobs j ON j.id=s.job_id WHERE s.id=?", id); if (!data) return undefined; return { ...data, items: all<Row>("SELECT si.*,c.name,c.email,c.location,c.skills_json,c.availability,c.compensation FROM shortlist_items si JOIN candidates c ON c.id=si.candidate_id WHERE si.shortlist_id=? ORDER BY si.rank", id) }; }

export function dashboard() {
  const count = (sql: string, ...params: unknown[]) => Number(one<{ count: number }>(sql, ...params)?.count ?? 0);
  return { activeJobs: count("SELECT count(*) AS count FROM jobs WHERE status='ACTIVE'"), candidates: count("SELECT count(*) AS count FROM candidates WHERE archived=0"), screeningQueue: count("SELECT count(*) AS count FROM candidates WHERE status IN ('IMPORTED','AWAITING_REVIEW','SCREENING_IN_PROGRESS','RECRUITER_REVIEW')"), outreachApprovals: count("SELECT count(*) AS count FROM outreach_messages WHERE approval_status='DRAFT'"), interviews: count("SELECT count(*) AS count FROM interviews WHERE status != 'COMPLETED'"), shortlists: count("SELECT count(*) AS count FROM shortlist_decisions WHERE status='PENDING_RECRUITER_APPROVAL'"), recent: all<Row>("SELECT a.*,u.name AS actor_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 12"), errors: count("SELECT count(*) AS count FROM background_tasks WHERE status='FAILED'") };
}
export function auditHistory(limit = 100) { return all<Row>("SELECT a.*,u.name AS actor_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT ?", limit); }
export function listUsers() { return all<Row>("SELECT id,name,email,role,active,created_at FROM users WHERE active=1 ORDER BY name"); }
export function integrationState() { return all<Row>("SELECT * FROM integration_configs ORDER BY kind"); }
export function ensureIntegrationDefaults() { for (const [kind, provider] of [["openai", "OpenAI Responses API"], ["email", "Manual copy/send"], ["calendar", "Manual coordination"], ["sourcing", "Recruiter-assisted sourcing"], ["ai_interview", "Disabled"]]) run("INSERT OR IGNORE INTO integration_configs (id,kind,provider,status,config_json,updated_at) VALUES (?, ?, ?, 'NOT_CONFIGURED', '{}', ?)", newId("integration"), kind, provider, now()); }
export function setExternalActions(enabled: boolean, actorId: string) { run("INSERT INTO app_settings (key,value,updated_at) VALUES ('external_actions_enabled',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", enabled ? "true" : "false", now()); audit(actorId, enabled ? "agent.external_actions_enabled" : "agent.kill_switch_enabled", "settings", "external_actions"); }
