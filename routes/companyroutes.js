/**
 * Company Routes
 * Company management and public company data endpoints
 */

const express = require('express');
const router = express.Router();
const { protect, companyAdminOnly } = require('../middleware/authmiddleware');
const { validateCompanyRegister, validateDepartment } = require('../middleware/validationmiddleware');
const {
    getCompanies,
    getCompanyBySlug,
    registerCompany,
    getCompanyDepartments,
    getCompanyStats,
    getCompanyEmployees,
    removeEmployee,
    updateCompanySettings
} = require('../controllers/companycontroller');
const {
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getDepartmentPosts
} = require('../controllers/departmentcontroller');
const {
    generateInvite,
    getCompanyInvites,
    revokeInvite
} = require('../controllers/invitecontroller');

// Public routes
router.get('/', getCompanies);
router.get('/:slug', getCompanyBySlug);
router.post('/register', protect, validateCompanyRegister, registerCompany);
router.get('/:companyId/departments', getCompanyDepartments);

// Department posts (public)
router.get('/:companyId/departments/:departmentId/posts', getDepartmentPosts);

// Protected company admin routes
router.get('/:companyId/stats', protect, companyAdminOnly(), getCompanyStats);
router.get('/:companyId/employees', protect, companyAdminOnly(), getCompanyEmployees);
router.delete('/:companyId/employees/:userId', protect, companyAdminOnly(), removeEmployee);
router.put('/:companyId/settings', protect, companyAdminOnly(), updateCompanySettings);

// Department management
router.post('/:companyId/departments', protect, companyAdminOnly(), validateDepartment, createDepartment);
router.put('/departments/:departmentId', protect, companyAdminOnly(), validateDepartment, updateDepartment);
router.delete('/departments/:departmentId', protect, companyAdminOnly(), deleteDepartment);

// Invite management
router.post('/:companyId/invites', protect, companyAdminOnly(), generateInvite);
router.get('/:companyId/invites', protect, companyAdminOnly(), getCompanyInvites);
router.delete('/:companyId/invites/:inviteId', protect, companyAdminOnly(), revokeInvite);

module.exports = router;