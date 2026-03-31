/**
 * Comment Controller
 * Handles comment creation and management
 */

const Post = require('../models/post');
const Comment = require('../models/comment');
const CompanyEmployee = require('../models/companyemployee');
const Company = require('../models/company');
const AuditLog = require('../models/auditlog');
const { sanitizeContent } = require('../middleware/securitymiddleware');
const { getClientIP, getUserAgent } = require('../utils/helpers');
const { validateContent } = require('../utils/validators');

/**
 * Create a comment on a post
 */
const createComment = async (req, res) => {
    try {
        const { postId, content, isAnonymous = false } = req.body;
        
        // Validate content
        const contentValidation = validateContent(content, 1000);
        if (!contentValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: contentValidation.message,
                field: 'content'
            });
        }
        
        // Get post
        const post = await Post.findById(postId);
        if (!post || post.status === 'removed') {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }
        
        let canComment = true;
        let username = '';
        let profileId = '';
        
        // Check permissions based on post type
        if (post.postType === 'company_space') {
            // Check if user is employee of this department
            const employee = await CompanyEmployee.findOne({
                user: req.user._id,
                department: post.departmentId,
                isVerified: true,
                isActive: true
            });
            
            if (!employee) {
                return res.status(403).json({
                    success: false,
                    message: 'Only employees of this department can comment here'
                });
            }
            
            // Get user's profile for this company
            const userProfile = req.user.profiles.find(p => 
                p.type === 'employee' && p.companyId?.toString() === post.companyId?.toString()
            );
            
            if (userProfile) {
                profileId = userProfile._id;
                username = isAnonymous ? 'Anonymous Employee' : userProfile.username;
            } else {
                profileId = req.user.profiles[0]?._id;
                username = isAnonymous ? 'Anonymous' : req.user.profiles[0]?.username || 'User';
            }
        } else {
            // Public timeline - any authenticated user can comment
            const userProfile = req.user.getActiveProfile();
            profileId = userProfile._id;
            username = isAnonymous ? 'Anonymous' : userProfile.username;
        }
        
        // Sanitize content
        const sanitizedContent = sanitizeContent(content);
        
        // Create comment
        const comment = await Comment.create({
            profileId,
            username,
            user: req.user._id,
            post: postId,
            content: sanitizedContent,
            isAnonymous,
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'comment_created',
            details: { commentId: comment._id, postId, isAnonymous },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            comment
        });
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add comment'
        });
    }
};

/**
 * Get comments for a post
 */
const getPostComments = async (req, res) => {
    try {
        const { postId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        
        const skip = (page - 1) * limit;
        
        const comments = await Comment.find({ post: postId, status: 'active' })
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
        
        // Anonymize comments if isAnonymous is true
        const anonymizedComments = comments.map(comment => ({
            ...comment,
            username: comment.isAnonymous ? 'Anonymous' : comment.username
        }));
        
        const total = await Comment.countDocuments({ post: postId, status: 'active' });
        
        res.json({
            success: true,
            comments: anonymizedComments,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get comments'
        });
    }
};

/**
 * Like/unlike a comment
 */
const toggleLike = async (req, res) => {
    try {
        const { commentId } = req.params;
        
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }
        
        const isLiked = await comment.toggleLike(req.user._id);
        
        res.json({
            success: true,
            liked: isLiked,
            likeCount: comment.likeCount
        });
    } catch (error) {
        console.error('Toggle comment like error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle like'
        });
    }
};

/**
 * Delete a comment (owner or admin)
 */
const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }
        
        // Check if user is comment owner or admin
        const isOwner = comment.user.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        
        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this comment'
            });
        }
        
        comment.status = 'removed';
        await comment.save();
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'comment_deleted',
            details: { commentId, isOwner, isAdmin },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete comment'
        });
    }
};

module.exports = {
    createComment,
    getPostComments,
    toggleLike,
    deleteComment
};