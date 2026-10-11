import "./load-env";
import { writeFileSync } from "node:fs";
import { runDigest } from "../src/lib/digest";

const args = process.argv.slice(2);
const force = args.includes("--force") || process.env.FORCE_DIGEST === "true";
const dryRun = args.includes("--dry-run");

runDigest({ force, dryRun })
  .then((r) => {
    if (r.html) {
      writeFileSync("digest-preview.html", r.html);
      console.log("Wrote digest-preview.html");
    }
    console.log(`Digest: ${r.status}${r.detail ? ` (${r.detail})` : ""}`);
    if (r.status === "failed") process.exit(1); // surface send failures in the Actions run (also logged in digest_runs)
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
