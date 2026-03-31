/**
 * Comment Routes
 * Comment creation and management endpoints
 */

const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/authmiddleware');
const { validateComment } = require('../middleware/validationmiddleware');
const {
    createComment,
    getPostComments,
    toggleLike,
    deleteComment
} = require('../controllers/commentcontroller');

// Public route for getting comments
router.get('/post/:postId', optionalAuth, getPostComments);

// Protected routes
router.post('/', protect, validateComment, createComment);
router.post('/:commentId/like', protect, toggleLike);
router.delete('/:commentId', protect, deleteComment);

module.exports = router;