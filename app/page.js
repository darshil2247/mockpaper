"use client";
// app/page.js

import { useState, useEffect, useRef, forwardRef } from "react";

// ── External scripts: KaTeX + jsPDF ──────────────────────
function useExternalScripts() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let loaded = 0;
    const check = () => { if (++loaded >= 3) setReady(true); };

    if (!document.getElementById("katex-css")) {
      const l = document.createElement("link");
      l.id = "katex-css"; l.rel = "stylesheet";
      l.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
      document.head.appendChild(l);
    }

    const load = (id, src, cb) => {
      if (document.getElementById(id)) { cb(); return; }
      const s = document.createElement("script");
      s.id = id; s.src = src; s.onload = cb;
      document.head.appendChild(s);
    };
    load("katex-js",   "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js", check);
    load("katex-auto", "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js", check);
    load("jspdf-js",   "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", check);
  }, []);
  return ready;
}

// Renders text that may contain LaTeX using KaTeX auto-render
function MathText({ text }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !window.renderMathInElement) return;
    ref.current.textContent = text || "";
    try {
      window.renderMathInElement(ref.current, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$",  right: "$",  display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
      });
    } catch (e) {}
  }, [text]);
  return <span ref={ref}>{text}</span>;
}

// ── Topics ────────────────────────────────────────────────
const TOPICS = {
  "Algebra & Functions": ["Sequences & Series","Exponents & Logarithms","Binomial Theorem","Polynomial Functions","Rational Functions","Transformation of Functions"],
  "Calculus": ["Differentiation","Integration (definite & indefinite)","Integration by Parts","Volumes of Revolution","Differential Equations","Related Rates","Optimization"],
  "Geometry & Trigonometry": ["Trigonometric Functions","Trigonometric Identities","Vectors","Lines & Planes in 3D","Circle Geometry"],
  "Statistics & Probability": ["Descriptive Statistics","Probability","Distributions (Normal, Binomial, Poisson)","Hypothesis Testing","Regression & Correlation"],
  "Number & Algebra": ["Proof by Induction","Complex Numbers","Matrices","Systematic Counting"],
};

// ── PDF export ────────────────────────────────────────────
async function exportToPDF(ref, filename) {
  if (!window.jspdf) { alert("PDF library still loading — please wait a moment."); return; }
  const { jsPDF } = window.jspdf;
  const el = ref.current;
  if (!el) return;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await doc.html(el, {
    callback: (pdf) => pdf.save(filename),
    x: 10, y: 10,
    width: doc.internal.pageSize.getWidth() - 20,
    windowWidth: el.offsetWidth,
    autoPaging: "text",
    margin: [10, 10, 10, 10],
  });
}

// ── Design tokens ─────────────────────────────────────────
const C = {
  bg: "#0d0f18", surface: "#13161f", border: "#1e2130",
  gold: "#c9a84c", goldLight: "#e8c97a",
  muted: "#5a5f75", text: "#e4e1d8",
  green: "#2d6e4e", greenDark: "#0f2d1a",
  error: "#8b3a3a", errorText: "#f48fb1",
};

const diffMap = {
  Standard:       { bg: "#0d1f12", text: "#52b882", border: "#3a7d5c" },
  Challenging:    { bg: "#1f1400", text: "#d4a843", border: "#7d5c1a" },
  "Exam Stretch": { bg: "#1f0d0d", text: "#e07070", border: "#7d3a3a" },
};

// ── Main page ─────────────────────────────────────────────
export default function Home() {
  const scriptsReady = useExternalScripts();
  const [step,    setStep]    = useState("config"); // config | loading | result
  const [error,   setError]   = useState(null);
  const [result,  setResult]  = useState(null);
  const [showMS,  setShowMS]  = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const examRef = useRef(null);
  const msRef   = useRef(null);

  const [cfg, setCfg] = useState({
    level: "AA HL",
    paperType: "Paper 1 (No Calculator)",
    difficulty: "Standard",
    topics: [],
    numQuestions: 5,
    totalMarks: 60,
    additionalNotes: "",
  });

  const toggleTopic = (t) =>
    setCfg(c => ({ ...c, topics: c.topics.includes(t) ? c.topics.filter(x => x !== t) : [...c.topics, t] }));

  // ── Generate ─────────────────────────────────────────────
  const generate = async () => {
    if (cfg.topics.length === 0) { setError("Please select at least one topic."); return; }
    setError(null);
    setStep("loading");

    try {
      // Calls /api/generate — which is server-side and holds the API key
      const res  = await fetch("/api/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(cfg),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);

      setResult(json.data);
      setStep("result");
    } catch (e) {
      setError(e.message);
      setStep("config");
    }
  };

  const handlePDF = async () => {
    setPdfBusy(true);
    const ref      = showMS ? msRef : examRef;
    const name     = (result?.exam?.title || "Exam").replace(/\s+/g, "_");
    const filename = showMS ? `${name}_MarkScheme.pdf` : `${name}_Paper.pdf`;
    try { await exportToPDF(ref, filename); }
    catch (e) { alert("PDF export failed: " + e.message); }
    finally { setPdfBusy(false); }
  };

  // ── LOADING screen ────────────────────────────────────────
  if (step === "loading") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: C.text }}>
      <div style={{ fontSize: 48, marginBottom: 24, animation: "spin 2s linear infinite" }}>⟳</div>
      <div style={{ fontSize: 22, color: C.gold, marginBottom: 12 }}>Generating your exam…</div>
      <div style={{ fontSize: 14, color: C.muted, fontFamily: "monospace", maxWidth: 340, textAlign: "center", lineHeight: 1.7 }}>
        Claude is writing original questions and computing mark schemes.<br />
        This usually takes <b style={{ color: C.goldLight }}>20–40 seconds</b>.
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── RESULT screen ─────────────────────────────────────────
  if (step === "result" && result) {
    const exam = result.exam;
    const ms   = result.markScheme;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Georgia, serif", color: C.text }}>
        {/* Header */}
        <header style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 36px", display: "flex", alignItems: "center", gap: 14, background: C.bg }}>
          <IBLogo />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: "bold", color: C.gold }}>MockPaper AI</div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>
              {exam.title} · {exam.totalMarks} marks
            </div>
          </div>
          <button onClick={() => { setStep("config"); setResult(null); setShowMS(false); }}
            style={outlineBtn}>← New Exam</button>
          <button onClick={handlePDF} disabled={pdfBusy}
            style={{ ...solidBtn(C.green), opacity: pdfBusy ? 0.6 : 1, cursor: pdfBusy ? "not-allowed" : "pointer" }}>
            {pdfBusy ? "⟳ Exporting…" : "⬇ Export PDF"}
          </button>
        </header>

        {/* Tabs */}
        <div style={{ borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 36px", background: C.bg }}>
          {[["📄  Exam Paper", false], ["✓  Mark Scheme", true]].map(([label, isMS]) => (
            <button key={label} onClick={() => setShowMS(isMS)} style={{
              padding: "13px 22px", background: "none", border: "none",
              borderBottom: showMS === isMS ? `2px solid ${C.gold}` : "2px solid transparent",
              color: showMS === isMS ? C.gold : C.muted,
              cursor: "pointer", fontSize: 13, fontFamily: "monospace", marginBottom: -1, transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        <main style={{ maxWidth: 860, margin: "0 auto", padding: "36px 24px" }}>
          {!showMS && <ExamPaper ref={examRef} exam={exam} />}
          {showMS  && <MarkScheme ref={msRef}  ms={ms}   exam={exam} />}
        </main>
      </div>
    );
  }

  // ── CONFIG screen ─────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Georgia, serif" }}>
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "22px 36px", display: "flex", alignItems: "center", gap: 14, background: C.bg }}>
        <IBLogo />
        <div>
          <div style={{ fontSize: 18, fontWeight: "bold", color: C.gold }}>MockPaper AI</div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>
            IB Mathematics · Original Questions · LaTeX · PDF Export
          </div>
        </div>
        {!scriptsReady && (
          <div style={{ marginLeft: "auto", fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
            ⟳ Loading math engine…
          </div>
        )}
      </header>

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "44px 24px" }}>

        <Section label="Course">
          <PillRow options={["AA HL","AA SL","AI HL","AI SL"]} value={cfg.level}
            onChange={v => setCfg(c => ({ ...c, level: v }))} />
        </Section>

        <Section label="Paper Type">
          <PillRow
            options={["Paper 1 (No Calculator)","Paper 2 (Calculator)","Mixed / Custom"]}
            value={cfg.paperType}
            onChange={v => setCfg(c => ({ ...c, paperType: v }))} />
        </Section>

        <Section label="Difficulty">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(diffMap).map(([d, dc]) => (
              <button key={d}
                onClick={() => setCfg(c => ({ ...c, difficulty: d }))}
                style={{
                  padding: "7px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                  border: `1.5px solid ${cfg.difficulty === d ? dc.border : C.border}`,
                  background: cfg.difficulty === d ? dc.bg : C.surface,
                  color: cfg.difficulty === d ? dc.text : C.muted,
                  fontFamily: "monospace", transition: "all 0.15s", outline: "none",
                }}>{d}</button>
            ))}
          </div>
        </Section>

        <Section label={`Topics — ${cfg.topics.length} selected`}>
          {Object.entries(TOPICS).map(([group, topics]) => (
            <div key={group} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>{group}</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {topics.map(t => (
                  <button key={t} onClick={() => toggleTopic(t)} style={{
                    padding: "6px 14px", borderRadius: 6, fontSize: 12.5, cursor: "pointer",
                    border: `1.5px solid ${cfg.topics.includes(t) ? C.gold : C.border}`,
                    background: cfg.topics.includes(t) ? "#1c1807" : C.surface,
                    color: cfg.topics.includes(t) ? C.gold : C.muted,
                    fontFamily: "monospace", transition: "all 0.15s", outline: "none",
                  }}>{t}</button>
                ))}
              </div>
            </div>
          ))}
        </Section>

        <Section label="Paper Structure">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <SliderField label="Questions" min={3} max={10} step={1}
              value={cfg.numQuestions} onChange={v => setCfg(c => ({ ...c, numQuestions: v }))} />
            <SliderField label="Total Marks" min={20} max={120} step={5}
              value={cfg.totalMarks} onChange={v => setCfg(c => ({ ...c, totalMarks: v }))} />
          </div>
        </Section>

        <Section label="Additional Notes (optional)">
          <textarea
            style={{ width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13.5, padding: "11px 15px", fontFamily: "Georgia,serif", resize: "vertical", minHeight: 72, boxSizing: "border-box", lineHeight: 1.6 }}
            placeholder="e.g. 'Include a related rates question involving a cone' or 'Focus on Paper 2 long-answer for the last two questions'"
            value={cfg.additionalNotes}
            onChange={e => setCfg(c => ({ ...c, additionalNotes: e.target.value }))}
          />
        </Section>

        {error && (
          <div style={{ background: "#1a0a0a", border: `1px solid ${C.error}`, borderRadius: 8, padding: "12px 16px", color: C.errorText, fontSize: 12.5, fontFamily: "monospace", marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}

        <button onClick={generate} disabled={!scriptsReady} style={{
          width: "100%", padding: 16,
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
          color: C.bg, border: "none", borderRadius: 10,
          fontSize: 15, fontWeight: "bold", cursor: "pointer",
          letterSpacing: "0.04em", fontFamily: "monospace", transition: "all 0.2s",
          opacity: scriptsReady ? 1 : 0.5,
        }}>
          ✦ Generate Mock Exam Paper
        </button>

        {!scriptsReady && (
          <p style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: C.muted, fontFamily: "monospace" }}>
            Waiting for math engine to load…
          </p>
        )}
      </main>
    </div>
  );
}

// ── Exam Paper component ──────────────────────────────────
const ExamPaper = forwardRef(({ exam }, ref) => (
  <div ref={ref} style={{ background: "#fff", color: "#111", borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
    <div style={{ background: "#1a2340", color: "white", padding: "32px 44px", textAlign: "center" }}>
      <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.45, marginBottom: 8, fontFamily: "monospace" }}>
        International Baccalaureate · Mock Examination
      </div>
      <div style={{ fontSize: 22, fontWeight: "bold", fontFamily: "Georgia,serif", marginBottom: 4 }}>{exam.title}</div>
      <div style={{ fontSize: 13, opacity: 0.6, fontFamily: "monospace" }}>{exam.subtitle}</div>
    </div>

    <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 44px", background: "#f0f0f0", fontSize: 11.5, fontFamily: "monospace", color: "#555", borderBottom: "2px solid #d0d0d0" }}>
      <span>Duration: <b>{exam.duration}</b></span>
      <span>Total Marks: <b>{exam.totalMarks}</b></span>
      <span>Questions: <b>{exam.questions?.length}</b></span>
    </div>

    <div style={{ padding: "18px 44px", background: "#fafafa", borderBottom: "1px solid #e0e0e0" }}>
      <div style={{ fontSize: 10.5, fontWeight: "bold", letterSpacing: "0.1em", color: "#777", textTransform: "uppercase", marginBottom: 8, fontFamily: "monospace" }}>
        Instructions to Candidates
      </div>
      {exam.instructions?.map((inst, i) => (
        <div key={i} style={{ fontSize: 13, color: "#333", marginBottom: 4 }}>• {inst}</div>
      ))}
    </div>

    {exam.questions?.map(q => (
      <div key={q.number} style={{ padding: "28px 44px", borderBottom: "1px solid #eee" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, background: "#1a2340", color: "white", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold", flexShrink: 0, fontFamily: "monospace" }}>
            {q.number}
          </div>
          <div style={{ flex: 1 }}>
            {q.context && (
              <div style={{ fontSize: 13.5, color: "#444", fontStyle: "italic", lineHeight: 1.65, marginBottom: 6 }}>
                <MathText text={q.context} />
              </div>
            )}
          </div>
          {q.topic && (
            <div style={{ fontSize: 10.5, background: "#e8f0fe", color: "#3c5a99", padding: "3px 10px", borderRadius: 20, fontFamily: "monospace", flexShrink: 0 }}>
              {q.topic}
            </div>
          )}
        </div>

        {q.parts?.map(part => (
          <div key={part.label} style={{ paddingLeft: 46, marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontWeight: "bold", fontSize: 14, color: "#1a2340" }}>({part.label})</span>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "#999", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 4, padding: "1px 7px", marginLeft: "auto" }}>
                [{part.marks} mark{part.marks !== 1 ? "s" : ""}]
              </span>
            </div>
            <div style={{ fontSize: 14, color: "#1a1a1a", lineHeight: 1.8 }}>
              <MathText text={part.text} />
            </div>
            <div style={{ marginTop: 12 }}>
              {Array.from({ length: Math.max(2, Math.ceil(part.marks * 1.1)) }).map((_, i) => (
                <div key={i} style={{ height: 26, borderBottom: "1px dotted #ccc", marginBottom: 2 }} />
              ))}
            </div>
          </div>
        ))}

        <div style={{ textAlign: "right", marginTop: 4 }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#bbb" }}>
            [{q.totalMarks} marks]
          </span>
        </div>
      </div>
    ))}

    <div style={{ padding: "16px 44px", background: "#f5f5f5", textAlign: "center", fontSize: 11, color: "#bbb", fontFamily: "monospace" }}>
      End of Examination · Generated by MockPaper AI
    </div>
  </div>
));
ExamPaper.displayName = "ExamPaper";

// ── Mark Scheme component ─────────────────────────────────
const MarkScheme = forwardRef(({ ms, exam }, ref) => (
  <div ref={ref} style={{ background: "#fff", color: "#111", borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
    <div style={{ background: "#0f2d1a", color: "white", padding: "28px 44px" }}>
      <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.45, marginBottom: 8, fontFamily: "monospace" }}>
        International Baccalaureate · Mark Scheme
      </div>
      <div style={{ fontSize: 20, fontWeight: "bold", fontFamily: "Georgia,serif", marginBottom: 3 }}>{exam?.title}</div>
      <div style={{ fontSize: 12.5, opacity: 0.6, fontFamily: "monospace" }}>
        {exam?.subtitle} · {exam?.totalMarks} marks
      </div>
    </div>

    {/* Legend */}
    <div style={{ padding: "11px 44px", background: "#f0faf4", borderBottom: "1px solid #c8e6c9", display: "flex", gap: 18, flexWrap: "wrap" }}>
      {[["M1","Method"],["A1","Accuracy"],["ft","Follow-through"],["AG","Answer given"],["R1","Reasoning"]].map(([code, desc]) => (
        <span key={code} style={{ fontSize: 11.5, fontFamily: "monospace" }}>
          <b style={{ background: "#d4edda", padding: "1px 6px", borderRadius: 3, color: "#155724", border: "1px solid #c3e6cb" }}>{code}</b>
          <span style={{ color: "#666", marginLeft: 5 }}>{desc}</span>
        </span>
      ))}
    </div>

    {ms.questions?.map(q => (
      <div key={q.number} style={{ padding: "26px 44px", borderBottom: "1px solid #e8f5e9" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: "#0f2d1a", marginBottom: 16, fontFamily: "Georgia,serif", paddingBottom: 10, borderBottom: "1px solid #e0e0e0" }}>
          Question {q.number}
        </div>

        {q.parts?.map(part => (
          <div key={part.label} style={{ marginBottom: 22, paddingLeft: 16, borderLeft: "3px solid #81c784" }}>
            <div style={{ fontWeight: "bold", fontSize: 13, color: "#2e7d32", marginBottom: 8, fontFamily: "monospace" }}>
              Part ({part.label})
            </div>

            <div style={{ fontSize: 13.5, color: "#222", lineHeight: 1.9, background: "#f9fef9", padding: "12px 16px", borderRadius: 7, marginBottom: 10, border: "1px solid #e0f0e0", whiteSpace: "pre-wrap" }}>
              <MathText text={part.solution} />
            </div>

            {part.marks_breakdown?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {part.marks_breakdown.map((m, i) => (
                  <span key={i} style={{ fontSize: 11.5, fontFamily: "monospace", background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7", padding: "2px 9px", borderRadius: 4 }}>
                    {m}
                  </span>
                ))}
              </div>
            )}

            {part.answer && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 6, padding: "6px 14px", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#555", fontFamily: "monospace" }}>Answer:</span>
                <span style={{ fontWeight: "bold", fontSize: 14, color: "#0f2d1a" }}>
                  <MathText text={part.answer} />
                </span>
              </div>
            )}

            {part.examiner_note && (
              <div style={{ fontSize: 12, color: "#c0392b", fontStyle: "italic", fontFamily: "monospace", marginTop: 7, padding: "6px 12px", background: "#fff5f5", borderRadius: 5, border: "1px solid #f5c6cb" }}>
                ⚠ Examiner note: {part.examiner_note}
              </div>
            )}
          </div>
        ))}
      </div>
    ))}

    <div style={{ padding: "16px 44px", background: "#f0faf4", textAlign: "center", fontSize: 11, color: "#bbb", fontFamily: "monospace" }}>
      End of Mark Scheme · Generated by MockPaper AI
    </div>
  </div>
));
MarkScheme.displayName = "MarkScheme";

// ── Tiny shared components ────────────────────────────────
function IBLogo() {
  return (
    <div style={{ width: 42, height: 42, background: `linear-gradient(135deg, #c9a84c, #e8c97a)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: "bold", color: "#0d0f18", fontFamily: "serif", flexShrink: 0 }}>
      IB
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 10.5, fontFamily: "monospace", letterSpacing: "0.12em", color: "#c9a84c", textTransform: "uppercase" }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, #2a2d3a, transparent)" }} />
      </div>
      {children}
    </div>
  );
}

function PillRow({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{
          padding: "7px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer",
          border: `1.5px solid ${value === o ? "#c9a84c" : "#1e2130"}`,
          background: value === o ? "#1c1807" : "#13161f",
          color: value === o ? "#c9a84c" : "#5a5f75",
          fontFamily: "monospace", transition: "all 0.15s", outline: "none",
        }}>{o}</button>
      ))}
    </div>
  );
}

function SliderField({ label, min, max, step, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#5a5f75", fontFamily: "monospace", marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <input type="range" min={min} max={max} step={step} value={value}
          style={{ flex: 1, appearance: "none", height: 4, background: "#1e2130", borderRadius: 2, outline: "none", cursor: "pointer" }}
          onChange={e => onChange(+e.target.value)} />
        <span style={{ minWidth: 38, textAlign: "right", color: "#c9a84c", fontFamily: "monospace", fontSize: 18, fontWeight: "bold" }}>{value}</span>
      </div>
    </div>
  );
}

const outlineBtn = {
  background: "transparent", border: "1px solid #1e2130", color: "#5a5f75",
  borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer", fontFamily: "monospace",
};

const solidBtn = (bg) => ({
  background: bg, border: "none", color: "white",
  borderRadius: 8, padding: "8px 18px", fontSize: 12.5, cursor: "pointer",
  fontFamily: "monospace", fontWeight: "bold", marginLeft: 4,
});
