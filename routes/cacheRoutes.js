const express = require('express');
const router = express.Router();
const { cache, cacheStats } = require('../cache/cache');
const Task = require('../models/Task');

// GET /api/cache-stats - Supplementary Problem 2: Debug stats endpoint
router.get('/cache-stats', (req, res) => {
    const totalRequests = cacheStats.hits + cacheStats.misses;
    const hitRate = totalRequests > 0 
        ? ((cacheStats.hits / totalRequests) * 100).toFixed(1) + '%' 
        : '0%';

    res.status(200).json({
        success: true,
        summary: {
            hits: cacheStats.hits,
            misses: cacheStats.misses,
            invalidations: cacheStats.invalidations,
            totalRequests,
            hitRate
        },
        cachedKeys: cache.keys(),
        nodeCacheStats: cache.getStats()
    });
});

// POST /api/cache-clear - Manual cache invalidation test
router.post('/cache-clear', (req, res) => {
    cache.flushAll();
    res.status(200).json({
        success: true,
        message: 'All in-memory cache keys flushed successfully'
    });
});

// POST /api/seed-tasks - Seed sample tasks to demonstrate cache response time differences
router.post('/seed-tasks', async (req, res, next) => {
    try {
        const sampleTasks = [
            { title: 'Complete AWDF Practical 9 Caching', description: 'Implement node-cache on GET /tasks', priority: 'high', completed: true },
            { title: 'Benchmark API Response Times', description: 'Measure cached vs uncached response times', priority: 'high', completed: false },
            { title: 'Test Cache Invalidation on POST', description: 'Ensure cache.del is triggered', priority: 'medium', completed: false },
            { title: 'Test Cache Invalidation on PUT', description: 'Ensure updated tasks do not serve stale data', priority: 'medium', completed: false },
            { title: 'Test Cache Invalidation on DELETE', description: 'Ensure deleted tasks are evicted', priority: 'low', completed: false },
            { title: 'Record Viva Questions & Observations', description: 'Document in lab journal README', priority: 'medium', completed: false }
        ];

        let count = sampleTasks.length;
        if (require('mongoose').connection.readyState === 1) {
            await Task.deleteMany({});
            const inserted = await Task.insertMany(sampleTasks);
            count = inserted.length;
        }

        cache.flushAll(); // Reset cache

        res.status(201).json({
            success: true,
            message: `Seeded ${count} sample tasks successfully. Cache flushed.`,
            tasks: sampleTasks
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
