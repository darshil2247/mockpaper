// app/api/generate/route.js
// This runs on the SERVER — your Anthropic API key never reaches the browser.

import Anthropic from "@anthropic-ai/sdk";
import { buildPrompt, validateConfig } from "../../../lib/prompt";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Simple in-memory rate limiter (resets on server restart)
// For production: swap with Redis or Upstash
const rateLimitMap = new Map();
const RATE_LIMIT   = 20;   // max requests
const WINDOW_MS    = 60 * 60 * 1000; // per hour

function checkRateLimit(ip) {
  const now    = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, windowStart: now };

  if (now - record.windowStart > WINDOW_MS) {
    // New window — reset
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= RATE_LIMIT) return false;

  record.count++;
  rateLimitMap.set(ip, record);
  return true;
}

export async function POST(request) {
  // ── Rate limit ──────────────────────────────────────────
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Too many requests. Please wait before generating another paper." },
      { status: 429 }
    );
  }

  // ── Parse body ──────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ── Validate config ─────────────────────────────────────
  const errors = validateConfig(body);
  if (errors.length > 0) {
    return Response.json({ error: errors.join(". ") }, { status: 400 });
  }

  // ── Sanitise free-text fields ───────────────────────────
  const config = {
    level:           body.level,
    paperType:       body.paperType,
    difficulty:      body.difficulty,
    topics:          body.topics,
    numQuestions:    Number(body.numQuestions),
    totalMarks:      Number(body.totalMarks),
    additionalNotes: (body.additionalNotes || "")
      .replace(/[<>{}[\]\\]/g, "")   // strip injection characters
      .slice(0, 500)
      .trim(),
  };

  // ── Call Claude ─────────────────────────────────────────
  try {
    const message = await client.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages:   [{ role: "user", content: buildPrompt(config) }],
    });

    const raw = message.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    // Extract the JSON object from Claude's response
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("[generate] No JSON found in response:", raw.slice(0, 400));
      return Response.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 500 }
      );
    }

    const result = JSON.parse(match[0]);

    return Response.json({ success: true, data: result });

  } catch (err) {
    console.error("[generate] Error calling Anthropic:", err);
    console.error("[generate] Error details:", {
      status: err?.status,
      message: err?.message,
      error: err?.error,
    });

    // Surface helpful errors
    if (err?.status === 401) {
      return Response.json(
        { error: "Invalid Anthropic API key. Check your ANTHROPIC_API_KEY environment variable." },
        { status: 500 }
      );
    }

    if (err?.status === 400) {
      return Response.json(
        { error: `Anthropic API error: ${err?.message || "Bad request format"}` },
        { status: 500 }
      );
    }

    return Response.json(
      { error: `Failed to generate exam: ${err?.message || "Unknown error"}` },
      { status: 500 }
    );
  }
}
