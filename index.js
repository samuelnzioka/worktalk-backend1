/**
 * WorkTalk - Main Application Entry Point
 * Express server with security middleware and routes
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import database connection
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/authroutes');
const companyRoutes = require('./routes/companyroutes');
const departmentRoutes = require('./routes/departmentroutes');
const postRoutes = require('./routes/postroutes');
const commentRoutes = require('./routes/commentroutes');
const timelineRoutes = require('./routes/timelineroutes');
const userRoutes = require('./routes/userroutes');
const adminRoutes = require('./routes/adminroutes');
const profileRoutes = require('./routes/profileroutes');
const inviteRoutes = require('./routes/inviteroutes');
const settingsRoutes = require('./routes/settingsroutes');

// Import middleware
const errorMiddleware = require('./middleware/errormiddleware');
const { securityHeaders } = require('./middleware/securitymiddleware');

// Initialize express
const app = express();

// Connect to MongoDB
connectDB();

// ==================== Security Middleware ====================

// Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", process.env.FRONTEND_URL],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: [
        'https://ajiratalk.pages.dev',      // Your Cloudflare frontend
        'https://worktalk-backend2.onrender.com', // Backend itself
        'http://localhost:3000',            // Local development
        'http://localhost:3001',            // Alternative local port
        'http://127.0.0.1:3000',           // Local development alternative
        'http://127.0.0.1:3001'            // Alternative local port
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 200
}));

// Custom security headers
app.use(securityHeaders);

// Compression for response size
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== Rate Limiting ====================

// Global rate limiter
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { success: false, message: 'Too many attempts, please try again after 15 minutes.' },
    skipSuccessfulRequests: true
});

// Post creation rate limiter
const postLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_POST_CREATION) || 20,
    message: { success: false, message: 'Too many posts created, please slow down.' }
});

// Registration rate limiter
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_REGISTRATION) || 10,
    message: { success: false, message: 'Too many registrations from this IP.' }
});

// Apply global rate limiter to all API routes
app.use('/api/', globalLimiter);

// ==================== Routes ====================

// Handle preflight requests
app.options('*', (req, res) => {
    const allowedOrigins = [
        'https://ajiratalk.pages.dev',
        'https://worktalk-backend2.onrender.com',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        res.setHeader('Access-Control-Max-Age', '86400');
    }
    res.status(204).send();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/posts', postLimiter, postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// ==================== Error Handling ====================
app.use(errorMiddleware);

// ==================== Start Server ====================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API URL: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

module.exports = app;