import { Worker } from "bullmq";
import redis from "./lib/redis.js";

const worker = new Worker(
    "inventory-alerts-queue",
    (async) => {
        // call DB to get shop and product details
        // send email
        // call db for logs
    },
    { connection: redis, concurrency: 20 }
);

worker.on("completed", (job) => {
    console.log(`${job.id} has completed!`);
});

worker.on("failed", (job, err) => {
    console.log(`${job.id} has failed with ${err.message}`);
});
