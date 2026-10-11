/**
 * One-time helper: obtains a Gmail refresh token and saves the three GMAIL_* values to .env.local.
 * Prereq: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env.local (OAuth client of type "Desktop app").
 * Run: npm run gmail:auth   → open the printed URL, approve, done.
 */
import "./load-env";
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}`;
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"];

const id = process.env.GMAIL_CLIENT_ID;
const secret = process.env.GMAIL_CLIENT_SECRET;
if (!id || !secret) {
  console.error("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env.local first.");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: id,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // forces a refresh token to be issued
  });

function save(key: string, value: string) {
  const file = ".env.local";
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  writeFileSync(file, re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.replace(/\n?$/, "\n")}${key}=${value}\n`);
}

const server = createServer(async (req, res) => {
  const code = new URL(req.url ?? "/", REDIRECT).searchParams.get("code");
  if (!code) {
    res.end("Waiting for Google redirect…");
    return;
  }
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
    });
    const data: any = await r.json();
    if (!data.refresh_token) throw new Error(`No refresh token returned: ${JSON.stringify(data)}`);
    save("GMAIL_REFRESH_TOKEN", data.refresh_token);
    res.end("Done. You can close this tab and return to the terminal.");
    console.log("Saved GMAIL_REFRESH_TOKEN to .env.local (also add it to GitHub secrets for Actions).");
  } catch (err) {
    res.end("Failed, see terminal.");
    console.error(err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Open this URL in your browser and approve access:\n\n" + authUrl + "\n");
});
