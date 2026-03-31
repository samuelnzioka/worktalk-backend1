/**
 * Admin Routes
 * Super admin management endpoints
 */

const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authmiddleware');
const User = require('../models/user');
const Company = require('../models/company');
const Post = require('../models/post');
const AuditLog = require('../models/auditlog');
const { paginate, getClientIP, getUserAgent } = require('../utils/helpers');

/**
 * Get all users (admin only)
 */
router.get('/users', protect, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 50, search } = req.query;
        
        let query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        const total = await User.countDocuments(query);
        const pagination = paginate(page, limit, total);
        
        const users = await User.find(query)
            .select('-password -emailVerificationToken -resetPasswordToken')
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit);
        
        res.json({
            success: true,
            users,
            total,
            page: pagination.page,
            pages: pagination.totalPages
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get users'
        });
    }
});

/**
 * Get all companies (admin only)
 */
router.get('/companies', protect, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 50, search, verified } = req.query;
        
        let query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { emailDomain: { $regex: search, $options: 'i' } }
            ];
        }
        if (verified !== undefined) {
            query.isVerified = verified === 'true';
        }
        
        const total = await Company.countDocuments(query);
        const pagination = paginate(page, limit, total);
        
        const companies = await Company.find(query)
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .select('-inviteCodes -usedColorUsernames -registrationDocument');
        
        res.json({
            success: true,
            companies,
            total,
            page: pagination.page,
            pages: pagination.totalPages
        });
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get companies'
        });
    }
});

/**
 * Verify company (admin only)
 */
router.put('/companies/:companyId/verify', protect, adminOnly, async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        company.isVerified = true;
        company.verifiedAt = new Date();
        company.verifiedBy = req.user._id;
        await company.save();
        
        await AuditLog.create({
            user: req.user._id,
            action: 'company_verified',
            details: { companyId: company._id, name: company.name },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Company verified successfully'
        });
    } catch (error) {
        console.error('Verify company error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify company'
        });
    }
});

/**
 * Get flagged content (admin only)
 */
router.get('/flagged', protect, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const pagination = paginate(page, limit);
        
        const posts = await Post.find({ isFlagged: true, status: 'flagged' })
            .sort({ flaggedAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .populate('user', 'name email')
            .populate('companyId', 'name slug')
            .populate('departmentId', 'name');
        
        const total = await Post.countDocuments({ isFlagged: true, status: 'flagged' });
        
        res.json({
            success: true,
            posts,
            total,
            page: pagination.page,
            pages: pagination.totalPages
        });
    } catch (error) {
        console.error('Get flagged error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get flagged content'
        });
    }
});

/**
 * Get audit logs (admin only)
 */
router.get('/logs', protect, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 50, action, userId } = req.query;
        
        let query = {};
        if (action) query.action = action;
        if (userId) query.user = userId;
        
        const total = await AuditLog.countDocuments(query);
        const pagination = paginate(page, limit, total);
        
        const logs = await AuditLog.find(query)
            .sort({ timestamp: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .populate('user', 'name email');
        
        res.json({
            success: true,
            logs,
            total,
            page: pagination.page,
            pages: pagination.totalPages
        });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get audit logs'
        });
    }
});

/**
 * Get platform stats (admin only)
 */
router.get('/stats', protect, adminOnly, async (req, res) => {
    try {
        const [userCount, companyCount, postCount, flaggedCount, verifiedCompanyCount] = await Promise.all([
            User.countDocuments(),
            Company.countDocuments(),
            Post.countDocuments(),
            Post.countDocuments({ isFlagged: true }),
            Company.countDocuments({ isVerified: true })
        ]);
        
        res.json({
            success: true,
            stats: {
                users: userCount,
                companies: companyCount,
                verifiedCompanies: verifiedCompanyCount,
                posts: postCount,
                flaggedContent: flaggedCount
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get platform stats'
        });
    }
});

module.exports = router;