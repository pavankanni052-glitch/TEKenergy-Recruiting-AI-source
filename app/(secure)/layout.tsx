import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { seedDemoData } from "@/lib/demo";
import { Sidebar } from "../sidebar";
export default async function SecureLayout({ children }: { children: React.ReactNode }) { if (process.env.TEKENERGY_DEMO_MODE !== "false") seedDemoData(); const user = await getCurrentUser(); if (!user) redirect("/login"); return <div className="shell"><Sidebar user={user} /><main className="main"><header className="topbar"><div className="topbar-context"><span className="topbar-kicker">TEKENERGY · TALENT OPERATIONS</span><strong>Recruiting workspace</strong></div><div className="topbar-meta"><span className="secure-pill"><i aria-hidden="true" />Human approval required</span><span className="topbar-user">{user.name}</span></div></header><div className="content">{children}</div></main></div>; }
