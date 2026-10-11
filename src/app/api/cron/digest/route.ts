import { NextResponse } from "next/server";
import { runDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron-compatible endpoint (optional alternative to the GitHub Actions workflow).
 * Vercel sends "Authorization: Bearer $CRON_SECRET". Add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/digest", "schedule": "30 1 * * 1" }] }   // Monday 07:00 IST
 * runDigest skips if a digest was already sent in the last 5 days, so running both is safe.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await runDigest({ force });
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
