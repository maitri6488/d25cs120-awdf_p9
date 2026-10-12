const NodeCache = require('node-cache');

// Initialize cache instance with 60 seconds TTL (Step 2 of Practical 9)
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Supplementary Problem 2: Cache hit/miss counters
const cacheStats = {
    hits: 0,
    misses: 0,
    invalidations: 0
};

module.exports = {
    cache,
    cacheStats
};
