function errorHandler(err, req, res, next) {
    console.error('Error encountered:', err);

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        const errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    // Invalid MongoDB ObjectId
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid task ID format'
        });
    }

    // General error
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
}

module.exports = errorHandler;
