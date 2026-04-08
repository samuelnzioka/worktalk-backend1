/**
 * CORS Configuration
 * Cross-Origin Resource Sharing settings
 */

const allowedOrigins = [
    'https://ajiratalk.pages.dev',      // Your Cloudflare frontend
    'https://worktalk-backend2.onrender.com', // Backend itself
    'http://localhost:3000',            // Local development
    'http://localhost:3001',            // Alternative local port
    'http://127.0.0.1:3000',           // Local development alternative
    'http://127.0.0.1:3001',            // Alternative local port
    process.env.FRONTEND_URL            // Environment variable fallback
].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('CORS policy violation'), false);
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
};

module.exports = corsOptions;