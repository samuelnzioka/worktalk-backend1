/**
 * Validation Middleware
 * Input validation using express-validator
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Check validation results
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: errors.array()
        });
    }
    next();
};

/**
 * User registration validation
 */
const validateRegister = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
        .matches(/^[a-zA-Z\s\-']+$/).withMessage('Name contains invalid characters'),
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required')
        .isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters')
        .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password must contain at least one letter and one number'),
    
    validate
];

/**
 * Employee registration validation (with invite code)
 */
const validateEmployeeRegister = [
    body('inviteCode')
        .trim()
        .notEmpty().withMessage('Invite code is required')
        .isLength({ min: 6, max: 50 }).withMessage('Invalid invite code'),
    
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    
    validate
];

/**
 * Login validation
 */
const validateLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required'),
    
    validate
];

/**
 * Post creation validation
 */
const validatePost = [
    body('content')
        .trim()
        .notEmpty().withMessage('Content is required')
        .isLength({ min: 1, max: 5000 }).withMessage('Content must be 1-5000 characters'),
    
    body('isAnonymous')
        .optional()
        .isBoolean().withMessage('isAnonymous must be boolean'),
    
    validate
];

/**
 * Company post validation (with company and department)
 */
const validateCompanyPost = [
    body('companyId')
        .notEmpty().withMessage('Company ID is required')
        .isMongoId().withMessage('Invalid company ID'),
    
    body('departmentId')
        .notEmpty().withMessage('Department ID is required')
        .isMongoId().withMessage('Invalid department ID'),
    
    body('content')
        .trim()
        .notEmpty().withMessage('Content is required')
        .isLength({ min: 1, max: 5000 }).withMessage('Content must be 1-5000 characters'),
    
    body('isAnonymous')
        .optional()
        .isBoolean().withMessage('isAnonymous must be boolean'),
    
    validate
];

/**
 * Comment validation
 */
const validateComment = [
    body('postId')
        .notEmpty().withMessage('Post ID is required')
        .isMongoId().withMessage('Invalid post ID'),
    
    body('content')
        .trim()
        .notEmpty().withMessage('Content is required')
        .isLength({ min: 1, max: 1000 }).withMessage('Content must be 1-1000 characters'),
    
    body('isAnonymous')
        .optional()
        .isBoolean().withMessage('isAnonymous must be boolean'),
    
    validate
];

/**
 * Company registration validation
 */
const validateCompanyRegister = [
    body('name')
        .trim()
        .notEmpty().withMessage('Company name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Company name must be 2-100 characters'),
    
    body('industry')
        .trim()
        .notEmpty().withMessage('Industry is required'),
    
    body('emailDomain')
        .optional()
        .trim()
        .matches(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/).withMessage('Invalid email domain format'),
    
    body('companyEmail')
        .optional()
        .trim()
        .isEmail().withMessage('Please provide a valid company email')
        .normalizeEmail(),
    
    body('contactName')
        .trim()
        .notEmpty().withMessage('Contact name is required'),
    
    body('contactEmail')
        .trim()
        .notEmpty().withMessage('Contact email is required')
        .isEmail().withMessage('Please provide a valid email'),
    
    body('contactPhone')
        .optional()
        .trim(),
    
    body('adminPhone')
        .optional()
        .trim(),
    
    body('description')
        .trim()
        .optional()
        .isLength({ max: 500 }).withMessage('Description must be at most 500 characters'),
    
    body('adminPassword')
        .trim()
        .notEmpty().withMessage('Admin password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    
    body('confirmPassword')
        .trim()
        .notEmpty().withMessage('Please confirm your password')
        .custom((value, { req }) => {
            if (value !== req.body.adminPassword) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),
    
    body('departments')
        .custom(value => {
            try {
                const depts = JSON.parse(value);
                if (!Array.isArray(depts) || depts.length === 0) {
                    throw new Error('At least one department is required');
                }
                return true;
            } catch {
                throw new Error('Invalid departments format');
            }
        }),
    
    body('emailVerificationCode')
        .trim()
        .notEmpty().withMessage('Email verification code is required')
        .isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits')
        .matches(/^[0-9]{6}$/).withMessage('Verification code must be 6 digits'),
    
    body('taxId').optional().trim(),
    body('registrationNumber').optional().trim(),
    body('country').optional().trim(),
    body('yearFounded').optional().isInt({ min: 1800, max: new Date().getFullYear() }).withMessage('Invalid year founded'),
    body('revenueRange').optional().trim(),
    body('streetAddress').optional().trim(),
    body('city').optional().trim(),
    body('postalCode').optional().trim(),
    body('jobTitle').optional().trim(),
    body('website').optional().trim(),
    body('logo').optional().trim(),
    
    validate
];

/**
 * Department validation
 */
const validateDepartment = [
    body('name')
        .trim()
        .notEmpty().withMessage('Department name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Department name must be 2-50 characters')
        .matches(/^[a-zA-Z0-9\s\-&]+$/).withMessage('Department name contains invalid characters'),
    
    body('description').optional().trim().isLength({ max: 1000 }),
    body('icon').optional().trim(),
    body('headOfDepartment').optional().isMongoId().withMessage('Invalid head of department ID'),
    body('isHidden').optional().isBoolean().withMessage('isHidden must be boolean'),
    body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
    
    validate
];

/**
 * General settings validation
 */
const validateGeneralSettings = [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Company name must be 2-100 characters'),
    body('industry').optional().trim().notEmpty().withMessage('Industry cannot be empty'),
    body('description').optional().trim().isLength({ max: 5000 }).withMessage('Description too long'),
    body('logo').optional().trim(),
    body('banner').optional().trim(),
    body('website').optional().trim(),
    body('contactEmail').optional().trim().isEmail().withMessage('Invalid contact email'),
    body('contactPhone').optional().trim(),
    body('streetAddress').optional().trim(),
    body('city').optional().trim(),
    body('postalCode').optional().trim(),
    body('country').optional().trim(),
    
    validate
];

/**
 * Company settings validation (moderation, employee management, privacy)
 */
const validateCompanySettings = [
    // Basic
    body('requireVerification').optional().isBoolean(),
    body('autoApproveEmployees').optional().isBoolean(),
    // Moderation
    body('postModeration').optional().isIn(['auto_approve', 'manual_review']).withMessage('Invalid post moderation value'),
    body('allowAnonymousPosts').optional().isBoolean(),
    body('commentModeration').optional().isIn(['auto_approve', 'manual_review']).withMessage('Invalid comment moderation value'),
    body('flaggedContentReview').optional().isIn(['manual', 'auto_hide']).withMessage('Invalid flagged content review value'),
    body('blockedKeywords').optional().isArray().withMessage('Blocked keywords must be an array'),
    body('autoSuspendAfterFlags').optional().isInt({ min: 1, max: 100 }).withMessage('Auto suspend after flags must be 1-100'),
    body('maxCommentsPerDay').optional().isInt({ min: 0 }).withMessage('Max comments per day must be >= 0'),
    body('maxPostsPerDay').optional().isInt({ min: 0 }).withMessage('Max posts per day must be >= 0'),
    // Employee management
    body('verificationMethod').optional().isIn(['email_domain', 'invite_code', 'manual']).withMessage('Invalid verification method'),
    body('allowEmployeeRegistration').optional().isBoolean(),
    body('employeeDepartureHandling').optional().isIn(['anonymize', 'delete', 'keep']).withMessage('Invalid departure handling value'),
    body('departmentAssignment').optional().isIn(['admin_assigns', 'employee_chooses']).withMessage('Invalid department assignment value'),
    // Privacy
    body('companySpaceVisibility').optional().isIn(['public', 'employees_only']).withMessage('Invalid visibility value'),
    body('showEmployeeCount').optional().isBoolean(),
    body('showDepartmentDetails').optional().isBoolean(),
    body('allowExternalSharing').optional().isBoolean(),
    
    validate
];

/**
 * Suspend employee validation
 */
const validateSuspendEmployee = [
    body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be a non-negative integer (days)'),
    body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason must be at most 500 characters'),
    
    validate
];

/**
 * Reorder departments validation
 */
const validateReorderDepartments = [
    body('order').isArray().withMessage('Order must be an array'),
    body('order.*.departmentId').isMongoId().withMessage('Invalid department ID'),
    body('order.*.order').isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
    
    validate
];

/**
 * Username validation (for public profile)
 */
const validateUsername = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required')
        .isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters')
        .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, underscores, and hyphens')
        .custom(async (username) => {
            // Check if username contains blocked words
            const { BLOCKED_USERNAMES } = require('../config/constants');
            const lowerUsername = username.toLowerCase();
            for (const blocked of BLOCKED_USERNAMES) {
                if (lowerUsername.includes(blocked)) {
                    throw new Error('Username contains inappropriate content');
                }
            }
            return true;
        }),
    
    validate
];

/**
 * Password change validation
 */
const validatePasswordChange = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required'),
    
    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password must contain at least one letter and one number'),
    
    validate
];

/**
 * Pagination validation
 */
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .toInt(),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
        .toInt(),
    
    validate
];

module.exports = {
    validateRegister,
    validateEmployeeRegister,
    validateLogin,
    validatePost,
    validateCompanyPost,
    validateComment,
    validateCompanyRegister,
    validateDepartment,
    validateGeneralSettings,
    validateCompanySettings,
    validateSuspendEmployee,
    validateReorderDepartments,
    validateUsername,
    validatePasswordChange,
    validatePagination,
    validate
};