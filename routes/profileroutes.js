/**
 * Profile Routes
 * Profile switching and management endpoints
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authmiddleware');
const { validateUsername } = require('../middleware/validationmiddleware');
const {
    getProfiles,
    switchProfile,
    createPublicProfile,
    updatePublicUsername,
    getEmployeeVerification
} = require('../controllers/profilecontroller');

// Protected routes
router.get('/', protect, getProfiles);
router.post('/switch', protect, switchProfile);
router.post('/public', protect, validateUsername, createPublicProfile);
router.put('/public/username', protect, validateUsername, updatePublicUsername);
router.get('/employee/verify', protect, getEmployeeVerification);

module.exports = router;