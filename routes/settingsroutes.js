/**
 * Settings Routes
 * API endpoints for user and company settings
 */

const express = require('express');
const router = express.Router();
const { protect, companyAdminOnly } = require('../middleware/authmiddleware');
const {
    // User settings
    getusersettings,
    updateusersettings,
    updateuserprofile,
    changepassword,
    deleteaccount,
    // Company settings
    getcompanysettings,
    updatecompanysettings,
    // New company admin functions
    getCompanyGeneralSettings,
    updateCompanyGeneralSettings,
    getCompanyDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    reorderDepartments,
    getModerationSettings,
    updateModerationSettings,
    getFlaggedContent,
    resolveFlaggedContent,
    getEmployeeManagementSettings,
    updateEmployeeManagementSettings,
    getCompanyPrivacySettings,
    updateCompanyPrivacySettings,
    getCompanyAnalytics,
    exportCompanyData
} = require('../controllers/settingscontroller');

// ==================== USER SETTINGS ROUTES ====================
router.get('/user', protect, getusersettings);
router.put('/user', protect, updateusersettings);
router.put('/profile', protect, updateuserprofile);
router.post('/change-password', protect, changepassword);
router.delete('/account', protect, deleteaccount);

// ==================== COMPANY SETTINGS ROUTES ====================
router.get('/company/:companyId/settings', protect, companyAdminOnly(), getcompanysettings);
router.put('/company/:companyId/settings', protect, companyAdminOnly(), updatecompanysettings);

// General Settings
router.get('/company/:companyId/general', protect, companyAdminOnly(), getCompanyGeneralSettings);
router.put('/company/:companyId/general', protect, companyAdminOnly(), updateCompanyGeneralSettings);

// Department Management
router.get('/company/:companyId/departments', protect, companyAdminOnly(), getCompanyDepartments);
router.post('/company/:companyId/departments', protect, companyAdminOnly(), createDepartment);
router.put('/departments/:departmentId', protect, companyAdminOnly(), updateDepartment);
router.delete('/departments/:departmentId', protect, companyAdminOnly(), deleteDepartment);
router.post('/company/:companyId/departments/reorder', protect, companyAdminOnly(), reorderDepartments);

// Moderation Settings
router.get('/company/:companyId/moderation', protect, companyAdminOnly(), getModerationSettings);
router.put('/company/:companyId/moderation', protect, companyAdminOnly(), updateModerationSettings);
router.get('/company/:companyId/flagged', protect, companyAdminOnly(), getFlaggedContent);
router.post('/flagged/:postId/resolve', protect, companyAdminOnly(), resolveFlaggedContent);

// Employee Management Settings
router.get('/company/:companyId/employee-management', protect, companyAdminOnly(), getEmployeeManagementSettings);
router.put('/company/:companyId/employee-management', protect, companyAdminOnly(), updateEmployeeManagementSettings);

// Privacy Settings
router.get('/company/:companyId/privacy', protect, companyAdminOnly(), getCompanyPrivacySettings);
router.put('/company/:companyId/privacy', protect, companyAdminOnly(), updateCompanyPrivacySettings);

// Analytics & Reporting
router.get('/company/:companyId/analytics', protect, companyAdminOnly(), getCompanyAnalytics);
router.get('/company/:companyId/export', protect, companyAdminOnly(), exportCompanyData);

module.exports = router;