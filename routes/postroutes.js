/**
 * Post Routes
 * Post creation and interaction endpoints
 */

const express = require('express');
const router = express.Router();
const { protect, employeeOnly, departmentEmployeeOnly } = require('../middleware/authmiddleware');
const { validateCompanyPost, validatePost } = require('../middleware/validationmiddleware');
const {
    createCompanyPost,
    createPublicPost,
    toggleLike,
    flagPost,
    deletePost
} = require('../controllers/postcontroller');

// Company post creation (requires employee of that department)
router.post('/company', protect, employeeOnly, validateCompanyPost, createCompanyPost);

// Public post creation
router.post('/public', protect, validatePost, createPublicPost);

// Post interactions
router.post('/:postId/like', protect, toggleLike);
router.post('/:postId/flag', protect, flagPost);
router.delete('/:postId', protect, deletePost);

module.exports = router;