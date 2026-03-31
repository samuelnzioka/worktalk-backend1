/**
 * Helper Functions
 * Reusable utility functions
 */

/**
 * Generate random token
 * @param {number} length - Token length
 * @returns {string} Random token
 */
const generateToken = (length = 32) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
};

/**
 * Generate invite code
 * @returns {string} Invite code
 */
const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

/**
 * Generate slug from string
 * @param {string} text - Text to convert to slug
 * @returns {string} Slug
 */
const generateSlug = (text) => {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
};

/**
 * Validate email domain
 * @param {string} email - Email address
 * @param {string} domain - Expected domain
 * @returns {boolean} True if matches
 */
const validateEmailDomain = (email, domain) => {
    return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
};

/**
 * Extract domain from email
 * @param {string} email - Email address
 * @returns {string|null} Domain or null
 */
const extractEmailDomain = (email) => {
    const parts = email.split('@');
    return parts.length === 2 ? parts[1] : null;
};

/**
 * Pagination helper
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination metadata
 */
const paginate = (page = 1, limit = 20, total = 0) => {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const totalPages = Math.ceil(total / limitNum);
    
    return {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        nextPage: pageNum < totalPages ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null,
        skip: (pageNum - 1) * limitNum
    };
};

/**
 * Get client IP from request
 * @param {Object} req - Express request object
 * @returns {string} Client IP
 */
const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip;
};

/**
 * Get user agent from request
 * @param {Object} req - Express request object
 * @returns {string} User agent
 */
const getUserAgent = (req) => {
    return req.headers['user-agent'] || 'unknown';
};

/**
 * Sanitize phone number
 * @param {string} phone - Phone number
 * @returns {string} Sanitized phone number
 */
const sanitizePhone = (phone) => {
    return phone?.replace(/[^0-9+]/g, '') || '';
};

/**
 * Truncate text
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @returns {string} Truncated text
 */
const truncateText = (text, length = 100) => {
    if (!text || text.length <= length) return text;
    return text.substring(0, length) + '...';
};

/**
 * Sleep/delay
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Format date
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

module.exports = {
    generateToken,
    generateInviteCode,
    generateSlug,
    validateEmailDomain,
    extractEmailDomain,
    paginate,
    getClientIP,
    getUserAgent,
    sanitizePhone,
    truncateText,
    sleep,
    formatDate
};