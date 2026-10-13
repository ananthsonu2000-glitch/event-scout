import { neon } from "@neondatabase/serverless";

type Client = ReturnType<typeof neon>;
let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

/** Network blips and a waking-up Neon compute surface as "fetch failed" or a connection error. Worth retrying. */
const isTransient = (err: unknown) => /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|Error connecting|timeout/i.test(String((err as any)?.message ?? err) + String((err as any)?.sourceError?.message ?? ""));

/** Run a parameterised query ($1, $2, ...) and return rows. Retries transient connection errors a few times. */
export async function query<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const rows = await getClient().query(text, params as any[]);
      return rows as unknown as T[];
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err; // a real SQL error: don't retry
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr;
}
