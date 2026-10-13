/**
 * Thin Gemini Flash client (REST, no SDK). All AI in this app goes through geminiJson().
 * Structured output is enforced with responseSchema.
 *
 * Free-tier quotas are small (about 20 requests per DAY per model) and tracked per model, so:
 *  - callers batch many items into one request, and
 *  - when a model's daily quota is used up, the next Flash model in the chain is tried.
 * When every model is exhausted a GeminiQuotaError is thrown so callers can stop and retry on the next run
 * (instead of burning retries). A short rate-limit 429 is waited out and retried.
 */
const DEFAULT_CHAIN = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
const MIN_INTERVAL = Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 4000);
let lastCall = 0;
const exhausted = new Set<string>();

export class GeminiQuotaError extends Error {
  constructor(msg = "Gemini daily quota is used up on every configured model") {
    super(msg);
    this.name = "GeminiQuotaError";
  }
}

/** GEMINI_MODELS (comma list) is used as given. Otherwise GEMINI_MODEL goes first, then the default fallbacks. */
export function modelChain(): string[] {
  const list = process.env.GEMINI_MODELS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (list?.length) return list;
  const first = process.env.GEMINI_MODEL?.trim();
  return first ? [first, ...DEFAULT_CHAIN.filter((m) => m !== first)] : DEFAULT_CHAIN;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse "Please retry in 18h32m55.5s" / "retry in 12.3s" into seconds (0 if absent). */
function retrySeconds(body: string): number {
  const m = body.match(/retry in ([\dhms.]+)/i);
  if (!m) return 0;
  const h = /([\d.]+)h/.exec(m[1])?.[1];
  const mi = /([\d.]+)m(?!s)/.exec(m[1])?.[1];
  const s = /([\d.]+)s/.exec(m[1])?.[1];
  return Number(h ?? 0) * 3600 + Number(mi ?? 0) * 60 + Number(s ?? 0);
}

export async function geminiJson<T>(
  prompt: string,
  schema: Record<string, unknown>,
  opts: { system?: string; retries?: number } = {},
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const retries = opts.retries ?? 2;
  let lastErr: unknown;

  for (const model of modelChain()) {
    if (exhausted.has(model)) continue;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const wait = lastCall + MIN_INTERVAL - Date.now();
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();

      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema },
          }),
          signal: AbortSignal.timeout(90_000),
        });
      } catch (err) {
        lastErr = err; // network error or timeout: back off and retry
        await sleep(2000 * 2 ** attempt);
        continue;
      }

      if (res.status === 429) {
        const body = await res.text();
        const secs = retrySeconds(body);
        if (secs > 120 || /per ?day|limit: 0\b/i.test(body)) {
          exhausted.add(model); // daily quota gone: move on to the next model
          lastErr = new Error(`Gemini ${model}: daily quota used up`);
          break;
        }
        lastErr = new Error(`Gemini ${model}: rate limited`);
        await sleep(Math.min(Math.max(secs, 3) * 1000, 60_000));
        continue;
      }
      if (res.status === 404 || res.status === 403) {
        exhausted.add(model); // model not available to this key
        lastErr = new Error(`Gemini ${model}: HTTP ${res.status}`);
        break;
      }
      if (res.status >= 500) {
        lastErr = new Error(`Gemini ${model}: HTTP ${res.status}`);
        await sleep(3000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${model}: HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

      const data: any = await res.json();
      const text: string = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
      if (!text) {
        lastErr = new Error(`Gemini ${model} returned no content (finishReason=${data.candidates?.[0]?.finishReason})`);
        continue;
      }
      try {
        return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
      } catch (err) {
        lastErr = err;
      }
    }
  }

  if (modelChain().every((m) => exhausted.has(m))) throw new GeminiQuotaError();
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
