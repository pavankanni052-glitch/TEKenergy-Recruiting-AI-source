export type Role = "ADMIN" | "RECRUITER" | "VIEWER";
export type JobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "PAUSED" | "CLOSED";
export type CandidateStatus =
  | "DISCOVERED" | "IMPORTED" | "AWAITING_REVIEW" | "SCREENING_IN_PROGRESS"
  | "CLARIFICATION_REQUIRED" | "APPROVED_FOR_OUTREACH" | "CONTACTED" | "INTERESTED"
  | "NOT_INTERESTED" | "INTERVIEW_PENDING" | "INTERVIEW_COMPLETED" | "RECRUITER_REVIEW"
  | "SHORTLISTED" | "ON_HOLD" | "WITHDRAWN" | "CLOSED";
export type Assessment = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNKNOWN" | "NOT_SUPPORTED" | "REQUIRES_VERIFICATION";

export interface Requirement {
  id: string;
  description: string;
  category: "skill" | "experience" | "certification" | "location" | "work_authorization" | "clearance" | "other";
  mandatory: boolean;
  weight: number;
  clarification?: string;
}

export interface CandidateRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  visaStatus: string | null;
  roles: string[];
  totalExperience: number | null;
  relevantExperience: number | null;
  skills: string[];
  certifications: string[];
  education: string | null;
  projectExperience: string | null;
  sourceChannel: string;
  sourceUrl: string | null;
  availability: string | null;
  compensation: string | null;
  contactPreference: string;
  optOut: boolean;
  status: CandidateStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobRecord {
  id: string;
  title: string;
  description: string;
  location: string | null;
  workArrangement: string | null;
  compensation: string | null;
  startDate: string | null;
  submissionDeadline: string | null;
  recruiterId: string | null;
  status: JobStatus;
  criteriaApprovedAt: string | null;
  requirements: Requirement[];
  rubricVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenEvidence {
  requirementId: string;
  requirementDescription: string;
  mandatory: boolean;
  assessment: Assessment;
  evidence: string | null;
  documentReference: string | null;
  explanation: string;
  missingInformation: string | null;
  clarificationQuestion: string | null;
  points: number;
}

export interface ScreeningResult {
  id: string;
  jobId: string;
  candidateId: string;
  rubricVersion: number;
  score: number;
  mandatoryMet: boolean;
  status: "COMPLETE" | "NEEDS_REVIEW" | "FAILED";
  createdAt: string;
  reviewedAt: string | null;
  evidence: ScreenEvidence[];
}
