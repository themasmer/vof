function rateLimit({ windowMs, max, keyGenerator = req => req.ip }) {
    const hits = new Map();

    return (req, res, next) => {
        const now = Date.now();
        const key = keyGenerator(req) || 'anonymous';
        const entry = hits.get(key);
        const current = !entry || entry.resetAt <= now ? { count: 0, resetAt: now + windowMs } : entry;
        current.count += 1;
        hits.set(key, current);

        res.set('RateLimit-Limit', String(max));
        res.set('RateLimit-Remaining', String(Math.max(0, max - current.count)));
        if (current.count > max) {
            res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
            return res.status(429).json({ message: 'Too many requests. Please try again later.' });
        }
        next();
    };
}

module.exports = rateLimit;
