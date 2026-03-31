/**
 * Auth Routes
 * Authentication and account management endpoints
 */

const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/authmiddleware');
const { 
    validateRegister, 
    validateEmployeeRegister, 
    validateLogin,
    validatePasswordChange,
    validateUsername
} = require('../middleware/validationmiddleware');
const {
    register,
    registerEmployee,
    login,
    refreshToken,
    logout,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    getCurrentUser
} = require('../controllers/authcontroller');

// Public routes
router.post('/register', validateRegister, register);
router.post('/register-employee', validateEmployeeRegister, registerEmployee);
router.post('/login', validateLogin, login);
router.post('/refresh-token', refreshToken);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getCurrentUser);

module.exports = router;