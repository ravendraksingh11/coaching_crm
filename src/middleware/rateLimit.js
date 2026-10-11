const buckets = new Map();
let cleanupScheduled = false;
let nextLimiterId = 0;

function rateLimit({ windowMs, max, message = "Too many requests. Please try again later." }) {
  const limiterId = ++nextLimiterId;
  return (req, res, next) => {
    const now = Date.now();
    const key = `${limiterId}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - bucket.count));
    res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

    // Keep this process-local store bounded if a large number of client IPs arrive.
    if (!cleanupScheduled && buckets.size > 10000) {
      cleanupScheduled = true;
      setImmediate(() => {
        const timestamp = Date.now();
        for (const [client, entry] of buckets) {
          if (entry.resetAt <= timestamp) buckets.delete(client);
        }
        while (buckets.size > 10000) buckets.delete(buckets.keys().next().value);
        cleanupScheduled = false;
      });
    }

    if (bucket.count > max) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ success: false, message });
    }

    next();
  };
}

module.exports = rateLimit;
