"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "./actions";

const groups: { label: string; links: [string, string][] }[] = [
  { label: "Workspace", links: [["Overview", "/"], ["Jobs", "/jobs"], ["Candidates", "/candidates"], ["Resume import", "/imports"]] },
  { label: "Agent workflows", links: [["Screening", "/screening"], ["Sourcing tasks", "/sourcing"], ["Outreach drafts", "/outreach"], ["Interviews", "/interviews"], ["Shortlists", "/shortlists"]] },
  { label: "Controls", links: [["Activity & audit", "/activity"], ["Settings", "/settings"]] },
];

export function Sidebar({ user }: { user: { name: string; role: string } }) {
  const pathname = usePathname();
  const initials = user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return <aside className="sidebar">
    <Link className="brand-lockup" href="/" aria-label="TEKenergy Recruiting AI home">
      <Image className="brand-logo" src="/tekenergy-logo.png" alt="TEKenergy" width={740} height={370} priority />
    </Link>
    <div className="brand-sub">Recruiting AI · Controlled</div>
    <nav className="nav-groups" aria-label="Main navigation">
      {groups.map(({ label, links }) => <div className="nav-section" key={label}>
        <div className="nav-group">{label}</div>
        {links.map(([linkLabel, href]) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return <Link className={`nav-item${active ? " active" : ""}`} key={href} href={href} aria-current={active ? "page" : undefined}>{linkLabel}</Link>;
        })}
      </div>)}
    </nav>
    <div className="side-footer">
      <span className="user-avatar" aria-hidden="true">{initials}</span>
      <div className="side-user">{user.name}<span className="muted">{user.role}</span></div>
      <form action={logoutAction}><button type="submit">Sign out</button></form>
    </div>
  </aside>;
}
