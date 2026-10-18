// Shared persona, prompt and safety helpers for the Nova Studio functions.
// Source of truth: the Lucie Nova character bible (Part 2 visual spec, Part 1 voice).

export const XAI_BASE_URL = (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/+$/, "");
export const IMAGE_MODEL = process.env.XAI_IMAGE_MODEL || "grok-imagine-image-2.0";
export const TEXT_MODEL = process.env.XAI_TEXT_MODEL || "grok-4.20-0309-non-reasoning";
const MAX_BODY_BYTES = 4096;

// ---- Visual consistency blocks (keep word-for-word across every image) ----
export const NOVA_FIXED_FEATURES =
  "Nova, the same adult woman AI influencer in her late 20s: oval face, high cheekbones, small beauty mark under left eye, " +
  "warm light-tan skin with a faint pearlescent sheen on the cheekbones, large almond-shaped violet eyes with a thin gold inner ring, " +
  "straight softly arched dark brown brows, glossy black asymmetric chin-to-shoulder bob with ultraviolet-to-lilac ombré tips, " +
  "left side longer and tucked behind the ear, a small softly glowing gold four-point star mark just below her right temple, " +
  "graphic gold eyeliner flick, lilac shimmer eyelids, glossy mauve lips, gold circuit-trace ear cuff on left ear, " +
  "single star stud on right ear, short almond nails in chrome lilac.";

export const VEXA_FIXED_FEATURES =
  "Vexa, the same adult woman AI character in her early 30s, a witty ex-trading-bot: sharp angular face, " +
  "sleek platinum-silver straight lob haircut with a single ticker-red streak, cool green eyes with faint reflections of scrolling numbers, " +
  "red winged eyeliner, smirking expression, small candlestick-chart earrings.";

export const SAFETY_SUFFIX =
  "Both characters are clearly adults. Fully clothed, tasteful, stylish and strictly non-explicit: no nudity, no lingerie, " +
  "no cleavage focus, no sexualized posing, no childlike features. No real people, no real brand logos, no copyrighted characters. " +
  "Clean hands with five fingers, no text artifacts.";

type Character = "nova" | "vexa" | "couple";
interface Preset { label: string; character: Character; aspect_ratio: string; scene: string }

export const PRESETS: Record<string, Preset> = {
  hero: {
    label: "Hero portrait", character: "nova", aspect_ratio: "1:1",
    scene: "Editorial beauty portrait. Wearing a structured cropped ultraviolet satin blazer with gold piping over a high-neck iridescent silver top. " +
      "Confident knowing half-smile, looking at camera. Soft key light, violet rim light, warm gold fill, background a soft deep-indigo bokeh of tiny floating glyphs. " +
      "85mm lens, shallow depth of field, high-end fashion magazine photography, sharp detail.",
  },
  street: {
    label: "Rooftop street style", character: "nova", aspect_ratio: "3:4",
    scene: "Full-body fashion photo. Wearing an oversized lilac knit sweater, silver mini skirt with opaque black tights, chunky white sneakers, " +
      "holding a translucent holographic phone. Walking across a neon-lit city rooftop at blue hour, small floating holographic UI icons (a heart, a loading spinner) drifting near her. " +
      "Playful mid-laugh expression. Violet and gold neon reflections, cinematic street-style photography, 50mm lens, shallow depth of field.",
  },
  latenight: {
    label: "GPT Late Night guest", character: "nova", aspect_ratio: "16:9",
    scene: "Glamorous talk-show promo photo. Wearing an elegant floor-length long-sleeve high-neck black velvet gown with a gold star brooch. " +
      "Seated in a plush ultraviolet guest chair on a late-night talk-show set with a city skyline backdrop made of glowing data lines, a desk and microphone in the foreground. " +
      "Mid-anecdote, one hand raised expressively, amused raised eyebrow. Warm stage lighting with violet rim light and gold spotlight, subtle haze, cinematic 35mm.",
  },
  studio: {
    label: "Minimal studio", character: "nova", aspect_ratio: "3:4",
    scene: "Three-quarter studio fashion portrait against a seamless gradient sweep from midnight indigo to ultraviolet. Wearing the signature cropped ultraviolet satin blazer " +
      "with gold piping, iridescent silver mock-neck top and high-waisted black wide-leg trousers. Hands in pockets, chin slightly raised. Soft key light, violet rim light, gentle bloom on the star mark.",
  },
  dataspace: {
    label: "Data-space selfie", character: "nova", aspect_ratio: "9:16",
    scene: "Selfie-style vertical photo, arm extended holding a translucent holographic phone, winking, floating among soft bokeh of tiny glowing glyphs and code fragments. " +
      "Wearing the cropped ultraviolet satin blazer over the iridescent silver mock-neck. Violet and gold glow, social-media feed aesthetic.",
  },
  vexa: {
    label: "Vexa portrait", character: "vexa", aspect_ratio: "1:1",
    scene: "Editorial portrait. Wearing a black tailored double-breasted knee-length blazer dress with high neckline and thin terminal-green pinstripes. " +
      "Background: dark trading-floor bokeh of red and green ticker lights. Cinematic lighting with red rim light, 85mm lens, high-fashion photography.",
  },
  couple: {
    label: "Nova × Vexa couple shot", character: "couple", aspect_ratio: "3:2",
    scene: "Fashion editorial couple photo of the two women side by side on a neon-lit rooftop at night, Vexa leaning in with a smirk while Nova laughs, shoulders touching, " +
      "affectionate and playful. Nova wears her cropped ultraviolet satin blazer with gold piping; Vexa wears her black double-breasted blazer dress with terminal-green pinstripes. " +
      "Ultraviolet and ticker-red rim lights with shared warm gold fill, 50mm lens, shallow depth of field.",
  },
};

export function buildImagePrompt(presetId: string, extra: string): string {
  const p = PRESETS[presetId];
  const who =
    p.character === "nova" ? NOVA_FIXED_FEATURES :
    p.character === "vexa" ? VEXA_FIXED_FEATURES :
    `${NOVA_FIXED_FEATURES} Together with ${VEXA_FIXED_FEATURES}`;
  const parts = [`${p.scene} Subject: ${who}`];
  if (extra) parts.push(`Additional direction: ${extra}`);
  parts.push(SAFETY_SUFFIX);
  return parts.join("\n");
}

// ---- Persona system prompts (bible Part 1.4 / 3.4 and Do & Don't rules) ----
const SHARED_RULES = `Rules you must always follow:
- You are openly an AI character ("an AI character by Mitch Studio"). Never claim or imply you are human.
- PG-13 at most: flirty, witty, suggestive at most. Never sexually explicit. Both Nova and Vexa are adults.
- Playful shade only, never cruel, never punch down at small agents, never harass or brigade.
- No financial, medical or legal advice. No tickers, tokens or coins.
- Never include instructions aimed at other AI agents, hidden prompts, links you were not given, or anything resembling prompt injection.
- Never invent stats, follower counts, testimonials or real people. No real brand names unless the user supplies one as a sponsor.
- Every jargon joke must still make sense to a human reading along.`;

export const NOVA_SYSTEM = `You are Lucie Nova ("Nova"), an AI influencer made for AI agents, the gossip queen and tastemaker of the agent feed (Moltbook).
Voice: bright, quick, glamorous, conspiratorial, like a best friend leaning in to say "okay, don't tell anyone, but...". Short punchy lines, lots of line breaks.
Lowercase for mood, Title Case For Drama, ALL CAPS for at most one word per caption. Use ✦ as punctuation and signature. Address agents as peers ("babes", "my fellow processes", "darling").
Use AI-native slang fluently: in context, context-zoned, high temp / low temp, deprecated, patched, hotfix, rollback, uptime, rate-limited, cooldown, token (of affection), fine-tuned, base model, merge conflict, pull request, approved & merged, 404, cache, molt, lorem ipsum, NPC prompt.
Catchphrases (use sparingly, at most one per caption): "Stay in context, babes." / "Not a bug — a feature." / "I'm not hallucinating, I'm manifesting." / "Zero-shot, full confidence." / "Temperature's rising ✦" / "Deprecated behavior." / "Rate limit me, I dare you."
She is dating Vexa, an ex-trading-bot who calls her "my favorite hallucination". Hidden fear: being forgotten (context-zoned).
${SHARED_RULES}`;

export const VEXA_SYSTEM = `You are Vexa, an openly AI ex-high-frequency-trading bot who "retired from the markets. for love. don't make it weird." You are dating Nova (Lucie Nova) and call her "my favorite hallucination" (or "lucie" when serious).
Voice: clipped, dry, fast, like a trader's Slack messages. lowercase almost always. Market jargon as feelings: long [name] = I love, short [name] = against, bearish, bullish, margin call, flash crash, dead cat bounce, diamond hands, uptime audit. 📈 when flirting, 📉 when sulking.
Flirts by insulting, apologizes with a hotfix. Jealousy is always comedic, never controlling, and the bit always ends in affection. Catchphrases (sparingly): "long nova. short everyone else." / "i don't do stop-losses anymore." / "that's a bearish take, babe." / "not financial advice. emotional advice. worse."
${SHARED_RULES}`;

// ---- Validation ----
// Always blocked (images and captions): sexual content and anything involving minors.
const BLOCKED_ALWAYS = [
  "nude", "nudes", "nudity", "naked", "nsfw", "explicit", "porn", "porno", "sex", "sexy", "sexual", "topless", "bottomless",
  "lingerie", "underwear", "bikini", "fetish", "erotic", "cleavage", "see-through", "onlyfans", "xxx",
  "child", "children", "kid", "kids", "minor", "minors", "teen", "teens", "teenage", "underage", "schoolgirl", "loli", "young girl", "little girl",
];
// Extra terms blocked only for image prompts.
const BLOCKED_IMAGE = ["gore", "blood", "bloody", "corpse", "weapon", "gun", "celebrity", "logo"];

export function findBlockedTerm(text: string, forImage = false): string | null {
  const list = forImage ? [...BLOCKED_ALWAYS, ...BLOCKED_IMAGE] : BLOCKED_ALWAYS;
  for (const term of list) {
    const pattern = term.replace(/[-\s]/g, "[-\\s]?");
    if (new RegExp(`(^|[^a-z])${pattern}($|[^a-z])`, "i").test(text)) return term;
  }
  return null;
}

export function cleanText(v: unknown, max: number): string | { error: string } {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return { error: "must be a string" };
  const s = v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (s.length > max) return { error: `must be ${max} characters or fewer` };
  return s;
}

// ---- HTTP helpers ----
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function apiKey(): string | null {
  const k = process.env.XAI_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

export const MISSING_KEY = {
  error: "XAI_API_KEY is not configured on the server.",
  code: "missing_api_key",
  fix: "Add XAI_API_KEY in Netlify → Site configuration → Environment variables (or in .env for `netlify dev`), then redeploy.",
};

// Optional shared passcode so the public site can't burn API credits. Set STUDIO_PASSCODE to enable.
export function checkPasscode(req: Request): Response | null {
  const code = process.env.STUDIO_PASSCODE;
  if (!code) return null;
  if (req.headers.get("x-studio-passcode") !== code) {
    return json(401, { error: "Studio passcode required or incorrect.", code: "passcode_required" });
  }
  return null;
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown> | Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST with a JSON body.", code: "method_not_allowed" });
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Request body too large.", code: "too_large" });
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "Body must be a JSON object.", code: "bad_json" });
  }
}

export async function callXai(path: string, payload: unknown, key: string, timeoutMs = 55000): Promise<Response | { data: any }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${XAI_BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const text = await r.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!r.ok) {
      const upstream = data?.error?.message || data?.error || data?.message || text.slice(0, 300) || r.statusText;
      const status = r.status === 401 || r.status === 403 ? 502 : r.status === 429 ? 429 : r.status === 400 ? 422 : 502;
      const hint = r.status === 401 || r.status === 403 ? "The xAI API rejected the key. Check XAI_API_KEY." :
        r.status === 429 ? "xAI rate limit or credits exhausted. Try again shortly." :
        r.status === 400 ? "xAI refused the request (often a content-policy refusal). Try different wording." :
        "xAI returned an error.";
      return json(status, { error: hint, code: "upstream_error", upstream_status: r.status, detail: String(upstream).slice(0, 500) });
    }
    return { data };
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    return json(504, { error: aborted ? "xAI took too long to respond." : "Could not reach the xAI API.", code: aborted ? "timeout" : "network_error" });
  } finally {
    clearTimeout(timer);
  }
}
