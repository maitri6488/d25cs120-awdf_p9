const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const taskRoutes = require('./routes/taskRoutes');
const cacheRoutes = require('./routes/cacheRoutes');

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(logger);

// Serve static frontend UI
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/tasks', taskRoutes);
app.use('/api', cacheRoutes);

// Fallback route to frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Centralized Global Error Handler (MUST BE LAST)
app.use(errorHandler);

// Server & Database Startup
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taskdb_cache';

if (require.main === module) {
    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log('MongoDB connected successfully');
            app.listen(PORT, () => {
                console.log(`Practical 9 Server running at http://localhost:${PORT}`);
            });
        })
        .catch((err) => {
            console.error('MongoDB connection error:', err.message);
            console.log('Starting server in fallback mode (MongoDB disconnected)...');
            app.listen(PORT, () => {
                console.log(`Practical 9 Server running at http://localhost:${PORT}`);
            });
        });
}

module.exports = app;
