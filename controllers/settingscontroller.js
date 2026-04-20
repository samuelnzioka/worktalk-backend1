/**
 * Settings Controller
 * Handles user and company settings operations
 */

const usersettings = require('../models/usersettings');
const companysettings = require('../models/companysettings');
const user = require('../models/user');
const auditlog = require('../models/auditlog');
const company = require('../models/company');
const department = require('../models/department');
const companyemployee = require('../models/companyemployee');
const post = require('../models/post');
const comment = require('../models/comment');
const bcrypt = require('bcryptjs');
const { getClientIP, getUserAgent, generateSlug } = require('../utils/helpers');

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

/**
 * Company Settings Controller Functions
 * For Company Admin users only
 */

/**
 * Get company general settings (Company Admin only)
 */
const getCompanyGeneralSettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const companyDoc = await company.findById(companyId).select('-inviteCodes -usedColorUsernames');
        
        if (!companyDoc) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        res.json({
            success: true,
            company: {
                id: companyDoc._id,
                name: companyDoc.name,
                slug: companyDoc.slug,
                industry: companyDoc.industry,
                description: companyDoc.description,
                logo: companyDoc.logo,
                banner: companyDoc.banner,
                website: companyDoc.website,
                emailDomain: companyDoc.emailDomain,
                contactEmail: companyDoc.contactEmail,
                contactPhone: companyDoc.contactPhone,
                location: companyDoc.location,
                employeeCount: companyDoc.employeeCount,
                departmentCount: companyDoc.departmentCount,
                totalPosts: companyDoc.totalPosts,
                isVerified: companyDoc.isVerified
            }
        });
    } catch (error) {
        console.error('Get company general settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get company settings'
        });
    }
};

/**
 * Update company general settings (Company Admin only)
 */
const updateCompanyGeneralSettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        const {
            name,
            industry,
            description,
            logo,
            banner,
            website,
            contactEmail,
            contactPhone,
            location
        } = req.body;
        
        const companyDoc = await company.findById(companyId);
        
        if (!companyDoc) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        // Update fields
        if (name) {
            companyDoc.name = name;
            companyDoc.slug = generateSlug(name);
        }
        if (industry) companyDoc.industry = industry;
        if (description !== undefined) companyDoc.description = description;
        if (logo) companyDoc.logo = logo;
        if (banner) companyDoc.banner = banner;
        if (website) companyDoc.website = website;
        if (contactEmail) companyDoc.contactEmail = contactEmail;
        if (contactPhone) companyDoc.contactPhone = contactPhone;
        if (location) companyDoc.location = location;
        
        await companyDoc.save();
        
        await auditlog.create({
            user: req.user._id,
            action: 'company_settings_updated',
            details: { companyId, updatedFields: Object.keys(req.body) },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Company settings updated successfully',
            company: {
                id: companyDoc._id,
                name: companyDoc.name,
                slug: companyDoc.slug,
                industry: companyDoc.industry,
                description: companyDoc.description,
                logo: companyDoc.logo,
                banner: companyDoc.banner,
                website: companyDoc.website,
                contactEmail: companyDoc.contactEmail,
                contactPhone: companyDoc.contactPhone,
                location: companyDoc.location
            }
        });
    } catch (error) {
        console.error('Update company general settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update company settings'
        });
    }
};

/**
 * Get all departments for a company (Company Admin only)
 */
const getCompanyDepartments = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const departments = await department.find({ companyId, isActive: true })
            .sort({ order: 1, name: 1 })
            .populate('headOfDepartment', 'name email');
        
        res.json({
            success: true,
            departments
        });
    } catch (error) {
        console.error('Get company departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get departments'
        });
    }
};

/**
 * Create a new department (Company Admin only)
 */
const createDepartment = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { name, description, icon, headOfDepartment } = req.body;
        
        // Check if department already exists
        const existingDept = await department.findOne({ name, companyId });
        if (existingDept) {
            return res.status(400).json({
                success: false,
                message: 'Department already exists',
                field: 'name'
            });
        }
        
        // Get current department count for ordering
        const deptCount = await department.countDocuments({ companyId });
        
        const newDepartment = await department.create({
            name,
            companyId,
            description,
            icon: icon || '\u{1F4C1}',
            headOfDepartment,
            order: deptCount,
            isActive: true
        });
        
        // Update company department count
        await company.findByIdAndUpdate(companyId, { $inc: { departmentCount: 1 } });
        
        await auditlog.create({
            user: req.user._id,
            action: 'department_created',
            details: { companyId, departmentId: newDepartment._id, name },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.status(201).json({
            success: true,
            message: 'Department created successfully',
            department: newDepartment
        });
    } catch (error) {
        console.error('Create department error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create department'
        });
    }
};

/**
 * Update a department (Company Admin only)
 */
const updateDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { name, description, icon, headOfDepartment, order, isActive } = req.body;
        
        const departmentDoc = await department.findById(departmentId);
        
        if (!departmentDoc) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }
        
        if (name) departmentDoc.name = name;
        if (description !== undefined) departmentDoc.description = description;
        if (icon) departmentDoc.icon = icon;
        if (headOfDepartment) departmentDoc.headOfDepartment = headOfDepartment;
        if (order !== undefined) departmentDoc.order = order;
        if (isActive !== undefined) departmentDoc.isActive = isActive;
        
        await departmentDoc.save();
        
        await auditlog.create({
            user: req.user._id,
            action: 'department_updated',
            details: { departmentId, updates: Object.keys(req.body) },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Department updated successfully',
            department: departmentDoc
        });
    } catch (error) {
        console.error('Update department error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update department'
        });
    }
};

/**
 * Delete a department (Company Admin only)
 */
const deleteDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        
        const departmentDoc = await department.findById(departmentId);
        
        if (!departmentDoc) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }
        
        // Check if department has employees
        const employeeCount = await companyemployee.countDocuments({ 
            department: departmentId, 
            isActive: true 
        });
        
        if (employeeCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete department with active employees. Reassign employees first.'
            });
        }
        
        // Soft delete
        departmentDoc.isActive = false;
        await departmentDoc.save();
        
        // Update company department count
        await company.findByIdAndUpdate(departmentDoc.companyId, { $inc: { departmentCount: -1 } });
        
        await auditlog.create({
            user: req.user._id,
            action: 'department_deleted',
            details: { departmentId, name: departmentDoc.name },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Department deleted successfully'
        });
    } catch (error) {
        console.error('Delete department error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete department'
        });
    }
};

/**
 * Reorder departments (Company Admin only)
 */
const reorderDepartments = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { departmentOrders } = req.body; // [{ id, order }]
        
        for (const item of departmentOrders) {
            await department.findByIdAndUpdate(item.id, { order: item.order });
        }
        
        await auditlog.create({
            user: req.user._id,
            action: 'departments_reordered',
            details: { companyId },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Departments reordered successfully'
        });
    } catch (error) {
        console.error('Reorder departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reorder departments'
        });
    }
};

/**
 * Get moderation settings (Company Admin only)
 */
const getModerationSettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        let settings = await companysettings.findOne({ company: companyId });
        
        if (!settings) {
            settings = {
                moderation: {
                    postModeration: 'auto_approve',
                    commentModeration: 'auto_approve',
                    flagThreshold: 3,
                    autoHideFlagged: true,
                    blockedKeywords: [],
                    blockedDomains: []
                }
            };
        }
        
        res.json({
            success: true,
            settings: settings.moderation || {
                postModeration: 'auto_approve',
                commentModeration: 'auto_approve',
                flagThreshold: 3,
                autoHideFlagged: true,
                blockedKeywords: [],
                blockedDomains: []
            }
        });
    } catch (error) {
        console.error('Get moderation settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get moderation settings'
        });
    }
};

/**
 * Update moderation settings (Company Admin only)
 */
const updateModerationSettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { postModeration, commentModeration, flagThreshold, autoHideFlagged, blockedKeywords, blockedDomains } = req.body;
        
        let settings = await companysettings.findOne({ company: companyId });
        
        if (!settings) {
            settings = new companysettings({ company: companyId });
        }
        
        settings.moderation = {
            postModeration: postModeration || settings.moderation?.postModeration || 'auto_approve',
            commentModeration: commentModeration || settings.moderation?.commentModeration || 'auto_approve',
            flagThreshold: flagThreshold || settings.moderation?.flagThreshold || 3,
            autoHideFlagged: autoHideFlagged !== undefined ? autoHideFlagged : true,
            blockedKeywords: blockedKeywords || settings.moderation?.blockedKeywords || [],
            blockedDomains: blockedDomains || settings.moderation?.blockedDomains || []
        };
        
        await settings.save();
        
        await auditlog.create({
            user: req.user._id,
            action: 'moderation_settings_updated',
            details: { companyId },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Moderation settings updated successfully',
            settings: settings.moderation
        });
    } catch (error) {
        console.error('Update moderation settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update moderation settings'
        });
    }
};

/**
 * Get flagged content for company (Company Admin only)
 */
const getFlaggedContent = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        
        const flaggedPosts = await post.find({ 
            companyId, 
            isFlagged: true,
            status: 'flagged'
        })
            .sort({ flaggedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('user', 'name email')
            .populate('departmentId', 'name');
        
        const total = await post.countDocuments({ companyId, isFlagged: true, status: 'flagged' });
        
        res.json({
            success: true,
            posts: flaggedPosts,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Get flagged content error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get flagged content'
        });
    }
};

/**
 * Resolve flagged content (Company Admin only)
 */
const resolveFlaggedContent = async (req, res) => {
    try {
        const { postId } = req.params;
        const { action } = req.body; // 'keep' or 'remove'
        
        const postDoc = await post.findById(postId);
        
        if (!postDoc) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }
        
        if (action === 'keep') {
            postDoc.isFlagged = false;
            postDoc.flagReason = null;
            postDoc.flaggedBy = null;
            postDoc.flaggedAt = null;
            postDoc.status = 'active';
        } else if (action === 'remove') {
            postDoc.status = 'removed';
        }
        
        await postDoc.save();
        
        await auditlog.create({
            user: req.user._id,
            action: 'flagged_content_resolved',
            details: { postId, action },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: `Post ${action === 'keep' ? 'kept' : 'removed'} successfully` 
        });
    } catch (error) {
        console.error('Resolve flagged content error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resolve flagged content'
        });
    }
};

/**
 * Get employee management settings (Company Admin only)
 */
const getEmployeeManagementSettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        let settings = await companysettings.findOne({ company: companyId });
        
        if (!settings) {
            settings = {
                employeeManagement: {
                    employeeVerificationMethod: 'invite_code',
                    autoApproveEmployees: false,
                    allowEmployeeRegistration: false,
                    employeeDepartureAction: 'anonymize',
                    departmentAssignment: 'admin'
                }
            };
        }
        
        res.json({
            success: true,
            settings: settings.employeeManagement || {
                employeeVerificationMethod: 'invite_code',
                autoApproveEmployees: false,
                allowEmployeeRegistration: false,
                employeeDepartureAction: 'anonymize',
                departmentAssignment: 'admin'
            }
        });
    } catch (error) {
        console.error('Get employee management settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get employee management settings'
        });
    }
};

/**
 * Update employee management settings (Company Admin only)
 */
const updateEmployeeManagementSettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { employeeVerificationMethod, autoApproveEmployees, allowEmployeeRegistration, employeeDepartureAction, departmentAssignment } = req.body;
        
        let settings = await companysettings.findOne({ company: companyId });
        
        if (!settings) {
            settings = new companysettings({ company: companyId });
        }
        
        settings.employeeManagement = {
            employeeVerificationMethod: employeeVerificationMethod || settings.employeeManagement?.employeeVerificationMethod || 'invite_code',
            autoApproveEmployees: autoApproveEmployees !== undefined ? autoApproveEmployees : false,
            allowEmployeeRegistration: allowEmployeeRegistration !== undefined ? allowEmployeeRegistration : false,
            employeeDepartureAction: employeeDepartureAction || settings.employeeManagement?.employeeDepartureAction || 'anonymize',
            departmentAssignment: departmentAssignment || settings.employeeManagement?.departmentAssignment || 'admin'
        };
        
        await settings.save();
        
        await auditlog.create({
            user: req.user._id,
            action: 'employee_management_settings_updated',
            details: { companyId },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Employee management settings updated successfully',
            settings: settings.employeeManagement
        });
    } catch (error) {
        console.error('Update employee management settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update employee management settings'
        });
    }
};

/**
 * Get company privacy settings (Company Admin only)
 */
const getCompanyPrivacySettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        let settings = await companysettings.findOne({ company: companyId });
        
        if (!settings) {
            settings = {
                privacy: {
                    companySpaceVisibility: 'public',
                    showEmployeeCount: true,
                    showDepartmentDetails: true,
                    allowExternalSharing: true
                }
            };
        }
        
        res.json({
            success: true,
            settings: settings.privacy || {
                companySpaceVisibility: 'public',
                showEmployeeCount: true,
                showDepartmentDetails: true,
                allowExternalSharing: true
            }
        });
    } catch (error) {
        console.error('Get company privacy settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get company privacy settings'
        });
    }
};

/**
 * Update company privacy settings (Company Admin only)
 */
const updateCompanyPrivacySettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { companySpaceVisibility, showEmployeeCount, showDepartmentDetails, allowExternalSharing } = req.body;
        
        let settings = await companysettings.findOne({ company: companyId });
        
        if (!settings) {
            settings = new companysettings({ company: companyId });
        }
        
        settings.privacy = {
            companySpaceVisibility: companySpaceVisibility || settings.privacy?.companySpaceVisibility || 'public',
            showEmployeeCount: showEmployeeCount !== undefined ? showEmployeeCount : true,
            showDepartmentDetails: showDepartmentDetails !== undefined ? showDepartmentDetails : true,
            allowExternalSharing: allowExternalSharing !== undefined ? allowExternalSharing : true
        };
        
        await settings.save();
        
        await auditlog.create({
            user: req.user._id,
            action: 'company_privacy_settings_updated',
            details: { companyId },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Company privacy settings updated successfully',
            settings: settings.privacy
        });
    } catch (error) {
        console.error('Update company privacy settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update company privacy settings'
        });
    }
};

/**
 * Get company analytics (Company Admin only)
 */
const getCompanyAnalytics = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        // Get date ranges
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);
        const startOfMonth = new Date(now);
        startOfMonth.setMonth(now.getMonth() - 1);
        
        // Get counts
        const [
            totalEmployees,
            totalDepartments,
            totalPosts,
            totalComments,
            totalLikes,
            weeklyPosts,
            monthlyPosts,
            topDepartments,
            topEmployees
        ] = await Promise.all([
            companyemployee.countDocuments({ company: companyId, isVerified: true, isActive: true }),
            department.countDocuments({ companyId, isActive: true }),
            post.countDocuments({ companyId, postType: 'company_space', status: 'active' }),
            comment.countDocuments({}),
            post.aggregate([{ $match: { companyId } }, { $group: { _id: null, total: { $sum: '$likeCount' } } }]),
            post.countDocuments({ companyId, createdAt: { $gte: startOfWeek }, postType: 'company_space' }),
            post.countDocuments({ companyId, createdAt: { $gte: startOfMonth }, postType: 'company_space' }),
            post.aggregate([
                { $match: { companyId, postType: 'company_space' } },
                { $group: { _id: '$departmentId', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } }
            ]),
            post.aggregate([
                { $match: { companyId, postType: 'company_space' } },
                { $group: { _id: '$user', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } }
            ])
        ]);
        
        // Calculate engagement rate
        const engagementRate = totalPosts > 0 ? ((totalComments + totalLikes[0]?.total || 0) / totalPosts).toFixed(2) : 0;
        
        res.json({
            success: true,
            analytics: {
                overview: {
                    totalEmployees,
                    totalDepartments,
                    totalPosts,
                    totalComments: totalComments,
                    totalLikes: totalLikes[0]?.total || 0,
                    engagementRate: parseFloat(engagementRate)
                },
                trends: {
                    weeklyPosts,
                    monthlyPosts,
                    weeklyGrowth: weeklyPosts > 0 ? ((weeklyPosts - monthlyPosts / 4) / (monthlyPosts / 4) * 100).toFixed(1) : 0
                },
                topDepartments: topDepartments.map(d => ({
                    name: d.department[0]?.name || 'Unknown',
                    postCount: d.count
                })),
                topEmployees: topEmployees.map(e => ({
                    name: e.user[0]?.name || 'Anonymous',
                    postCount: e.count
                }))
            }
        });
    } catch (error) {
        console.error('Get company analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get company analytics'
        });
    }
};

/**
 * Export company data (Company Admin only)
 */
const exportCompanyData = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const companyDoc = await company.findById(companyId);
        const departmentsList = await department.find({ companyId, isActive: true });
        const employees = await companyemployee.find({ company: companyId, isVerified: true })
            .populate('user', 'name email')
            .populate('department', 'name');
        const postsList = await post.find({ companyId, postType: 'company_space' })
            .populate('user', 'name email')
            .populate('departmentId', 'name')
            .sort({ createdAt: -1 });
        
        const exportData = {
            company: {
                name: companyDoc.name,
                industry: companyDoc.industry,
                description: companyDoc.description,
                website: companyDoc.website,
                emailDomain: companyDoc.emailDomain,
                createdAt: companyDoc.createdAt,
                employeeCount: companyDoc.employeeCount,
                totalPosts: companyDoc.totalPosts
            },
            departments: departmentsList.map(d => ({
                name: d.name,
                description: d.description,
                employeeCount: d.employeeCount,
                totalPosts: d.totalPosts,
                createdAt: d.createdAt
            })),
            employees: employees.map(e => ({
                name: e.user.name,
                email: e.user.email,
                department: e.department?.name,
                joinedAt: e.joinedAt,
                isActive: e.isActive
            })),
            posts: postsList.map(p => ({
                content: p.content,
                department: p.departmentId?.name,
                isAnonymous: p.isAnonymous,
                likeCount: p.likeCount,
                commentCount: p.commentCount,
                createdAt: p.createdAt
            }))
        };
        
        await auditlog.create({
            user: req.user._id,
            action: 'company_data_exported',
            details: { companyId },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=company-${companyDoc.slug}-data.json`);
        res.json(exportData);
    } catch (error) {
        console.error('Export company data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export company data'
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
    deleteaccount,
    getCompanyGeneralSettings,
    updateCompanyGeneralSettings,
    getCompanyDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    reorderDepartments,
    getModerationSettings,
    updateModerationSettings,
    getFlaggedContent,
    resolveFlaggedContent,
    getEmployeeManagementSettings,
    updateEmployeeManagementSettings,
    getCompanyPrivacySettings,
    updateCompanyPrivacySettings,
    getCompanyAnalytics,
    exportCompanyData
};