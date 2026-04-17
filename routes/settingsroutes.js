/**
 * Settings Routes
 * API endpoints for user and company settings
 */

const express = require('express');
const router = express.Router();
const { protect, companyAdminOnly } = require('../middleware/authmiddleware');
const {
    getusersettings,
    updateusersettings,
    updateuserprofile,
    changepassword,
    getcompanysettings,
    updatecompanysettings,
    deleteaccount
} = require('../controllers/settingscontroller');

// User settings routes
router.get('/user', protect, getusersettings);
router.put('/user', protect, updateusersettings);
router.put('/profile', protect, updateuserprofile);
router.post('/change-password', protect, changepassword);
router.delete('/account', protect, deleteaccount);

// Company settings routes (company admin only)
router.get('/company/:companyId', protect, companyAdminOnly(), getcompanysettings);
router.put('/company/:companyId', protect, companyAdminOnly(), updatecompanysettings);

module.exports = router;