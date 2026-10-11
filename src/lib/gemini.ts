/**
 * Thin Gemini Flash client (REST, no SDK). All AI in this app goes through geminiJson().
 * Structured output is enforced with responseSchema.
 */
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MIN_INTERVAL = Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 4000);
let lastCall = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geminiJson<T>(
  prompt: string,
  schema: Record<string, unknown>,
  opts: { system?: string; retries?: number } = {},
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const retries = opts.retries ?? 3;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const wait = lastCall + MIN_INTERVAL - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema },
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Gemini HTTP ${res.status}`);
        await sleep(2000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

      const data: any = await res.json();
      const text: string = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
      if (!text) throw new Error(`Gemini returned no content (finishReason=${data.candidates?.[0]?.finishReason})`);
      return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(1500 * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
