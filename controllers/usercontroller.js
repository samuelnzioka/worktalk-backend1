/**
 * User Controller
 * Handles user profile management and account operations
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');
const AuditLog = require('../models/auditlog');
const { getClientIP, getUserAgent, generateToken } = require('../utils/helpers');
const { validatePublicUsername, validatePassword } = require('../utils/validators');
const { sendVerificationEmail } = require('../services/emailservice');

/**
 * Get user public profile
 */
const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId)
            .select('name profiles.username profiles.type profiles.bio profiles.avatar createdAt')
            .lean();
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get public profiles only
        const publicProfiles = user.profiles.filter(p => p.isActive);
        
        res.json({
            success: true,
            user: {
                name: user.name,
                profiles: publicProfiles,
                joinedAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user profile'
        });
    }
};

/**
 * Update user profile
 */
const updateUserProfile = async (req, res) => {
    try {
        const { name, bio, avatar } = req.body;
        
        const user = await User.findById(req.user._id);
        
        if (name) {
            user.name = name;
        }
        
        // Update active profile bio
        const activeProfile = user.getActiveProfile();
        if (activeProfile && bio !== undefined) {
            activeProfile.bio = bio;
        }
        
        if (avatar) {
            user.avatar = avatar;
            if (activeProfile) {
                activeProfile.avatar = avatar;
            }
        }
        
        await user.save();
        
        await AuditLog.create({
            user: user._id,
            action: 'profile_updated',
            details: { name, bio },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                name: user.name,
                bio: activeProfile?.bio,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        console.error('Error details:', error.message);
        if (error.name === 'ValidationError') {
            console.error('Validation errors:', Object.values(error.errors).map(e => e.message));
        }
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
};

/**
 * Change user password
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        const user = await User.findById(req.user._id);
        
        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect',
                field: 'currentPassword'
            });
        }
        
        // Validate new password
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: passwordValidation.message,
                field: 'newPassword'
            });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        await AuditLog.create({
            user: user._id,
            action: 'password_changed',
            details: {},
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
};

/**
 * Delete user account
 */
const deleteAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        // Anonymize user data instead of hard delete
        user.name = 'Deleted User';
        user.email = `deleted_${user._id}@deleted.com`;
        user.password = await bcrypt.hash(generateToken(), 10);
        user.isActive = false;
        user.profiles = [];
        
        await user.save();
        
        // Anonymize user's posts
        await Post.updateMany(
            { user: user._id },
            { 
                username: 'Deleted User',
                isAnonymous: true,
                content: '[This post has been removed by user]'
            }
        );
        
        // Anonymize user's comments
        await Comment.updateMany(
            { user: user._id },
            {
                username: 'Deleted User',
                isAnonymous: true,
                content: '[This comment has been removed by user]'
            }
        );
        
        await AuditLog.create({
            user: user._id,
            action: 'account_deleted',
            details: {},
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete account'
        });
    }
};

/**
 * Get user activity feed
 */
const getUserActivity = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        
        // Get user's posts and comments
        const [posts, comments] = await Promise.all([
            Post.find({ user: req.user._id, status: 'active' })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),
            Comment.find({ user: req.user._id, status: 'active' })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean()
        ]);
        
        // Combine and format activities
        const activities = [
            ...posts.map(post => ({
                type: 'post',
                id: post._id,
                content: post.content,
                postType: post.postType,
                createdAt: post.createdAt,
                likeCount: post.likeCount,
                commentCount: post.commentCount
            })),
            ...comments.map(comment => ({
                type: 'comment',
                id: comment._id,
                content: comment.content,
                postId: comment.post,
                createdAt: comment.createdAt,
                likeCount: comment.likeCount
            }))
        ];
        
        // Sort by date
        activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Paginate
        const paginated = activities.slice(skip, skip + limit);
        
        res.json({
            success: true,
            activities: paginated,
            total: activities.length,
            page: parseInt(page),
            pages: Math.ceil(activities.length / limit)
        });
    } catch (error) {
        console.error('Get user activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user activity'
        });
    }
};

/**
 * Get user's company posts
 */
const getUserCompanyPosts = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        
        const posts = await Post.find({ 
            user: req.user._id, 
            postType: 'company_space',
            status: 'active'
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('companyId', 'name slug')
            .populate('departmentId', 'name')
            .lean();
        
        const total = await Post.countDocuments({ 
            user: req.user._id, 
            postType: 'company_space',
            status: 'active'
        });
        
        res.json({
            success: true,
            posts,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Get user company posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get company posts'
        });
    }
};

/**
 * Get user's public posts
 */
const getUserPublicPosts = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        
        const posts = await Post.find({ 
            user: req.user._id, 
            postType: 'public_timeline',
            status: 'active'
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
        
        const total = await Post.countDocuments({ 
            user: req.user._id, 
            postType: 'public_timeline',
            status: 'active'
        });
        
        res.json({
            success: true,
            posts,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Get user public posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get public posts'
        });
    }
};

/**
 * Export user data (GDPR)
 */
const exportUserData = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -emailVerificationToken -resetPasswordToken')
            .lean();
        
        const posts = await Post.find({ user: req.user._id }).lean();
        const comments = await Comment.find({ user: req.user._id }).lean();
        
        const exportData = {
            user: {
                email: user.email,
                name: user.name,
                profiles: user.profiles,
                createdAt: user.createdAt,
                lastActive: user.lastActive
            },
            posts: posts.map(p => ({
                content: p.content,
                postType: p.postType,
                createdAt: p.createdAt,
                likeCount: p.likeCount,
                commentCount: p.commentCount
            })),
            comments: comments.map(c => ({
                content: c.content,
                createdAt: c.createdAt,
                likeCount: c.likeCount
            }))
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=worktalk-data.json');
        
        res.json(exportData);
    } catch (error) {
        console.error('Export data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export data'
        });
    }
};

module.exports = {
    getUserProfile,
    updateUserProfile,
    changePassword,
    deleteAccount,
    getUserActivity,
    getUserCompanyPosts,
    getUserPublicPosts,
    exportUserData
};