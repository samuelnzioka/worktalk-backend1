/**
 * Invite Routes
 * Invite code verification endpoints
 */

const express = require('express');
const router = express.Router();
const { verifyInvite } = require('../controllers/invitecontroller');

// Public route for invite verification
router.get('/verify/:code', verifyInvite);

module.exports = router;