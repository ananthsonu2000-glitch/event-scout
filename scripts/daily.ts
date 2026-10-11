import "./load-env";
import { runDaily } from "../src/lib/pipeline/run";

runDaily()
  .then((r) => {
    console.log("Daily run complete", JSON.stringify(r));
    // Individual scraper failures are logged in scraper_runs and do not fail the job.
  })
  .catch((err) => {
    console.error("Daily run crashed", err);
    process.exit(1);
  });
