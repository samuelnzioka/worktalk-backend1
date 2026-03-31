/**
 * Security Middleware
 * Additional security headers and request sanitization
 */

const sanitizeHtml = require('sanitize-html');

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
};

/**
 * Sanitize request body to prevent XSS
 */
const sanitizeBody = (req, res, next) => {
    if (req.body) {
        const sanitizeOptions = {
            allowedTags: [],
            allowedAttributes: {},
            textFilter: function(text) {
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }
        };
        
        // Sanitize string fields
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeHtml(req.body[key], sanitizeOptions);
            }
        }
    }
    next();
};

/**
 * Sanitize specific content fields (for posts/comments)
 */
const sanitizeContent = (content) => {
    const options = {
        allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
        allowedAttributes: {},
        allowedSchemes: [],
        transformTags: {
            'script': () => ({ tagName: 'div', text: '' })
        }
    };
    
    return sanitizeHtml(content, options).trim();
};

module.exports = {
    securityHeaders,
    sanitizeBody,
    sanitizeContent
};