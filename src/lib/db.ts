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

/** Run a parameterised query ($1, $2, ...) and return rows. */
export async function query<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await getClient().query(text, params as any[]);
  return rows as unknown as T[];
}
