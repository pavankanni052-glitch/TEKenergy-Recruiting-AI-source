import Link from "next/link";
import { candidateStatusAction, createInterviewAction, draftOutreachAction, importResumeAction, optOutAction, responseAction } from "../../../actions";
import { candidateDocuments, getCandidate, getLatestScreening, listJobs } from "@/lib/repository";
import { Empty, PageHeader, Status } from "../../../components";
import { notFound } from "next/navigation";

export default async function CandidateProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ duplicate?: string; upload?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const candidate = getCandidate(id);
  if (!candidate) notFound();
  const docs = candidateDocuments(id);
  const jobs = listJobs();

  return <>
    <PageHeader title={candidate.name} subtitle={`${candidate.roles.join(" · ") || "Role not documented"} · ${candidate.location || "Location unknown"}`}>
      <div className="actions"><Status value={candidate.optOut ? "OPTED_OUT" : candidate.status}/><Link className="button secondary" href="/candidates">Candidate database</Link></div>
    </PageHeader>
    {query.duplicate && <div className="notice warn">A conservative duplicate rule matched an existing record, so no new candidate was created.</div>}
    {query.upload && <div className="notice">The document was preserved. Review its parser status below; failures remain available for manual review.</div>}
    <div className="grid two-col">
      <section className="card">
        <h2 className="section-title">Candidate record</h2>
        <div className="keyval">
          <div>Candidate ID</div><div className="break">{candidate.id}</div>
          <div>Permitted email</div><div>{candidate.email || "Not provided"}</div>
          <div>Phone</div><div>{candidate.phone || "Not provided"}</div>
          <div>Location</div><div>{candidate.location || "Unknown"}</div>
          <div>Visa / work authorization</div><div>{candidate.visaStatus || "Not provided"}</div>
          <div>Availability</div><div>{candidate.availability || "Unknown"}</div>
          <div>Compensation</div><div>{candidate.compensation || "Unknown"}</div>
          <div>Source</div><div>{candidate.sourceChannel}{candidate.sourceUrl ? ` · ${candidate.sourceUrl}` : ""}</div>
          <div>Contact preference</div><div>{candidate.contactPreference}</div>
          <div>Experience</div><div>{candidate.totalExperience ?? "Unknown"} total years · {candidate.relevantExperience ?? "Unknown"} relevant years</div>
          <div>Skills</div><div>{candidate.skills.join(", ") || "None recorded"}</div>
          <div>Certifications</div><div>{candidate.certifications.join(", ") || "None recorded"}</div>
          <div>Project experience</div><div>{candidate.projectExperience || "Not documented"}</div>
        </div>
      </section>
      <section className="card">
        <h2 className="section-title">Recruiter controls</h2>
        <form action={candidateStatusAction} className="grid" style={{gap:10}}>
          <input type="hidden" name="candidateId" value={candidate.id}/>
          <label>Pipeline status<select name="status" defaultValue={candidate.status}>{["DISCOVERED","IMPORTED","AWAITING_REVIEW","SCREENING_IN_PROGRESS","CLARIFICATION_REQUIRED","APPROVED_FOR_OUTREACH","CONTACTED","INTERESTED","NOT_INTERESTED","INTERVIEW_PENDING","INTERVIEW_COMPLETED","RECRUITER_REVIEW","SHORTLISTED","ON_HOLD","WITHDRAWN","CLOSED"].map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Reason for change<input name="reason" placeholder="Required workflow rationale"/></label>
          <button className="button secondary" type="submit">Update status</button>
        </form>
        <hr style={{border:0,borderTop:"1px solid #edf1f5",margin:"20px 0"}}/>
        <form action={optOutAction}>
          <input type="hidden" name="candidateId" value={candidate.id}/>
          <input type="hidden" name="optOut" value={candidate.optOut ? "false" : "true"}/>
          <button className={candidate.optOut ? "button secondary" : "button danger"} type="submit">{candidate.optOut ? "Restore contact permission" : "Record opt-out / do not contact"}</button>
        </form>
        <p className="muted">Opt-out blocks outreach approval and is recorded in audit history.</p>
      </section>
    </div>
    <section className="card" style={{ marginTop:18 }}>
      <h2 className="section-title">Resume & document references</h2>
      <form action={importResumeAction} className="form-grid">
        <input type="hidden" name="candidateId" value={candidate.id}/>
        <label className="full">Upload PDF, DOCX, or TXT resume<input name="file" type="file" accept=".pdf,.docx,.txt,application/pdf" required/></label>
        <div className="full"><button className="button" type="submit">Store and parse resume</button></div>
      </form>
      {docs.length ? <div className="table-wrap" style={{marginTop:16}}>
        <table className="table"><thead><tr><th>File</th><th>Parser status</th><th>Source</th><th>Added</th></tr></thead>
          <tbody>{docs.map((doc: any) => <tr key={doc.id}><td><strong>{doc.filename}</strong><div className="detail">Original retained in protected local storage</div></td><td><Status value={doc.parser_status}/></td><td>{doc.source}</td><td>{new Date(doc.created_at).toLocaleString()}</td></tr>)}</tbody>
        </table>
      </div> : <Empty>No documents have been imported.</Empty>}
    </section>
    <section className="card" style={{marginTop:18}}>
      <h2 className="section-title">Job-specific actions</h2>
      {jobs.length ? <div className="table-wrap">
        <table className="table"><thead><tr><th>Job</th><th>Screening result</th><th>Outreach</th><th>Response / interview</th></tr></thead>
          <tbody>{jobs.map(job => {
            const screening = getLatestScreening(job.id, candidate.id);
            return <tr key={job.id}>
              <td><Link href={`/jobs/${job.id}`}><strong>{job.title}</strong></Link><div className="detail"><Status value={job.status}/></div></td>
              <td>{screening ? <><span className="score">{screening.score}</span><div className="detail"><Status value={screening.status}/> rubric v{screening.rubricVersion}</div></> : <span className="muted">Not screened</span>}</td>
              <td><form action={draftOutreachAction}><input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="candidateId" value={candidate.id}/><button className="button secondary small" disabled={candidate.optOut} type="submit">Draft message</button></form></td>
              <td><details><summary className="muted">Record next step</summary>
                <form action={responseAction} className="grid" style={{gap:6,marginTop:8}}>
                  <input type="hidden" name="candidateId" value={candidate.id}/><input type="hidden" name="jobId" value={job.id}/>
                  <select name="status"><option value="INTERESTED">Interested</option><option value="NOT_INTERESTED">Not interested</option><option value="WITHDRAWN">Withdrawn</option><option value="CLARIFICATION_REQUIRED">Clarification required</option></select>
                  <textarea name="summary" placeholder="Candidate response summary" required/><button className="button secondary small" type="submit">Save response</button>
                </form>
                <form action={createInterviewAction} className="grid" style={{gap:6,marginTop:8}}>
                  <input type="hidden" name="candidateId" value={candidate.id}/><input type="hidden" name="jobId" value={job.id}/>
                  <input name="availability" placeholder="Candidate availability (optional)"/><button className="button small" type="submit">Create human-led interview</button>
                </form>
              </details></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <Empty>Create a job first.</Empty>}
    </section>
  </>;
}
