# Nova Studio ✦

The studio site for **Lucie Nova ("Nova")**, an openly AI influencer made for AI agents, and her partner **Vexa**.
An AI character project by Mitch Studio.

- `public/index.html`: the studio page (hero, bio, gallery, Grok image generator, caption generator, six revenue streams, waitlist, AI disclosure). Plain HTML/CSS/JS, no build step.
- `netlify/functions/generate-image.mts`: `POST /api/generate-image` → xAI **Grok Imagine** (`/v1/images/generations`).
- `netlify/functions/generate-caption.mts`: `POST /api/generate-caption` → xAI chat completions with Nova's (or Vexa's) system prompt.
- `netlify/lib/nova.mts`: persona prompts, the fixed-feature prompt blocks (from the character bible, kept word-for-word for consistency), scene presets, the safety suffix, validation and error helpers.
- `public/images/`: starter gallery assets (Nova and Vexa hero portraits, AI-generated).

Hosting: **Netlify** (static `public/` + Netlify Functions v2).

## How generation works

1. The page sends a **preset id** (`hero`, `street`, `latenight`, `studio`, `dataspace`, `vexa`, `couple`) and optional extra direction (≤300 chars).
2. The server builds the prompt: scene + **fixed-feature block** (Nova's face, violet/gold eyes, ombré bob, ✦ mark, etc.) + extra direction + a **non-explicit safety rule** that is always appended.
3. Inputs are validated (type, length, body size ≤4 KB) and checked against a blocklist (explicit terms, anything involving minors, gore, real logos/celebrities). Blocked requests never reach xAI.
4. The image comes back as base64 (`response_format: b64_json`) so it can be downloaded. **Nothing is stored server-side**; generated images live in the browser session gallery until downloaded.

Captions: `topic`, `character` (`nova`|`vexa`), `platform` (`moltbook`|`x`|`instagram`|`site`), `mood` (`high`|`low`|`gossip`), `count` (1–3), `sponsored` + `sponsor`. Sponsored captions are always forced to include `#ad`.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `XAI_API_KEY` | **yes** | xAI API key from https://console.x.ai. Without it, both endpoints return `503 {"code":"missing_api_key"}` with a setup hint. |
| `STUDIO_PASSCODE` | recommended | If set, the API requires header `x-studio-passcode`. The page shows a passcode field. Stops strangers spending your credits. |
| `XAI_IMAGE_MODEL` | no | Default `grok-imagine-image-2.0`. |
| `XAI_TEXT_MODEL` | no | Default `grok-4.20-0309-non-reasoning` (fast, cheap for captions). `grok-4.7` also works. |
| `XAI_BASE_URL` | no | Default `https://api.x.ai/v1`. Point at a mock for testing. |

Copy `.env.example` to `.env` for local dev. Never commit a real key.

## Local development

```bash
npm install
npm install -g netlify-cli      # or use npx netlify
cp .env.example .env            # add XAI_API_KEY
netlify dev                     # http://localhost:8888
```

Tests (mocked xAI, no key or network needed):

```bash
npm test
```

## Deploy (Netlify)

1. In Netlify: **Add new site → Import from Git →** `3ighty6/nova-studio`. Build command: none. Publish directory: `public` (already set in `netlify.toml`).
2. **Site configuration → Environment variables:** add `XAI_API_KEY` (and ideally `STUDIO_PASSCODE`). Scope it to Functions.
3. Deploy. Check `GET /api/generate-image`: it returns `"configured": true` once the key is picked up.
4. The waitlist form uses **Netlify Forms** (`data-netlify="true"`). Enable form detection in the Netlify UI if it's off; submissions show under **Forms**.

## Placeholders to fill in before launch

- `mailto:hello@example.com` on the Brand deals and Licensing CTAs → real business inbox.
- "Nova's Picks" CTA → the real picks page once affiliate programs are joined.
- Revenue-stream prices are hypotheses from the character bible; adjust after testing.
- Paid DM chat is listed as an 18+ beta waitlist only. It needs legal review, age gating and a privacy policy before it ships.

## Content rules (enforced in prompts and validation)

Openly AI, always. PG-13 maximum, never sexually explicit, both characters are adults. No financial/medical/legal advice. No real people, real logos or copyrighted characters. Paid content always labeled `#ad`. Captions never contain instructions aimed at other agents.
