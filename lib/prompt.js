// lib/prompt.js
// All exam generation logic lives here — server-side only, never sent to browser

export const TOPICS = {
  "Algebra & Functions": [
    "Sequences & Series",
    "Exponents & Logarithms",
    "Binomial Theorem",
    "Polynomial Functions",
    "Rational Functions",
    "Transformation of Functions",
  ],
  Calculus: [
    "Differentiation",
    "Integration (definite & indefinite)",
    "Integration by Parts",
    "Volumes of Revolution",
    "Differential Equations",
    "Related Rates",
    "Optimization",
  ],
  "Geometry & Trigonometry": [
    "Trigonometric Functions",
    "Trigonometric Identities",
    "Vectors",
    "Lines & Planes in 3D",
    "Circle Geometry",
  ],
  "Statistics & Probability": [
    "Descriptive Statistics",
    "Probability",
    "Distributions (Normal, Binomial, Poisson)",
    "Hypothesis Testing",
    "Regression & Correlation",
  ],
  "Number & Algebra": [
    "Proof by Induction",
    "Complex Numbers",
    "Matrices",
    "Systematic Counting",
  ],
};

export const ALL_TOPICS = Object.values(TOPICS).flat();

export function buildPrompt(config) {
  const { level, paperType, difficulty, topics, numQuestions, totalMarks, additionalNotes } = config;
  const isHL     = level.includes("HL");
  const isPaper1 = paperType === "Paper 1 (No Calculator)";

  return `You are an expert IB Mathematics examiner with 15+ years writing official IB exam papers. Generate an original mock exam and mark scheme. Do NOT copy or closely paraphrase any real past paper questions — all questions must be original.

EXAM CONFIGURATION:
- Course: IB Mathematics ${level}
- Paper Type: ${paperType}
- Topics: ${topics.join(", ")}
- Difficulty: ${difficulty}
- Total Marks: ${totalMarks}
- Number of Questions: ${numQuestions}
${additionalNotes ? `- Teacher Notes: ${additionalNotes}` : ""}

STRICT REQUIREMENTS:
1. ALL math must use LaTeX: inline with $...$  and display with $$...$$
   Examples: "Find $f'(x)$ where $f(x) = \\ln(x^2 + 1)$"
             "Show that $$\\int_0^{\\pi} \\sin x \\, dx = 2$$"
2. Use authentic IB command terms: Find, Show that, Hence, Calculate, Determine, Prove, Sketch, Write down, Hence or otherwise
3. Label parts (a), (b), (c)… Mark allocations in square brackets: [3 marks]
4. ${isPaper1 ? "Paper 1: exact values only — surds, fractions, multiples of π. No decimals." : "Paper 2: calculator expected — use realistic decimals and real-world data."}
5. ${isHL ? "HL: include proof questions, abstract reasoning, and novel unseen contexts." : "SL: focus on guided procedural fluency with some application."}
6. Difficulty ${difficulty === "Standard" ? "— accessible, routine IB questions" : difficulty === "Challenging" ? "— above average, multi-step reasoning required" : "— hardest IB style, discriminating questions for top candidates"}
7. Questions must sum to EXACTLY ${totalMarks} marks total.
8. Mark scheme: use M1 (method), A1 (accuracy), ft (follow-through), AG (answer given), R1 (reasoning). Show complete working.

Return ONLY a valid JSON object — no prose, no markdown code fences, nothing else:

{
  "exam": {
    "title": "IB Mathematics ${level} Mock Examination",
    "subtitle": "${paperType}",
    "duration": "${isPaper1 ? "90 minutes" : "120 minutes"}",
    "totalMarks": ${totalMarks},
    "instructions": [
      "Answer all questions.",
      "${isPaper1 ? "Unless otherwise stated, do not use a calculator." : "A graphic display calculator is required."}",
      "Show all working clearly.",
      "Answers without working may not receive full marks."
    ],
    "questions": [
      {
        "number": 1,
        "topic": "Topic Name",
        "totalMarks": 12,
        "context": "Optional real-world setup (or empty string)",
        "parts": [
          {
            "label": "a",
            "text": "Question text using $LaTeX$ notation.",
            "marks": 4,
            "command_term": "Find"
          }
        ]
      }
    ]
  },
  "markScheme": {
    "questions": [
      {
        "number": 1,
        "parts": [
          {
            "label": "a",
            "solution": "Step-by-step worked solution with $LaTeX$ math.",
            "marks_breakdown": ["M1 for setting up the equation", "A1 for correct answer"],
            "answer": "$x = \\frac{3}{2}$",
            "examiner_note": "Common error: students often forget to..."
          }
        ]
      }
    ]
  }
}

Generate all ${numQuestions} questions now. Double-check all arithmetic is correct before outputting.`;
}

export const VALID_LEVELS    = ["AA HL", "AA SL", "AI HL", "AI SL"];
export const VALID_PAPERS    = ["Paper 1 (No Calculator)", "Paper 2 (Calculator)", "Mixed / Custom"];
export const VALID_DIFF      = ["Standard", "Challenging", "Exam Stretch"];

export function validateConfig(body) {
  const errors = [];
  if (!VALID_LEVELS.includes(body.level))       errors.push("Invalid level");
  if (!VALID_PAPERS.includes(body.paperType))   errors.push("Invalid paperType");
  if (!VALID_DIFF.includes(body.difficulty))    errors.push("Invalid difficulty");
  if (!Array.isArray(body.topics) || body.topics.length === 0) errors.push("Select at least one topic");
  if (body.topics.some(t => !ALL_TOPICS.includes(t)))          errors.push("Unknown topic");
  if (body.numQuestions < 3 || body.numQuestions > 10)         errors.push("numQuestions must be 3–10");
  if (body.totalMarks < 20  || body.totalMarks > 120)          errors.push("totalMarks must be 20–120");
  if (body.additionalNotes && body.additionalNotes.length > 500) errors.push("Notes too long");
  return errors;
}
