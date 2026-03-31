/**
 * Department Routes
 * Department-specific endpoints
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/authmiddleware');
const { getDepartmentPosts } = require('../controllers/departmentcontroller');

// Public route for department posts (with optional auth for like status)
router.get('/:departmentId/posts', optionalAuth, getDepartmentPosts);

module.exports = router;