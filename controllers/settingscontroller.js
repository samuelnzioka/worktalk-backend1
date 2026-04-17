/**
 * Settings Controller
 * Handles user and company settings operations
 */

const usersettings = require('../models/usersettings');
const companysettings = require('../models/companysettings');
const user = require('../models/user');
const auditlog = require('../models/auditlog');
const bcrypt = require('bcryptjs');
const { getClientIP, getUserAgent } = require('../utils/helpers');

/**
 * Get user settings
 */
const getusersettings = async (req, res) => {
    try {
        let settings = await usersettings.findOne({ user: req.user._id });
        
        if (!settings) {
            // Create default settings
            settings = await usersettings.create({
                user: req.user._id,
                appearance: { theme: 'light', fontSize: 'medium', compactMode: false, animations: true },
                notifications: {
                    email: { enabled: true, newComment: true, postLike: true, mention: true, companyUpdate: false, weeklyDigest: true },
                    push: { enabled: false, newComment: true, postLike: true, mention: true },
                    inApp: { newComment: true, postLike: true, mention: true, inviteReceived: true }
                },
                privacy: { profileVisibility: 'public', showEmail: false, showActivityStatus: true, showInSearch: true, allowDirectMessages: 'everyone' },
                content: { defaultTab: 'companies', postsPerPage: 20, sortCommentsBy: 'newest', hideFlaggedContent: true, anonymousPostingDefault: 'ask_each_time' },
                security: { twoFactorEnabled: false, loginNotifications: true, sessionTimeout: 30 }
            });
        }
        
        res.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('Get user settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get settings'
        });
    }
};

/**
 * Update user settings
 */
const updateusersettings = async (req, res) => {
    try {
        const { section, settings } = req.body;
        
        let usersettingsdoc = await usersettings.findOne({ user: req.user._id });
        
        if (!usersettingsdoc) {
            usersettingsdoc = new usersettings({ user: req.user._id });
        }
        
        // Update specific section
        if (section && settings) {
            usersettingsdoc[section] = {
                ...usersettingsdoc[section],
                ...settings
            };
        }
        
        await usersettingsdoc.save();
        
        await auditlog.create({
            user: req.user._id,
            action: 'settings_updated',
            details: { section },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Settings updated successfully',
            settings: usersettingsdoc
        });
    } catch (error) {
        console.error('Update user settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings'
        });
    }
};

/**
 * Update user profile (name, bio, etc.)
 */
const updateuserprofile = async (req, res) => {
    try {
        const { name, bio, username, avatar } = req.body;
        
        const userdoc = await user.findById(req.user._id);
        
        if (name) {
            userdoc.name = name;
        }
        
        // Update active profile's bio and username
        const activeProfile = userdoc.getActiveProfile();
        if (activeProfile) {
            if (bio !== undefined) activeProfile.bio = bio;
            if (username) activeProfile.username = username;
            if (avatar) activeProfile.avatar = avatar;
        }
        
        await userdoc.save();
        
        await auditlog.create({
            user: req.user._id,
            action: 'profile_updated',
            details: { name, bio, username },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        const userData = userdoc.toJSON();
        delete userData.password;
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: userData
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
};

/**
 * Change user password
 */
const changepassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        const userdoc = await user.findById(req.user._id);
        
        // Verify current password
        const isPasswordValid = await userdoc.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect',
                field: 'currentPassword'
            });
        }
        
        // Validate new password
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters',
                field: 'newPassword'
            });
        }
        
        // Update password
        userdoc.password = newPassword;
        await userdoc.save();
        
        await auditlog.create({
            user: req.user._id,
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
 * Get company settings (company admin only)
 */
const getcompanysettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        let settings = await companysettings.findOne({ company: companyId });
        
        if (!settings) {
            // Create default company settings
            settings = await companysettings.create({
                company: companyId,
                general: {
                    allowAnonymousPosts: true,
                    allowEmployeeRegistration: false,
                    employeeVerificationMethod: 'invite_code'
                },
                moderation: {
                    postModeration: 'auto_approve',
                    commentModeration: 'auto_approve',
                    flagThreshold: 3,
                    autoHideFlagged: true,
                    blockedKeywords: [],
                    blockedDomains: []
                },
                privacy: {
                    companySpaceVisibility: 'public',
                    showEmployeeCount: true,
                    showDepartmentDetails: true,
                    allowExternalSharing: true
                }
            });
        }
        
        res.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('Get company settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get company settings'
        });
    }
};

/**
 * Update company settings (company admin only)
 */
const updatecompanysettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { section, settings } = req.body;
        
        let companysettingsdoc = await companysettings.findOne({ company: companyId });
        
        if (!companysettingsdoc) {
            companysettingsdoc = new companysettings({ company: companyId });
        }
        
        if (section && settings) {
            companysettingsdoc[section] = {
                ...companysettingsdoc[section],
                ...settings
            };
        }
        
        await companysettingsdoc.save();
        
        await auditlog.create({
            user: req.user._id,
            action: 'company_settings_updated',
            details: { companyId, section },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Company settings updated successfully',
            settings: companysettingsdoc
        });
    } catch (error) {
        console.error('Update company settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update company settings'
        });
    }
};

/**
 * Delete user account
 */
const deleteaccount = async (req, res) => {
    try {
        const { password } = req.body;
        
        const userdoc = await user.findById(req.user._id);
        
        // Verify password
        const isPasswordValid = await userdoc.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Password is incorrect'
            });
        }
        
        // Anonymize user data
        userdoc.name = 'Deleted User';
        userdoc.email = `deleted_${userdoc._id}@deleted.ajiratalks.com`;
        userdoc.isActive = false;
        userdoc.profiles = [];
        await userdoc.save();
        
        await auditlog.create({
            user: userdoc._id,
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

module.exports = {
    getusersettings,
    updateusersettings,
    updateuserprofile,
    changepassword,
    getcompanysettings,
    updatecompanysettings,
    deleteaccount
};