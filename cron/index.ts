import "dotenv/config";
import jobs from "./jobs/index.js";

for (const job of jobs) {
  job.cronJob.start();
}
