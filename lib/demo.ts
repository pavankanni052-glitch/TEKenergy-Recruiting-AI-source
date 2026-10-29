import { ensureDemoUser } from "./auth";
import { approveJobCriteria, createCandidate, createJob, listJobs, setJobStatus } from "./repository";
import { extractRequirementsHeuristically } from "./intelligence";

export function seedDemoData() {
  ensureDemoUser(); const existingUser = "user_demo_recruiter";
  if (listJobs().length) return;
  const description = `Senior Cloud DevOps Engineer\nLocation: Washington, DC (Hybrid)\nRequired: 5+ years of DevOps experience, AWS, Kubernetes, Terraform, CI/CD, and active Public Trust eligibility. Preferred: Python and Security+ certification. U.S. work authorization is required. Start date: January 2027.`;
  const requirements = extractRequirementsHeuristically(description); const jobId = createJob({ title: "Senior Cloud DevOps Engineer", description, location: "Washington, DC (Hybrid)", workArrangement: "Hybrid", startDate: "2027-01-15", requirements }, existingUser);
  approveJobCriteria(jobId, existingUser); setJobStatus(jobId, "ACTIVE", existingUser);
  const people = [
    { name: "Avery Johnson", email: "avery.johnson@example.test", location: "Washington, DC", roles: ["Senior DevOps Engineer"], skills: ["AWS", "Kubernetes", "Terraform", "CI/CD", "Python"], certifications: ["Security+"], totalExperience: 8, relevantExperience: 7, projectExperience: "Built federal cloud delivery platforms using AWS, Kubernetes, Terraform, and automated CI/CD." },
    { name: "Jordan Lee", email: "jordan.lee@example.test", location: "Arlington, VA", roles: ["Cloud Engineer"], skills: ["AWS", "Docker", "Terraform", "Python"], certifications: [], totalExperience: 6, relevantExperience: 5, projectExperience: "AWS infrastructure automation and federal project support." },
    { name: "Morgan Patel", email: "morgan.patel@example.test", location: "Remote", roles: ["Platform Engineer"], skills: ["Azure", "Kubernetes", "Terraform", "CI/CD"], certifications: ["PMP"], totalExperience: 9, relevantExperience: 8, projectExperience: "Platform reliability and container orchestration." },
    { name: "Riley Chen", email: "riley.chen@example.test", location: "Baltimore, MD", roles: ["DevOps Engineer"], skills: ["AWS", "Kubernetes", "Terraform", "CI/CD", "Python"], certifications: ["AWS Certified", "Security+"], totalExperience: 10, relevantExperience: 8, projectExperience: "Led cloud modernization and IaC delivery for regulated public-sector systems." },
    { name: "Casey Nguyen", email: "casey.nguyen@example.test", location: "Washington, DC", roles: ["Systems Engineer"], skills: ["AWS", "Linux", "Docker"], certifications: [], totalExperience: 4, relevantExperience: 3, projectExperience: "Operations support for cloud environments." },
    { name: "Taylor Brooks", email: "taylor.brooks@example.test", location: "Virginia", roles: ["Cloud Security Engineer"], skills: ["AWS", "Kubernetes", "Terraform", "Python", "CI/CD"], certifications: ["CISSP", "Security+"], totalExperience: 11, relevantExperience: 9, projectExperience: "Cloud security automation, Kubernetes hardening, and infrastructure-as-code reviews." },
    { name: "Quinn Davis", email: "quinn.davis@example.test", location: "Maryland", roles: ["Site Reliability Engineer"], skills: ["AWS", "Kubernetes", "CI/CD", "Python"], certifications: [], totalExperience: 7, relevantExperience: 6, projectExperience: "SRE automation across distributed AWS workloads." },
    { name: "Cameron Reed", email: "cameron.reed@example.test", location: "Washington, DC", roles: ["Infrastructure Engineer"], skills: ["Terraform", "Docker", "Linux"], certifications: [], totalExperience: 6, relevantExperience: 4, projectExperience: "Infrastructure provisioning and configuration management." },
    { name: "Alex Rivera", email: "alex.rivera@example.test", location: "DC Metro", roles: ["DevOps Lead"], skills: ["AWS", "Kubernetes", "Terraform", "CI/CD", "Python", "Splunk"], certifications: ["AWS Certified"], totalExperience: 12, relevantExperience: 10, projectExperience: "Managed infrastructure platforms and delivery pipelines for complex government programs." },
    { name: "Sam Wilson", email: "sam.wilson@example.test", location: "Arlington, VA", roles: ["Cloud Automation Engineer"], skills: ["AWS", "Terraform", "Python", "CI/CD"], certifications: ["Security+"], totalExperience: 5, relevantExperience: 5, projectExperience: "Automated AWS account provisioning and application build pipelines." }
  ];
  for (const person of people) createCandidate({ ...person, sourceChannel: "synthetic demo", status: "IMPORTED" }, existingUser);
}
