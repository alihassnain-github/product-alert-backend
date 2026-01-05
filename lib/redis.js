import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL, { maxLoadingRetryTime: null });

export default redis;
