import type { Config } from "@netlify/functions";
import {
  PRESETS, IMAGE_MODEL, buildImagePrompt, findBlockedTerm, cleanText, json, apiKey, MISSING_KEY,
  checkPasscode, readJsonBody, callXai,
} from "../lib/nova.mts";

// POST /api/generate-image
// Body: { preset: "hero" | "street" | ..., extra?: string (≤300 chars), resolution?: "1k" | "2k" }
// Returns: { image: "data:image/...;base64,..." | "https://...", prompt, preset, model, aspect_ratio }
export default async (req: Request): Promise<Response> => {
  if (req.method === "GET") {
    return json(200, {
      presets: Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, character: p.character, aspect_ratio: p.aspect_ratio })),
      configured: Boolean(apiKey()),
      passcode_required: Boolean(process.env.STUDIO_PASSCODE),
      model: IMAGE_MODEL,
    });
  }

  const body = await readJsonBody(req);
  if (body instanceof Response) return body;

  const presetId = typeof body.preset === "string" ? body.preset : "hero";
  if (!PRESETS[presetId]) {
    return json(400, { error: `Unknown preset "${presetId}".`, code: "bad_preset", presets: Object.keys(PRESETS) });
  }
  const extra = cleanText(body.extra, 300);
  if (typeof extra !== "string") return json(400, { error: `extra ${extra.error}`, code: "bad_extra" });
  const blocked = findBlockedTerm(extra, true);
  if (blocked) {
    return json(400, {
      error: `Nova is a PG-13 star. "${blocked}" isn't allowed in image directions. Keep it in context ✦`,
      code: "blocked_content",
    });
  }
  const resolution = body.resolution === "2k" ? "2k" : "1k";

  const denied = checkPasscode(req);
  if (denied) return denied;
  const key = apiKey();
  if (!key) return json(503, MISSING_KEY);

  const preset = PRESETS[presetId];
  const prompt = buildImagePrompt(presetId, extra);
  const result = await callXai("/images/generations", {
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    aspect_ratio: preset.aspect_ratio,
    resolution,
    response_format: "b64_json",
  }, key);
  if (result instanceof Response) return result;

  const item = result.data?.data?.[0];
  let image: string | null = null;
  if (item?.b64_json) {
    const mime = typeof item.mime_type === "string" ? item.mime_type : "image/jpeg";
    image = `data:${mime};base64,${item.b64_json}`;
  } else if (typeof item?.url === "string") {
    image = item.url;
  }
  if (!image) return json(502, { error: "xAI returned no image.", code: "empty_result" });

  return json(200, {
    image,
    preset: presetId,
    aspect_ratio: preset.aspect_ratio,
    model: IMAGE_MODEL,
    prompt,
    revised_prompt: item?.revised_prompt ?? null,
  });
};

export const config: Config = { path: "/api/generate-image" };
