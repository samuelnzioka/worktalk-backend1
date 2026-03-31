/**
 * User Routes
 * User profile and account management endpoints
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authmiddleware');
const { validatePasswordChange, validateUsername } = require('../middleware/validationmiddleware');
const {
    getUserProfile,
    updateUserProfile,
    changePassword,
    deleteAccount,
    getUserActivity,
    getUserCompanyPosts,
    getUserPublicPosts,
    exportUserData
} = require('../controllers/usercontroller');

// Public profile
router.get('/:userId', getUserProfile);

// Protected routes
router.put('/profile', protect, updateUserProfile);
router.post('/change-password', protect, validatePasswordChange, changePassword);
router.delete('/account', protect, deleteAccount);
router.get('/activity', protect, getUserActivity);
router.get('/posts/company', protect, getUserCompanyPosts);
router.get('/posts/public', protect, getUserPublicPosts);
router.get('/export-data', protect, exportUserData);

module.exports = router;