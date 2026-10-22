"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, FileUp, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { deletePlaybook, getActivePlaybookId, getPlaybooks, savePlaybook, setActivePlaybookId, uid } from "@/lib/store";
import type { Playbook } from "@/lib/types";
import { Banner, Pill, useHydrated } from "@/components/ui";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function PlaybookPage() {
  const hydrated = useHydrated();
  const [all, setAll] = useState<Playbook[]>([]);
  const [activeId, setActiveId] = useState("");
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [tab, setTab] = useState<"edit" | "import">("edit");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; title: string; detail?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!hydrated) return; const pbs = getPlaybooks(); setAll(pbs); setActiveId(getActivePlaybookId()); setEditing(pbs.find((p) => p.id === getActivePlaybookId()) ?? pbs[0]); }, [hydrated]);

  function refresh(selectId?: string) { const pbs = getPlaybooks(); setAll(pbs); if (selectId) { setActivePlaybookId(selectId); setActiveId(selectId); setEditing(pbs.find((p) => p.id === selectId) ?? pbs[0]); } }

  function validate(p: Playbook): string | null {
    if (!p.name.trim()) return "Give the playbook a name.";
    if (!p.company.trim()) return "Company is required.";
    if (!p.product.trim()) return "Describe the product or offer.";
    if (p.stages.length === 0) return "Add at least one sales stage.";
    if (p.stages.some((s) => !s.name.trim())) return "Every stage needs a name.";
    if (p.objections.some((o) => !o.objection.trim() || !o.response.trim())) return "Every objection needs both the objection and the approved response.";
    const w = p.rubric.reduce((s, r) => s + (Number(r.weight) || 0), 0);
    if (p.rubric.length && Math.abs(w - 100) > 1) return `Rubric weights add up to ${w}%, they should total 100%.`;
    return null;
  }

  function save() {
    if (!editing) return;
    const err = validate(editing);
    if (err) { setMsg({ kind: "error", title: err }); return; }
    savePlaybook(editing); refresh(editing.id);
    setMsg({ kind: "success", title: "Playbook saved and set as active." });
  }

  async function importText() {
    setMsg(null);
    if (raw.trim().length < 80) { setMsg({ kind: "error", title: "Paste more material", detail: "At least a few paragraphs: a script, objection list, product sheet, pricing, anything your reps are trained on." }); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/playbook-parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: raw }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Import failed (${r.status})`);
      const pb: Playbook = { ...j, id: uid("pb") };
      savePlaybook(pb); refresh(pb.id); setTab("edit"); setRaw("");
      setMsg({ kind: "success", title: `Imported “${pb.name}”`, detail: "Review the stages, objections and rubric, then save. It is already the active playbook." });
    } catch (e: any) { setMsg({ kind: "error", title: "Could not structure that material", detail: e?.message ?? String(e) }); }
    setBusy(false);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!/\.(txt|md|csv|json)$/i.test(f.name)) { setMsg({ kind: "error", title: "Text files only for the POC", detail: "Export your PDF or DOCX to .txt or .md and upload that, or paste the text." }); return; }
    if (f.size > 400_000) { setMsg({ kind: "error", title: "File too large", detail: "Keep it under 400 KB." }); return; }
    setRaw(await f.text());
    setMsg({ kind: "info", title: `Loaded ${f.name}`, detail: "Click “Structure with AI” to turn it into a playbook." });
  }

  if (!hydrated || !editing) return <div className="py-24 text-center text-sand-300/50">Loading…</div>;
  const e = editing;
  const set = (patch: Partial<Playbook>) => setEditing({ ...e, ...patch });

  return (
    <div className="py-10">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="label mb-2">Organisational knowledge</div>
          <h1 className="font-display text-4xl text-sand-50">Train Majlis on your playbook.</h1>
          <p className="text-sand-200/70 mt-2 max-w-2xl">Every live prompt, roleplay buyer and scorecard is grounded in what you put here. Approved wording is quoted back verbatim.</p>
        </div>
        <div className="flex gap-2">
          <button className={tab === "edit" ? "btn-gold" : "btn-ghost"} onClick={() => setTab("edit")}><BookOpen size={15} /> Edit</button>
          <button className={tab === "import" ? "btn-gold" : "btn-ghost"} onClick={() => setTab("import")}><Wand2 size={15} /> Import with AI</button>
        </div>
      </div>

      {msg && <div className="mb-6"><Banner kind={msg.kind} title={msg.title} onClose={() => setMsg(null)}>{msg.detail}</Banner></div>}

      <div className="grid lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3 space-y-2">
          {all.map((p) => (
            <button key={p.id} onClick={() => { setEditing(p); setTab("edit"); }} className={`w-full text-left glass p-4 transition hover:border-gold-500/40 ${e.id === p.id ? "border-gold-500/60" : ""}`}>
              <div className="flex items-center justify-between gap-2"><div className="font-semibold text-sand-50 text-sm truncate">{p.name}</div>{activeId === p.id && <Pill tone="ok">active</Pill>}</div>
              <div className="text-xs text-sand-300/60 mt-1">{p.stages.length} stages · {p.objections.length} objections</div>
            </button>
          ))}
          <button onClick={() => { const np: Playbook = { id: uid("pb"), name: "New playbook", company: "", product: "", stages: [{ name: "Discovery", items: [] }], objections: [], talkTracks: [], rubric: [{ criterion: "Discovery depth", description: "", weight: 50 }, { criterion: "Next-step clarity", description: "", weight: 50 }], notes: "" }; setEditing(np); setTab("edit"); }} className="btn-ghost w-full"><Plus size={15} /> New playbook</button>
        </aside>

        <section className="lg:col-span-9">
          {tab === "import" ? (
            <div className="glass-strong p-6 space-y-4">
              <div className="flex items-center gap-2 text-sand-50 font-semibold"><Sparkles size={16} className="text-gold-300" /> Paste or upload anything your reps are trained on</div>
              <p className="text-sm text-sand-200/70">Scripts, objection sheets, pricing, product one-pagers. Claude structures it into stages, approved objection responses, talk tracks and a scoring rubric. You review before it goes live.</p>
              <textarea className="input min-h-[280px] font-mono text-[13px]" value={raw} onChange={(ev) => setRaw(ev.target.value)} placeholder="Paste playbook text here…" />
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json" className="hidden" onChange={(ev) => onFile(ev.target.files?.[0])} />
                  <button className="btn-ghost" onClick={() => fileRef.current?.click()}><FileUp size={15} /> Upload .txt / .md</button>
                  <span className="text-xs text-sand-300/50">{raw.length.toLocaleString()} characters</span>
                </div>
                <button className="btn-gold" onClick={importText} disabled={busy || raw.trim().length < 80}><Wand2 size={15} /> {busy ? "Structuring…" : "Structure with AI"}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="glass p-6 grid md:grid-cols-2 gap-4">
                <Field label="Playbook name"><input className="input" value={e.name} onChange={(ev) => set({ name: ev.target.value })} maxLength={80} /></Field>
                <Field label="Company"><input className="input" value={e.company} onChange={(ev) => set({ company: ev.target.value })} maxLength={80} /></Field>
                <Field label="Product / offer" full><input className="input" value={e.product} onChange={(ev) => set({ product: ev.target.value })} maxLength={300} /></Field>
                <Field label="Background notes (ICP, differentiators, compliance rules)" full><textarea className="input min-h-[90px]" value={e.notes} onChange={(ev) => set({ notes: ev.target.value })} maxLength={4000} /></Field>
              </div>

              <div className="glass p-6">
                <div className="flex items-center justify-between mb-3"><div className="label">Sales process · stages and checklist items</div><button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => set({ stages: [...e.stages, { name: "New stage", items: [] }] })}><Plus size={13} /> Stage</button></div>
                <div className="grid md:grid-cols-2 gap-3">
                  {e.stages.map((s, i) => (
                    <div key={i} className="rounded-xl border border-white/10 p-3 space-y-2">
                      <div className="flex gap-2"><input className="input" value={s.name} onChange={(ev) => { const st = [...e.stages]; st[i] = { ...s, name: ev.target.value }; set({ stages: st }); }} placeholder="Stage name" /><button className="text-sand-300/50 hover:text-uae-red" onClick={() => set({ stages: e.stages.filter((_, j) => j !== i) })} aria-label="Remove stage"><Trash2 size={15} /></button></div>
                      <textarea className="input min-h-[90px] text-[13px]" value={s.items.join("\n")} onChange={(ev) => { const st = [...e.stages]; st[i] = { ...s, items: lines(ev.target.value) }; set({ stages: st }); }} placeholder="One checklist item per line" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass p-6">
                <div className="flex items-center justify-between mb-3"><div className="label">Approved objection responses</div><button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => set({ objections: [...e.objections, { objection: "", response: "" }] })}><Plus size={13} /> Objection</button></div>
                <div className="space-y-3">
                  {e.objections.map((o, i) => (
                    <div key={i} className="grid md:grid-cols-[1fr_2fr_auto] gap-2">
                      <input className="input" value={o.objection} onChange={(ev) => { const ob = [...e.objections]; ob[i] = { ...o, objection: ev.target.value }; set({ objections: ob }); }} placeholder="What the buyer says" />
                      <textarea className="input min-h-[44px]" value={o.response} onChange={(ev) => { const ob = [...e.objections]; ob[i] = { ...o, response: ev.target.value }; set({ objections: ob }); }} placeholder="Approved response, in your words" />
                      <button className="text-sand-300/50 hover:text-uae-red px-2" onClick={() => set({ objections: e.objections.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  {e.objections.length === 0 && <div className="text-sm text-sand-300/50">No objections yet. Add the five you hear most.</div>}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="glass p-6">
                  <div className="label mb-3">Talk tracks and facts (one per line)</div>
                  <textarea className="input min-h-[180px] text-[13px]" value={e.talkTracks.join("\n")} onChange={(ev) => set({ talkTracks: lines(ev.target.value) })} placeholder="Pricing, timelines, proof points, compliance rules…" />
                </div>
                <div className="glass p-6">
                  <div className="flex items-center justify-between mb-3"><div className="label">Scoring rubric (weights total 100)</div><button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => set({ rubric: [...e.rubric, { criterion: "", description: "", weight: 0 }] })}><Plus size={13} /> Criterion</button></div>
                  <div className="space-y-2">
                    {e.rubric.map((r, i) => (
                      <div key={i} className="grid grid-cols-[1fr_72px_auto] gap-2">
                        <div className="space-y-1">
                          <input className="input !py-1.5" value={r.criterion} onChange={(ev) => { const rb = [...e.rubric]; rb[i] = { ...r, criterion: ev.target.value }; set({ rubric: rb }); }} placeholder="Criterion" />
                          <input className="input !py-1.5 text-xs" value={r.description} onChange={(ev) => { const rb = [...e.rubric]; rb[i] = { ...r, description: ev.target.value }; set({ rubric: rb }); }} placeholder="What good looks like" />
                        </div>
                        <input className="input !py-1.5 font-mono text-center" type="number" min={0} max={100} value={r.weight} onChange={(ev) => { const rb = [...e.rubric]; rb[i] = { ...r, weight: Number(ev.target.value) }; set({ rubric: rb }); }} />
                        <button className="text-sand-300/50 hover:text-uae-red px-1" onClick={() => set({ rubric: e.rubric.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 size={15} /></button>
                      </div>
                    ))}
                    <div className={`text-xs text-right ${Math.abs(e.rubric.reduce((s, r) => s + (Number(r.weight) || 0), 0) - 100) > 1 ? "text-uae-red" : "text-emerald-450"}`}>Total {e.rubric.reduce((s, r) => s + (Number(r.weight) || 0), 0)}%</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-2">
                  {all.length > 1 && all.some((p) => p.id === e.id) && <button className="btn-ghost text-uae-red" onClick={() => { if (confirm(`Delete “${e.name}”?`)) { deletePlaybook(e.id); refresh(getActivePlaybookId()); } }}><Trash2 size={15} /> Delete</button>}
                </div>
                <div className="flex gap-2">
                  {activeId !== e.id && all.some((p) => p.id === e.id) && <button className="btn-ghost" onClick={() => refresh(e.id)}>Set as active</button>}
                  <button className="btn-gold" onClick={save}><Check size={15} /> Save and use</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? "md:col-span-2" : ""}`}><div className="label mb-1.5">{label}</div>{children}</label>;
}
