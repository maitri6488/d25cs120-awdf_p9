const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const { cache, cacheStats } = require('../cache/cache');

// In-memory fallback list used if MongoDB daemon is offline
let fallbackTasks = [
    { _id: '66f8e0a123456789abcdef01', title: 'Complete AWDF Practical 9 Caching', description: 'Implement node-cache on GET /tasks', priority: 'high', completed: true, createdAt: new Date() },
    { _id: '66f8e0a123456789abcdef02', title: 'Benchmark API Response Times', description: 'Measure cached vs uncached response times', priority: 'high', completed: false, createdAt: new Date() },
    { _id: '66f8e0a123456789abcdef03', title: 'Test Cache Invalidation on POST', description: 'Ensure cache.del is triggered', priority: 'medium', completed: false, createdAt: new Date() }
];

// Helper: Fetch tasks from MongoDB (or fallback with simulated DB latency)
async function getTasksFromDatabase() {
    if (mongoose.connection.readyState === 1) {
        return await Task.find().sort({ createdAt: -1 });
    }
    // Simulate DB query delay (~40ms) when local DB is offline
    await new Promise(r => setTimeout(r, 40));
    return fallbackTasks;
}

// 1. GET /tasks - Fetch all tasks with In-Memory Caching (node-cache)
router.get('/', async (req, res, next) => {
    try {
        const bypass = req.query.bypass === 'true';

        // Step 3: Check cache first unless explicitly bypassed
        if (!bypass) {
            const cached = cache.get('all_tasks');
            if (cached) {
                cacheStats.hits++;
                res.setHeader('X-Cache', 'HIT');
                return res.status(200).json({
                    source: 'cache',
                    count: cached.length,
                    tasks: cached
                });
            }
        }

        // Cache miss (or bypass) -> Fetch from Database
        cacheStats.misses++;
        const tasks = await getTasksFromDatabase();

        // Step 3: Store in node-cache (default TTL 60 seconds)
        cache.set('all_tasks', tasks);

        res.setHeader('X-Cache', 'MISS');
        return res.status(200).json({
            source: bypass ? 'database-bypassed' : 'database',
            count: tasks.length,
            tasks
        });
    } catch (error) {
        next(error);
    }
});

// 2. GET /tasks/:id - Supplementary Problem 1: Cache single task separately
router.get('/:id', async (req, res, next) => {
    try {
        const taskId = req.params.id;
        const cacheKey = `task_${taskId}`;

        // Check single task cache
        const cachedTask = cache.get(cacheKey);
        if (cachedTask) {
            cacheStats.hits++;
            res.setHeader('X-Cache', 'HIT');
            return res.status(200).json({
                source: 'cache',
                task: cachedTask
            });
        }

        // Cache miss -> Query DB
        cacheStats.misses++;
        let task;
        if (mongoose.connection.readyState === 1) {
            task = await Task.findById(taskId);
        } else {
            await new Promise(r => setTimeout(r, 40));
            task = fallbackTasks.find(t => t._id.toString() === taskId);
        }

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Store single task in cache
        cache.set(cacheKey, task);

        res.setHeader('X-Cache', 'MISS');
        return res.status(200).json({
            source: 'database',
            task
        });
    } catch (error) {
        next(error);
    }
});

// 3. POST /tasks - Create task & Invalidate Cache (Step 4 of Practical 9)
router.post('/', async (req, res, next) => {
    try {
        const { title, description, priority, completed } = req.body || {};

        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Task title is required'
            });
        }

        let savedTask;
        if (mongoose.connection.readyState === 1) {
            const newTask = new Task({ title, description, priority, completed });
            savedTask = await newTask.save();
        } else {
            savedTask = {
                _id: 'temp_' + Date.now(),
                title: title.trim(),
                description: description || '',
                priority: priority || 'medium',
                completed: completed || false,
                createdAt: new Date()
            };
            fallbackTasks.unshift(savedTask);
        }

        // Step 4: Invalidate all_tasks cache on write operation
        cache.del('all_tasks');
        cacheStats.invalidations++;

        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            task: savedTask
        });
    } catch (error) {
        next(error);
    }
});

// 4. PUT /tasks/:id - Update task & Invalidate Cache
router.put('/:id', async (req, res, next) => {
    try {
        let task;
        if (mongoose.connection.readyState === 1) {
            task = await Task.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true }
            );
        } else {
            const item = fallbackTasks.find(t => t._id.toString() === req.params.id);
            if (item) {
                if (req.body.title !== undefined) item.title = req.body.title;
                if (req.body.description !== undefined) item.description = req.body.description;
                if (req.body.completed !== undefined) item.completed = req.body.completed;
                if (req.body.priority !== undefined) item.priority = req.body.priority;
                task = item;
            }
        }

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Invalidate list cache & single item cache
        cache.del('all_tasks');
        cache.del(`task_${req.params.id}`);
        cacheStats.invalidations++;

        res.status(200).json({
            success: true,
            message: 'Task updated successfully',
            task
        });
    } catch (error) {
        next(error);
    }
});

// 5. DELETE /tasks/:id - Delete task & Invalidate Cache
router.delete('/:id', async (req, res, next) => {
    try {
        let task;
        if (mongoose.connection.readyState === 1) {
            task = await Task.findByIdAndDelete(req.params.id);
        } else {
            const index = fallbackTasks.findIndex(t => t._id.toString() === req.params.id);
            if (index !== -1) {
                task = fallbackTasks.splice(index, 1)[0];
            }
        }

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Invalidate list cache & single item cache
        cache.del('all_tasks');
        cache.del(`task_${req.params.id}`);
        cacheStats.invalidations++;

        res.status(200).json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
