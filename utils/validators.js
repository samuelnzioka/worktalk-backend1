/**
 * Validators
 * Input validation functions
 */

const { BLOCKED_USERNAMES } = require('../config/constants');

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { isValid, message }
 */
const validatePassword = (password) => {
    if (!password || password.length < 8) {
        return { isValid: false, message: 'Password must be at least 8 characters' };
    }
    
    if (password.length > 128) {
        return { isValid: false, message: 'Password must be less than 128 characters' };
    }
    
    let strength = 0;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    if (strength < 2) {
        return { isValid: false, message: 'Password must contain a mix of letters and numbers' };
    }
    
    return { isValid: true, message: 'Password is strong' };
};

/**
 * Validate public username
 * @param {string} username - Username to validate
 * @returns {Object} { isValid, message }
 */
const validatePublicUsername = (username) => {
    if (!username || username.length < 3) {
        return { isValid: false, message: 'Username must be at least 3 characters' };
    }
    
    if (username.length > 20) {
        return { isValid: false, message: 'Username must be less than 20 characters' };
    }
    
    const validChars = /^[a-zA-Z0-9_-]+$/;
    if (!validChars.test(username)) {
        return { isValid: false, message: 'Only letters, numbers, underscores, and hyphens allowed' };
    }
    
    // Check for blocked words
    const lowerUsername = username.toLowerCase();
    for (const blocked of BLOCKED_USERNAMES) {
        if (lowerUsername.includes(blocked)) {
            return { isValid: false, message: 'Username contains inappropriate content' };
        }
    }
    
    // Check for excessive numbers
    const numberCount = (username.match(/\d/g) || []).length;
    if (numberCount > username.length / 2) {
        return { isValid: false, message: 'Too many numbers in username' };
    }
    
    return { isValid: true, message: 'Username is valid' };
};

/**
 * Validate company name
 * @param {string} name - Company name
 * @returns {Object} { isValid, message }
 */
const validateCompanyName = (name) => {
    if (!name || name.length < 2) {
        return { isValid: false, message: 'Company name must be at least 2 characters' };
    }
    
    if (name.length > 100) {
        return { isValid: false, message: 'Company name must be less than 100 characters' };
    }
    
    return { isValid: true, message: 'Company name is valid' };
};

/**
 * Validate department name
 * @param {string} name - Department name
 * @returns {Object} { isValid, message }
 */
const validateDepartmentName = (name) => {
    if (!name || name.length < 2) {
        return { isValid: false, message: 'Department name must be at least 2 characters' };
    }
    
    if (name.length > 50) {
        return { isValid: false, message: 'Department name must be less than 50 characters' };
    }
    
    const validChars = /^[a-zA-Z0-9\s\-&]+$/;
    if (!validChars.test(name)) {
        return { isValid: false, message: 'Department name contains invalid characters' };
    }
    
    return { isValid: true, message: 'Department name is valid' };
};

/**
 * Validate email domain
 * @param {string} domain - Email domain
 * @returns {Object} { isValid, message }
 */
const validateEmailDomain = (domain) => {
    if (!domain) {
        return { isValid: false, message: 'Email domain is required' };
    }
    
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
        return { isValid: false, message: 'Invalid email domain format (e.g., company.co.ke)' };
    }
    
    return { isValid: true, message: 'Email domain is valid' };
};

/**
 * Validate content (posts/comments)
 * @param {string} content - Content to validate
 * @param {number} maxLength - Maximum length
 * @returns {Object} { isValid, message }
 */
const validateContent = (content, maxLength = 5000) => {
    if (!content || content.trim().length === 0) {
        return { isValid: false, message: 'Content is required' };
    }
    
    if (content.length > maxLength) {
        return { isValid: false, message: `Content must be less than ${maxLength} characters` };
    }
    
    // Check for excessive caps (spam detection)
    const upperCount = (content.match(/[A-Z]/g) || []).length;
    if (upperCount > content.length * 0.7 && content.length > 50) {
        return { isValid: false, message: 'Please avoid excessive capitalization' };
    }
    
    return { isValid: true, message: 'Content is valid' };
};

module.exports = {
    isValidEmail,
    validatePassword,
    validatePublicUsername,
    validateCompanyName,
    validateDepartmentName,
    validateEmailDomain,
    validateContent
};