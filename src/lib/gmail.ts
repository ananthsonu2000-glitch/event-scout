/** Minimal Gmail REST client (OAuth refresh-token flow). Needs gmail.readonly + gmail.send scopes. */

let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 30_000) return cached.token;
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN are not all set");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function gmail<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Gmail API ${path.split("?")[0]} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export interface MailMessage {
  id: string;
  from: string;
  subject: string;
  date: Date | null;
  html: string;
  text: string;
}

export async function searchMessageIds(q: string, max = 50): Promise<string[]> {
  const data = await gmail<{ messages?: { id: string }[] }>(`messages?q=${encodeURIComponent(q)}&maxResults=${max}`);
  return (data.messages ?? []).map((m) => m.id);
}

export async function getMessage(id: string): Promise<MailMessage> {
  const m = await gmail<any>(`messages/${id}?format=full`);
  const header = (n: string): string => m.payload?.headers?.find((h: any) => h.name.toLowerCase() === n)?.value ?? "";
  let html = "";
  let text = "";
  const walk = (part: any) => {
    if (!part) return;
    const data = part.body?.data ? Buffer.from(part.body.data, "base64url").toString("utf8") : "";
    if (part.mimeType === "text/html") html += data;
    else if (part.mimeType === "text/plain") text += data;
    (part.parts ?? []).forEach(walk);
  };
  walk(m.payload);
  const d = header("date") ? new Date(header("date")) : null;
  return {
    id,
    from: header("from"),
    subject: header("subject"),
    date: d && !Number.isNaN(d.getTime()) ? d : null,
    html,
    text,
  };
}

export async function sendGmail(opts: { from: string; to: string; subject: string; html: string; text: string }) {
  const boundary = `scout_${Date.now()}`;
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  const raw = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(opts.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(opts.html),
    `--${boundary}--`,
  ].join("\r\n");
  await gmail("messages/send", { method: "POST", body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }) });
}
