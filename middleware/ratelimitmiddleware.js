/**
 * Rate Limit Middleware
 * Custom rate limiting for specific endpoints
 */

const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Authentication rate limiter (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: {
        success: false,
        message: 'Too many login attempts. Please try again after 15 minutes.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false
});

// Post creation rate limiter
const postLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_POST_CREATION) || 20,
    message: {
        success: false,
        message: 'Too many posts created. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Comment creation rate limiter
const commentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: {
        success: false,
        message: 'Too many comments. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Registration rate limiter
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_REGISTRATION) || 10,
    message: {
        success: false,
        message: 'Too many registrations from this IP. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Invite verification rate limiter
const inviteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: {
        success: false,
        message: 'Too many invite verification attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Search rate limiter
const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: {
        success: false,
        message: 'Too many search requests. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    apiLimiter,
    authLimiter,
    postLimiter,
    commentLimiter,
    registerLimiter,
    inviteLimiter,
    searchLimiter
};