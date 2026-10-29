"use client";
import { useState } from "react";
export function CopyButton({ text }: { text: string }) { const [done, setDone] = useState(false); return <button className="button secondary small" type="button" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? "Copied" : "Copy"}</button>; }
