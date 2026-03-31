/**
 * Timeline Routes
 * Public timeline endpoints
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/authmiddleware');
const { getPublicTimeline } = require('../controllers/timelinecontroller');

// Public timeline (with optional auth for like status)
router.get('/', optionalAuth, getPublicTimeline);

module.exports = router;