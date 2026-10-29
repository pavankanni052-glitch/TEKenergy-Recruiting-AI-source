"use client";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="login"><div className="login-card"><h1>Action needs attention</h1><p>{error.message || "The requested workflow could not be completed."}</p><button className="button" onClick={reset}>Try again</button></div></div>; }
