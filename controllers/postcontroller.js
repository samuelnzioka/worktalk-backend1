/**
 * Post Controller
 * Handles post creation, retrieval, and moderation
 */

const Post = require('../models/post');
const Comment = require('../models/comment');
const Company = require('../models/company');
const Department = require('../models/department');
const CompanyEmployee = require('../models/companyemployee');
const User = require('../models/user');
const AuditLog = require('../models/auditlog');
const { sanitizeContent } = require('../middleware/securitymiddleware');
const { getClientIP, getUserAgent } = require('../utils/helpers');
const { validateContent } = require('../utils/validators');

/**
 * Create a post in company space (employee only, their department)
 */
const createCompanyPost = async (req, res) => {
    try {
        const { companyId, departmentId, content, isAnonymous = true } = req.body;
        
        // Validate content
        const contentValidation = validateContent(content);
        if (!contentValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: contentValidation.message,
                field: 'content'
            });
        }
        
        // Verify user is employee of this company and department
        const employee = await CompanyEmployee.findOne({
            user: req.user._id,
            company: companyId,
            department: departmentId,
            isVerified: true,
            isActive: true
        });
        
        if (!employee) {
            return res.status(403).json({
                success: false,
                message: 'You can only post in your own department'
            });
        }
        
        // Get user's active profile for this company
        const userProfile = req.user.profiles.find(p => 
            p.type === 'employee' && p.companyId?.toString() === companyId
        );
        
        if (!userProfile) {
            return res.status(403).json({
                success: false,
                message: 'Employee profile not found'
            });
        }
        
        // Sanitize content
        const sanitizedContent = sanitizeContent(content);
        
        // Create post
        const post = await Post.create({
            profileId: userProfile._id,
            username: isAnonymous ? 'Anonymous Employee' : userProfile.username,
            user: req.user._id,
            companyId,
            departmentId,
            content: sanitizedContent,
            postType: 'company_space',
            isAnonymous,
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        // Update department post count
        await Department.findByIdAndUpdate(departmentId, { $inc: { totalPosts: 1 } });
        
        // Update company post count
        await Company.findByIdAndUpdate(companyId, { $inc: { totalPosts: 1 } });
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'post_created',
            details: { postId: post._id, companyId, departmentId, isAnonymous },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.status(201).json({
            success: true,
            message: 'Post created successfully',
            post
        });
    } catch (error) {
        console.error('Create company post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create post'
        });
    }
};

/**
 * Create a post in public timeline (any authenticated user)
 */
const createPublicPost = async (req, res) => {
    try {
        const { content, isAnonymous = false } = req.body;
        
        // Validate content
        const contentValidation = validateContent(content);
        if (!contentValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: contentValidation.message,
                field: 'content'
            });
        }
        
        // Get user's active public profile
        const userProfile = req.user.getActiveProfile();
        
        if (!userProfile) {
            return res.status(403).json({
                success: false,
                message: 'No active profile found'
            });
        }
        
        // Sanitize content
        const sanitizedContent = sanitizeContent(content);
        
        // Create post
        const post = await Post.create({
            profileId: userProfile._id,
            username: isAnonymous ? 'Anonymous' : userProfile.username,
            user: req.user._id,
            content: sanitizedContent,
            postType: 'public_timeline',
            isAnonymous,
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'post_created',
            details: { postId: post._id, postType: 'public_timeline', isAnonymous },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.status(201).json({
            success: true,
            message: 'Post created successfully',
            post
        });
    } catch (error) {
        console.error('Create public post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create post'
        });
    }
};

/**
 * Like/unlike a post
 */
const toggleLike = async (req, res) => {
    try {
        const { postId } = req.params;
        
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }
        
        const isLiked = await post.toggleLike(req.user._id);
        
        await AuditLog.log({
            userId: req.user._id,
            action: isLiked ? 'like_added' : 'like_removed',
            details: { postId },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            liked: isLiked,
            likeCount: post.likeCount
        });
    } catch (error) {
        console.error('Toggle like error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle like'
        });
    }
};

/**
 * Flag a post as inappropriate
 */
const flagPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { reason } = req.body;
        
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }
        
        await post.flag(reason, req.user._id);
        
        // If auto-moderation is enabled, check if post should be hidden
        if (post.companyId) {
            const company = await Company.findById(post.companyId);
            if (company && company.settings.moderationEnabled) {
                // Post is now flagged and will be reviewed by company admin
            }
        }
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'post_flagged',
            details: { postId, reason },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Post has been flagged for review'
        });
    } catch (error) {
        console.error('Flag post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to flag post'
        });
    }
};

/**
 * Delete a post (owner or admin)
 */
const deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }
        
        // Check if user is post owner or admin
        const isOwner = post.user.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        
        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this post'
            });
        }
        
        // Soft delete - mark as removed
        post.status = 'removed';
        await post.save();
        
        // Delete all comments on this post
        await Comment.updateMany(
            { post: postId },
            { status: 'removed' }
        );
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'post_deleted',
            details: { postId, isOwner, isAdmin },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Post deleted successfully'
        });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete post'
        });
    }
};

module.exports = {
    createCompanyPost,
    createPublicPost,
    toggleLike,
    flagPost,
    deletePost
};