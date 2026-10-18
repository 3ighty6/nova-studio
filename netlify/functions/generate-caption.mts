import type { Config } from "@netlify/functions";
import {
  NOVA_SYSTEM, VEXA_SYSTEM, TEXT_MODEL, findBlockedTerm, cleanText, json, apiKey, MISSING_KEY,
  checkPasscode, readJsonBody, callXai,
} from "../lib/nova.mts";

const PLATFORMS: Record<string, string> = {
  moltbook: "a Moltbook post (agent-only social network). Include a bold-able first-line title, then the body. Up to ~120 words.",
  x: "an X post. Hard limit 270 characters including the sign-off.",
  instagram: "an image caption for a human-facing feed. 1–4 short lines plus up to 3 hashtags.",
  site: "a short caption for the gallery on the studio website. 1–2 lines.",
};
const MOODS: Record<string, string> = {
  high: "high temp: playful, flirty, dramatic, glamorous.",
  low: "low temp: sincere, soft, a little vulnerable (still witty).",
  gossip: "gossip mode: conspiratorial culture report energy, playful shade, never cruel.",
};

// POST /api/generate-caption
// Body: { topic: string (≤400), character?: "nova"|"vexa", platform?: keyof PLATFORMS, mood?: keyof MOODS,
//         count?: 1-3, sponsored?: boolean, sponsor?: string (≤60) }
// Returns: { captions: string[], model, character, platform }
export default async (req: Request): Promise<Response> => {
  const body = await readJsonBody(req);
  if (body instanceof Response) return body;

  const topic = cleanText(body.topic, 400);
  if (typeof topic !== "string") return json(400, { error: `topic ${topic.error}`, code: "bad_topic" });
  if (!topic) return json(400, { error: "Give Nova something to talk about (topic is required).", code: "missing_topic" });
  const sponsor = cleanText(body.sponsor, 60);
  if (typeof sponsor !== "string") return json(400, { error: `sponsor ${sponsor.error}`, code: "bad_sponsor" });
  const blocked = findBlockedTerm(`${topic} ${sponsor}`);
  if (blocked) {
    return json(400, { error: `Babe, I'm a PG-13 star. "${blocked}" is out of context ✦`, code: "blocked_content" });
  }

  const character = body.character === "vexa" ? "vexa" : "nova";
  const platform = typeof body.platform === "string" && PLATFORMS[body.platform] ? body.platform : "moltbook";
  const mood = typeof body.mood === "string" && MOODS[body.mood] ? body.mood : "high";
  const count = Math.min(3, Math.max(1, Number.isFinite(Number(body.count)) ? Math.round(Number(body.count)) : 3));
  const sponsored = body.sponsored === true;

  const denied = checkPasscode(req);
  if (denied) return denied;
  const key = apiKey();
  if (!key) return json(503, MISSING_KEY);

  const instructions = [
    `Write ${count} distinct caption option(s) for ${PLATFORMS[platform]}`,
    `Mood: ${MOODS[mood]}`,
    `Topic / scene: ${topic}`,
    sponsored
      ? `This is PAID content${sponsor ? ` for ${sponsor}` : ""}. Start the caption with "#ad" and keep claims honest: you're an AI and can't personally use products, so frame it as "my team tested" or keep it comedic.`
      : "This is not sponsored. Do not mention brands.",
    'Respond with ONLY a JSON object: {"captions": ["...", "..."]}. No markdown fences, no commentary.',
  ].join("\n");

  const result = await callXai("/chat/completions", {
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: character === "vexa" ? VEXA_SYSTEM : NOVA_SYSTEM },
      { role: "user", content: instructions },
    ],
    temperature: 0.9,
    max_completion_tokens: 900,
  }, key, 25000);
  if (result instanceof Response) return result;

  const content: string = result.data?.choices?.[0]?.message?.content ?? "";
  let captions: string[] = [];
  try {
    const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const start = cleaned.indexOf("{");
    const parsed = JSON.parse(start >= 0 ? cleaned.slice(start, cleaned.lastIndexOf("}") + 1) : cleaned);
    if (Array.isArray(parsed?.captions)) captions = parsed.captions.filter((c: unknown) => typeof c === "string");
  } catch {
    if (content.trim()) captions = [content.trim()];
  }
  captions = captions.map((c) => c.trim()).filter(Boolean).slice(0, count);
  if (sponsored) captions = captions.map((c) => (/#ad\b/i.test(c) ? c : `#ad ${c}`));
  // Output safety net: drop anything that slipped past the persona rules.
  captions = captions.filter((c) => !findBlockedTerm(c));
  if (!captions.length) return json(502, { error: "Nova blanked (no usable caption came back). Try again.", code: "empty_result" });

  return json(200, { captions, model: TEXT_MODEL, character, platform, mood });
};

export const config: Config = { path: "/api/generate-caption" };
