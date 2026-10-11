import { config } from "dotenv";

// Local runs read .env.local then .env. In GitHub Actions the variables come from secrets.
config({ path: ".env.local" });
config();
