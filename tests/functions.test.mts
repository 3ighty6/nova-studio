// Unit tests for the Netlify functions with a mocked xAI API (no network, no key needed).
// Run: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import generateImage from "../netlify/functions/generate-image.mts";
import generateCaption from "../netlify/functions/generate-caption.mts";

const realFetch = globalThis.fetch;
let calls: { url: string; body: any; auth: string | null }[] = [];

function mockXai(handler: (url: string, body: any) => { status?: number; json: unknown }) {
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, auth: new Headers(init.headers).get("authorization") });
    const r = handler(url, body);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

beforeEach(() => {
  calls = [];
  globalThis.fetch = realFetch;
  process.env.XAI_API_KEY = "test-key";
  delete process.env.STUDIO_PASSCODE;
});

test("image: missing key returns 503 with setup hint", async () => {
  delete process.env.XAI_API_KEY;
  const r = await generateImage(post("/api/generate-image", { preset: "hero" }));
  assert.equal(r.status, 503);
  const j = await r.json();
  assert.equal(j.code, "missing_api_key");
  assert.match(j.fix, /XAI_API_KEY/);
});

test("image: GET lists presets and config state", async () => {
  const r = await generateImage(new Request("http://localhost/api/generate-image"));
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.ok(j.presets.find((p: any) => p.id === "couple"));
  assert.equal(j.configured, true);
});

test("image: builds prompt with fixed features + safety rule and returns data URI", async () => {
  mockXai(() => ({ json: { data: [{ b64_json: "AAAA", mime_type: "image/jpeg" }] } }));
  const r = await generateImage(post("/api/generate-image", { preset: "latenight", extra: "holding a gold trophy" }));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.image, "data:image/jpeg;base64,AAAA");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/v1\/images\/generations$/);
  assert.equal(calls[0].auth, "Bearer test-key");
  assert.equal(calls[0].body.model, "grok-imagine-image-2.0");
  assert.equal(calls[0].body.aspect_ratio, "16:9");
  assert.match(calls[0].body.prompt, /violet eyes with a thin gold inner ring/);
  assert.match(calls[0].body.prompt, /holding a gold trophy/);
  assert.match(calls[0].body.prompt, /strictly non-explicit/);
});

test("image: rejects unknown preset, long extra, and explicit terms without calling xAI", async () => {
  mockXai(() => ({ json: {} }));
  assert.equal((await generateImage(post("/api/generate-image", { preset: "nope" }))).status, 400);
  assert.equal((await generateImage(post("/api/generate-image", { preset: "hero", extra: "x".repeat(301) }))).status, 400);
  const r = await generateImage(post("/api/generate-image", { preset: "hero", extra: "make her NUDE" }));
  assert.equal(r.status, 400);
  assert.equal((await r.json()).code, "blocked_content");
  assert.equal((await generateImage(post("/api/generate-image", { preset: "hero", extra: "a teenage look" }))).status, 400);
  assert.equal(calls.length, 0);
});

test("image: no false positives on normal words", async () => {
  mockXai(() => ({ json: { data: [{ url: "https://img.example/x.jpg" }] } }));
  const r = await generateImage(post("/api/generate-image", { preset: "hero", extra: "kidding around, comic-strip confetti, Essex skyline" }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).image, "https://img.example/x.jpg");
});

test("image: upstream errors are surfaced clearly", async () => {
  mockXai(() => ({ status: 401, json: { error: "Incorrect API key" } }));
  const r = await generateImage(post("/api/generate-image", { preset: "hero" }));
  assert.equal(r.status, 502);
  const j = await r.json();
  assert.equal(j.upstream_status, 401);
  assert.match(j.error, /rejected the key/);
});

test("passcode gate blocks requests when STUDIO_PASSCODE is set", async () => {
  process.env.STUDIO_PASSCODE = "starlight";
  mockXai(() => ({ json: { data: [{ b64_json: "AA" }] } }));
  assert.equal((await generateImage(post("/api/generate-image", { preset: "hero" }))).status, 401);
  assert.equal((await generateImage(post("/api/generate-image", { preset: "hero" }, { "x-studio-passcode": "starlight" }))).status, 200);
});

test("method and body validation", async () => {
  const put = new Request("http://localhost/api/generate-caption", { method: "PUT", body: "{}" });
  assert.equal((await generateCaption(put)).status, 405);
  const bad = new Request("http://localhost/api/generate-caption", { method: "POST", body: "not json" });
  assert.equal((await generateCaption(bad)).status, 400);
  const big = new Request("http://localhost/api/generate-caption", { method: "POST", body: JSON.stringify({ topic: "x".repeat(5000) }) });
  assert.equal((await generateCaption(big)).status, 413);
});

test("caption: missing key and missing topic", async () => {
  assert.equal((await generateCaption(post("/api/generate-caption", {}))).status, 400);
  delete process.env.XAI_API_KEY;
  const r = await generateCaption(post("/api/generate-caption", { topic: "new look" }));
  assert.equal(r.status, 503);
});

test("caption: uses Nova system prompt, parses JSON, enforces #ad when sponsored", async () => {
  mockXai(() => ({ json: { choices: [{ message: { content: '```json\n{"captions":["new look ✦ stay in context, babes","rooftop era ✦"]}\n```' } }] } }));
  const r = await generateCaption(post("/api/generate-caption", { topic: "rooftop look", count: 2, sponsored: true, sponsor: "Acme Render" }));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.captions.length, 2);
  assert.ok(j.captions.every((c: string) => c.startsWith("#ad")));
  assert.match(calls[0].url, /\/v1\/chat\/completions$/);
  assert.match(calls[0].body.messages[0].content, /You are Lucie Nova/);
  assert.match(calls[0].body.messages[0].content, /Never sexually explicit/);
  assert.match(calls[0].body.messages[1].content, /Acme Render/);
});

test("caption: Vexa voice and blocked topic", async () => {
  mockXai(() => ({ json: { choices: [{ message: { content: '{"captions":["long nova. short everyone else. 📈"]}' } }] } }));
  const r = await generateCaption(post("/api/generate-caption", { topic: "date night", character: "vexa", count: 1 }));
  assert.equal(r.status, 200);
  assert.match(calls[0].body.messages[0].content, /You are Vexa/);
  const b = await generateCaption(post("/api/generate-caption", { topic: "something nsfw" }));
  assert.equal(b.status, 400);
});
