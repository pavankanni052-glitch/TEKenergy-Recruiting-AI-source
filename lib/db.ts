import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "tekenergy.db");
let db: DatabaseSync | undefined;

export function now(): string { return new Date().toISOString(); }
export function newId(prefix: string): string { return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`; }

function database() {
  if (db) return db;
  fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

const migrationSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','RECRUITER','VIEWER')), active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, location TEXT, work_arrangement TEXT,
  compensation TEXT, start_date TEXT, submission_deadline TEXT, recruiter_id TEXT REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN ('DRAFT','PENDING_APPROVAL','ACTIVE','PAUSED','CLOSED')) DEFAULT 'DRAFT',
  criteria_approved_at TEXT, requirements_json TEXT NOT NULL DEFAULT '[]', rubric_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT, location TEXT, roles_json TEXT NOT NULL DEFAULT '[]',
  total_experience REAL, relevant_experience REAL, skills_json TEXT NOT NULL DEFAULT '[]', certifications_json TEXT NOT NULL DEFAULT '[]',
  education TEXT, project_experience TEXT, source_channel TEXT NOT NULL, source_url TEXT, availability TEXT, compensation TEXT,
  contact_preference TEXT NOT NULL DEFAULT 'email', opt_out INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'IMPORTED', archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS candidates_email_idx ON candidates(email);
CREATE INDEX IF NOT EXISTS candidates_status_idx ON candidates(status, archived);
CREATE TABLE IF NOT EXISTS candidate_documents (
  id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  filename TEXT NOT NULL, mime_type TEXT NOT NULL, storage_path TEXT NOT NULL, raw_text TEXT, extracted_json TEXT NOT NULL DEFAULT '{}',
  parser_status TEXT NOT NULL DEFAULT 'PENDING', source TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS screening_results (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, rubric_version INTEGER NOT NULL,
  score REAL NOT NULL, mandatory_met INTEGER NOT NULL, status TEXT NOT NULL, reviewer_id TEXT REFERENCES users(id),
  reviewed_at TEXT, created_at TEXT NOT NULL, UNIQUE(job_id, candidate_id, rubric_version)
);
CREATE INDEX IF NOT EXISTS screening_results_job_idx ON screening_results(job_id, score DESC);
CREATE TABLE IF NOT EXISTS screening_evidence (
  id TEXT PRIMARY KEY, screening_id TEXT NOT NULL REFERENCES screening_results(id) ON DELETE CASCADE,
  requirement_id TEXT NOT NULL, requirement_description TEXT NOT NULL, mandatory INTEGER NOT NULL, assessment TEXT NOT NULL,
  evidence TEXT, document_reference TEXT, explanation TEXT NOT NULL, missing_information TEXT, clarification_question TEXT, points REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sourcing_tasks (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, provider TEXT NOT NULL,
  query_text TEXT NOT NULL, status TEXT NOT NULL, manual_instructions TEXT, result_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS external_sources (
  id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  sourcing_task_id TEXT REFERENCES sourcing_tasks(id) ON DELETE SET NULL, channel TEXT NOT NULL, source_url TEXT, discovered_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY, filename TEXT NOT NULL, status TEXT NOT NULL, imported_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0, error_count INTEGER NOT NULL DEFAULT 0, notes TEXT, created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS duplicate_flags (
  id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  possible_duplicate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, confidence REAL NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL, UNIQUE(candidate_id, possible_duplicate_id)
);
CREATE TABLE IF NOT EXISTS outreach_messages (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  subject TEXT NOT NULL, body TEXT NOT NULL, message_type TEXT NOT NULL, approval_status TEXT NOT NULL DEFAULT 'DRAFT',
  approved_by TEXT REFERENCES users(id), approved_at TEXT, delivery_status TEXT NOT NULL DEFAULT 'NOT_SENT', idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL, sent_at TEXT
);
CREATE TABLE IF NOT EXISTS communication_events (
  id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  direction TEXT NOT NULL, channel TEXT NOT NULL, summary TEXT NOT NULL, message_id TEXT REFERENCES outreach_messages(id) ON DELETE SET NULL,
  recorded_by TEXT REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status TEXT NOT NULL, scheduled_at TEXT, format TEXT NOT NULL, availability TEXT, consent_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  question_template TEXT NOT NULL, created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS interview_feedback (
  id TEXT PRIMARY KEY, interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE, reviewer_id TEXT REFERENCES users(id),
  recommendation TEXT NOT NULL, technical_score REAL, functional_score REAL, notes TEXT NOT NULL, evidence TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shortlist_decisions (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, status TEXT NOT NULL, generated_at TEXT NOT NULL,
  approved_by TEXT REFERENCES users(id), approved_at TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS shortlist_items (
  id TEXT PRIMARY KEY, shortlist_id TEXT NOT NULL REFERENCES shortlist_decisions(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, rank INTEGER NOT NULL, rationale TEXT NOT NULL, strengths TEXT NOT NULL,
  weaknesses TEXT NOT NULL, next_questions TEXT NOT NULL, UNIQUE(shortlist_id, candidate_id)
);
CREATE TABLE IF NOT EXISTS integration_configs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL UNIQUE, provider TEXT NOT NULL, status TEXT NOT NULL, config_json TEXT NOT NULL DEFAULT '{}',
  last_tested_at TEXT, last_error TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS background_tasks (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload_json TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE, run_after TEXT NOT NULL, locked_at TEXT, last_error TEXT, created_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at DESC);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);
`;

function migrate(conn: DatabaseSync) {
  conn.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = conn.prepare("SELECT version FROM schema_migrations WHERE version = ?").get("001_initial") as { version?: string } | undefined;
  if (!applied) {
    conn.exec(migrationSql);
    conn.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run("001_initial", now());
  }
  const candidateVisaMigration = conn.prepare("SELECT version FROM schema_migrations WHERE version = ?").get("002_candidate_visa_status") as { version?: string } | undefined;
  if (!candidateVisaMigration) {
    conn.exec("ALTER TABLE candidates ADD COLUMN visa_status TEXT");
    conn.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run("002_candidate_visa_status", now());
  }
}

export function run(sql: string, ...params: unknown[]) { return database().prepare(sql).run(...params as any[]); }
export function one<T>(sql: string, ...params: unknown[]): T | undefined { return database().prepare(sql).get(...params as any[]) as T | undefined; }
export function all<T>(sql: string, ...params: unknown[]): T[] { return database().prepare(sql).all(...params as any[]) as T[]; }
export function transaction<T>(work: () => T): T {
  const conn = database();
  conn.exec("BEGIN IMMEDIATE");
  try { const result = work(); conn.exec("COMMIT"); return result; }
  catch (error) { try { conn.exec("ROLLBACK"); } catch { /* transaction was already closed */ } throw error; }
}
export function dbPath() { return DB_PATH; }

export function audit(actorId: string | null, action: string, entityType: string, entityId: string, details: unknown = {}) {
  run("INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    newId("audit"), actorId, action, entityType, entityId, JSON.stringify(details), now());
}

export function getSetting(key: string, fallback = "") { return one<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", key)?.value ?? fallback; }
export function putSetting(key: string, value: string) { run("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at", key, value, now()); }
