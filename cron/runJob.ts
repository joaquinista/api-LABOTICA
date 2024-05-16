import "dotenv/config";
import prompts from "prompts";
import jobs from "./jobs/index.js";

const jobName = await prompts({
  type: "select",
  name: "value",
  message: "Select a job to run",
  choices: jobs.map((job) => ({
    title: job.name,
    value: job.name,
  })),
});

const job = jobs.find((job) => job.name === jobName.value);

if (!job) {
  console.log("Job not found");
  process.exit(1);
}

job.run();
