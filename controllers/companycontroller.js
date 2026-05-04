/**
 * Company Controller
 * Handles company CRUD operations and public company data
 */

const mongoose = require('mongoose');
const Company = require('../models/company');
const Department = require('../models/department');
const Post = require('../models/post');
const CompanyEmployee = require('../models/companyemployee');
const User = require('../models/user');
const AuditLog = require('../models/auditlog');
const { sendCompanyVerificationEmail } = require('../services/emailservice');
const { generateTokenPair } = require('../config/auth');
const { generateSlug, getClientIP, getUserAgent, paginate } = require('../utils/helpers');
const { validateCompanyName, validateEmailDomain, validateDepartmentName } = require('../utils/validators');

/**
 * Get all companies (public)
 */
const getCompanies = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, industry } = req.query;
        
        let query = { isVerified: true, isActive: true };
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { industry: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (industry) {
            query.industry = industry;
        }
        
        const total = await Company.countDocuments(query);
        const pagination = paginate(page, limit, total);
        
        const companies = await Company.find(query)
            .sort({ name: 1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .select('name slug industry icon logo description employeeCount departmentCount totalPosts');
        
        // Get department counts for each company
        const companiesWithStats = await Promise.all(companies.map(async (company) => {
            const departmentCount = await Department.countDocuments({ companyId: company._id, isActive: true });
            return {
                ...company.toObject(),
                departmentCount
            };
        }));
        
        // Get total departments and posts across all companies
        const totalDepartments = await Department.countDocuments({ isActive: true });
        const totalPosts = await Post.countDocuments({ postType: 'company_space', status: 'active' });
        
        res.json({
            success: true,
            companies: companiesWithStats,
            total,
            totalDepartments,
            totalPosts,
            page: pagination.page,
            pages: pagination.totalPages,
            hasNextPage: pagination.hasNextPage,
            hasPrevPage: pagination.hasPrevPage,
            nextPage: pagination.nextPage,
            prevPage: pagination.prevPage
        });
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get companies'
        });
    }
};

/**
 * Get company by slug (public)
 */
const getCompanyBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        
        const company = await Company.findOne({ slug, isActive: true })
            .select('-inviteCodes -usedColorUsernames -registrationDocument');
        
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        const departmentCount = await Department.countDocuments({ companyId: company._id, isActive: true });
        const postCount = await Post.countDocuments({ companyId: company._id, postType: 'company_space', status: 'active' });
        
        res.json({
            success: true,
            company: {
                ...company.toObject(),
                departmentCount,
                postCount
            }
        });
    } catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get company'
        });
    }
};

/**
 * Register a new company (public)
 */
const registerCompany = async (req, res) => {
    try {
        const {
            name,
            industry,
            emailDomain,
            companyEmail,
            description,
            website,
            logo,
            contactName,
            contactEmail,
            contactPhone,
            adminPhone,
            departments,
            adminPassword,
            emailVerificationCode,
            taxId,
            registrationNumber,
            country,
            yearFounded,
            revenueRange,
            streetAddress,
            city,
            postalCode,
            jobTitle
        } = req.body;
        
        // Validate company name
        const nameValidation = validateCompanyName(name);
        if (!nameValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: nameValidation.message,
                field: 'name'
            });
        }
        
        // Auto-extract emailDomain if not provided and not a common provider
        const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'aol.com', 'icloud.com'];
        let resolvedEmailDomain = emailDomain;
        if (!resolvedEmailDomain) {
            const domainSource = companyEmail || contactEmail;
            if (domainSource && domainSource.includes('@')) {
                const extractedDomain = domainSource.split('@')[1].toLowerCase();
                // Only use as emailDomain if it's not a common provider
                if (!commonProviders.includes(extractedDomain)) {
                    resolvedEmailDomain = extractedDomain;
                }
            }
        }
        
        // Validate email domain if provided
        if (resolvedEmailDomain) {
            const domainValidation = validateEmailDomain(resolvedEmailDomain);
            if (!domainValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: domainValidation.message,
                    field: 'emailDomain'
                });
            }
        }
        
        // Check if company exists by name or emailDomain (only check emailDomain if provided)
        const existingQuery = [{ name }];
        if (resolvedEmailDomain) {
            existingQuery.push({ emailDomain: resolvedEmailDomain });
        }
        const existingCompany = await Company.findOne({ $or: existingQuery });
        if (existingCompany) {
            return res.status(400).json({
                success: false,
                message: 'Company with this name or email domain already exists',
                field: existingCompany.name === name ? 'name' : 'emailDomain'
            });
        }
        
        // Accept any 6-digit email verification code (email sending not yet implemented)
        if (!emailVerificationCode || !/^[0-9]{6}$/.test(emailVerificationCode)) {
            return res.status(400).json({
                success: false,
                message: 'Valid 6-digit email verification code is required',
                field: 'emailVerificationCode'
            });
        }
        
        // Parse departments
        let departmentsList = [];
        try {
            departmentsList = JSON.parse(departments);
        } catch {
            return res.status(400).json({
                success: false,
                message: 'Invalid departments format',
                field: 'departments'
            });
        }
        
        if (!departmentsList || departmentsList.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one department is required',
                field: 'departments'
            });
        }
        
        // Validate departments
        for (const dept of departmentsList) {
            const deptValidation = validateDepartmentName(dept);
            if (!deptValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Department "${dept}": ${deptValidation.message}`,
                    field: 'departments'
                });
            }
        }
        
        // Get logged-in public user — they become company admin
        const publicUser = req.user;
        console.log('=== COMPANY REGISTRATION DEBUG ===');
        console.log('Raw req.user:', JSON.stringify({ id: req.user?._id, email: req.user?.email, name: req.user?.name, role: req.user?.role }, null, 2));
        console.log('Request headers auth:', req.headers.authorization?.substring(0, 50) + '...');
        console.log('Form contact name:', contactName);
        console.log('Form contact email:', contactEmail);
        console.log('=================================');

        // FIX: Use the logged-in user's email and name directly to prevent frontend token cache issues
        // The form values can be different (e.g., company-specific contact), but the admin will always be the logged-in user
        const actualContactEmail = publicUser.email;
        const actualContactName = publicUser.name;
        
        console.log('Using logged-in user info:', { email: actualContactEmail, name: actualContactName });
        
        // Create company
        let company;
        try {
            company = await Company.create({
                name,
                slug: generateSlug(name),
                industry,
                emailDomain: resolvedEmailDomain ? resolvedEmailDomain.toLowerCase() : undefined,
                companyEmail: companyEmail ? companyEmail.toLowerCase() : undefined,
                description,
                website,
                logo,
                contactName: actualContactName,
                contactEmail: actualContactEmail,
                contactPhone,
                taxId,
                registrationNumber,
                country,
                yearFounded,
                revenueRange,
                streetAddress,
                city,
                postalCode,
                jobTitle,
                isVerified: true,
                verifiedAt: new Date(),
                verifiedBy: publicUser._id,
                emailVerificationCode,
                isEmailVerified: true,
                settings: {
                    requireVerification: true,
                    autoApproveEmployees: false,
                    moderation: {
                        postModeration: 'auto_approve',
                        allowAnonymousPosts: true,
                        commentModeration: 'auto_approve',
                        flaggedContentReview: 'manual',
                        blockedKeywords: [],
                        autoSuspendAfterFlags: 5,
                        maxCommentsPerDay: 0,
                        maxPostsPerDay: 0
                    },
                    employeeManagement: {
                        verificationMethod: 'invite_code',
                        allowEmployeeRegistration: true,
                        employeeDepartureHandling: 'anonymize',
                        departmentAssignment: 'employee_chooses'
                    },
                    privacy: {
                        companySpaceVisibility: 'employees_only',
                        showEmployeeCount: true,
                        showDepartmentDetails: true,
                        allowExternalSharing: false
                    }
                }
            });
        } catch (err) {
            console.error('Step FAILED: Create company:', err.message);
            return res.status(400).json({ success: false, message: 'Failed to create company: ' + err.message, step: 'create_company' });
        }
        
        // Create departments
        try {
            for (let i = 0; i < departmentsList.length; i++) {
                const deptSlug = departmentsList[i]
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');
                await Department.create({
                    name: departmentsList[i],
                    slug: deptSlug,
                    companyId: company._id,
                    order: i,
                    isActive: true
                });
            }
        } catch (err) {
            console.error('Step FAILED: Create departments:', err.message);
            // Clean up: remove the company we just created since departments failed
            try { await Company.findByIdAndDelete(company._id); } catch (e) { console.error('Cleanup company failed:', e.message); }
            return res.status(400).json({ success: false, message: 'Failed to create departments: ' + err.message, step: 'create_departments' });
        }
        
        // Update department count
        company.departmentCount = departmentsList.length;
        try {
            await company.save();
        } catch (err) {
            console.error('Step FAILED: Update department count:', err.message);
            return res.status(400).json({ success: false, message: 'Failed to update department count: ' + err.message, step: 'update_department_count' });
        }
        // Get first department for admin assignment
        const firstDepartment = await Department.findOne({ companyId: company._id }).sort({ order: 1 });
        
        // Create CompanyEmployee record for the public user (admin + employee)
        try {
            await CompanyEmployee.create({
                user: publicUser._id,
                company: company._id,
                department: firstDepartment._id,
                position: jobTitle,
                isVerified: true,
                verificationMethod: 'admin',
                verifiedAt: new Date(),
                verifiedBy: publicUser._id,
                isActive: true
            });
        } catch (err) {
            console.error('Step FAILED: Create company employee record:', err.message);
            return res.status(400).json({ success: false, message: 'Failed to create company employee record: ' + err.message, step: 'create_company_employee' });
        }
        
        // Set admin ID on company (employeeCount auto-incremented by CompanyEmployee post-save hook)
        company.adminId = publicUser._id;
        await company.save();
        
        // Update the public user: add employee profile for this company and set role to company_admin
        try {
            await User.findByIdAndUpdate(publicUser._id, {
                $set: { role: 'company_admin' },
                $push: {
                    profiles: {
                        type: 'employee',
                        username: publicUser.name.replace(/\s+/g, '').toLowerCase(),
                        companyId: company._id,
                        departmentId: firstDepartment._id,
                        isActive: true
                    }
                }
            });
        } catch (err) {
            console.error('Step FAILED: Add employee profile to user:', err.message);
            // Non-fatal, the CompanyEmployee record is the primary link
        }
        
        // Re-fetch user with updated profiles and role for token generation
        const updatedUser = await User.findById(publicUser._id);
        
        // Generate tokens for auto-login (with company context in token)
        const { accessToken, refreshToken } = generateTokenPair({
            ...updatedUser.toObject(),
            role: 'company_admin',
            companyId: company._id
        });
        
        // Prepare user data for response
        const userData = updatedUser.toJSON();
        delete userData.password;
        delete userData.emailVerificationToken;
        delete userData.resetPasswordToken;
        
        // Send verification email to admin (non-blocking)
        sendCompanyVerificationEmail(publicUser.email, name).catch(err => 
            console.error('Failed to send company verification email:', err)
        );
        
        // Log registration
        await AuditLog.log({
            userId: publicUser._id,
            action: 'company_created',
            details: { companyId: company._id, name, emailDomain: resolvedEmailDomain, departments: departmentsList.length, adminUserId: publicUser._id },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.status(201).json({
            success: true,
            message: 'Company registered successfully!',
            accessToken,
            refreshToken,
            user: userData,
            companyId: company._id,
            redirectTo: '/company-dashboard.html'
        });
    } catch (error) {
        console.error('Company registration error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to register company',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get company departments (public)
 */
const getCompanyDepartments = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const departments = await Department.find({ companyId, isActive: true })
            .sort({ order: 1, name: 1 })
            .select('name slug icon description headOfDepartment isHidden order employeeCount totalPosts');
        
        res.json({
            success: true,
            departments
        });
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get departments'
        });
    }
};

/**
 * Get company stats (company admin)
 */
const getCompanyStats = async (req, res) => {
    try {
        // Get company ID from multiple sources
        let companyId = req.params.companyId;
        
        // If not in params, check query
        if (!companyId) {
            companyId = req.query.companyId;
        }
        
        // If still not found, get from user's profile
        if (!companyId && req.user) {
            const activeProfile = req.user.getActiveProfile();
            if (activeProfile && activeProfile.companyId) {
                companyId = activeProfile.companyId;
            }
        }
        
        // If still no company ID, check if user is company admin
        if (!companyId && req.user.role === 'company_admin') {
            // Find company where user is admin
            const company = await Company.findOne({ adminId: req.user._id });
            if (company) {
                companyId = company._id;
            }
        }
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID required'
            });
        }
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        // Check if user has access to this company
        const isCompanyAdmin = company.adminId?.toString() === req.user._id.toString();
        const isEmployee = await CompanyEmployee.findOne({
            user: req.user._id,
            company: companyId,
            isVerified: true,
            isActive: true
        });
        
        if (!isCompanyAdmin && !isEmployee) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        const employeeCount = await CompanyEmployee.countDocuments({ company: companyId, isVerified: true, isActive: true });
        const departmentCount = await Department.countDocuments({ companyId, isActive: true });
        const postCount = await Post.countDocuments({ companyId, postType: 'company_space', status: 'active' });
        const flaggedCount = await Post.countDocuments({ companyId, isFlagged: true, status: 'flagged' });
        
        res.json({
            success: true,
            stats: {
                employeeCount,
                departmentCount,
                postCount,
                flaggedCount
            },
            company: {
                id: company._id,
                name: company.name,
                slug: company.slug,
                industry: company.industry,
                icon: company.icon,
                isVerified: company.isVerified,
                settings: company.settings
            }
        });
    } catch (error) {
        console.error('Get company stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get company stats'
        });
    }
};

/**
 * Get company employees (company admin)
 */
const getCompanyEmployees = async (req, res) => {
    try {
        const companyId = req.params.companyId || req.user.companyId;
        const { search, page = 1, limit = 50 } = req.query;
        
        let query = { company: companyId, isActive: true };
        
        if (search) {
            const users = await User.find({ 
                name: { $regex: search, $options: 'i' },
                'profiles.companyId': companyId
            }).select('_id');
            query.user = { $in: users.map(u => u._id) };
        }
        
        const total = await CompanyEmployee.countDocuments(query);
        const pagination = paginate(page, limit, total);
        
        const employees = await CompanyEmployee.find(query)
            .populate('user', 'name email avatar')
            .populate('department', 'name')
            .sort({ joinedAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit);
        
        const formattedEmployees = employees.map(emp => ({
            id: emp.user._id,
            name: emp.user.name,
            email: emp.user.email,
            avatar: emp.user.avatar,
            department: emp.department?.name || 'Unknown',
            position: emp.position,
            colorUsername: emp.colorUsername,
            joinedAt: emp.joinedAt,
            isVerified: emp.isVerified,
            isActive: emp.isActive,
            isSuspended: emp.suspension?.isSuspended || false,
            suspensionReason: emp.suspension?.reason || null,
            suspendedUntil: emp.suspension?.suspendedUntil || null
        }));
        
        res.json({
            success: true,
            employees: formattedEmployees,
            total,
            page: pagination.page,
            pages: pagination.totalPages
        });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get employees'
        });
    }
};

/**
 * Remove employee from company (company admin)
 */
const removeEmployee = async (req, res) => {
    try {
        const { companyId, userId } = req.params;
        
        const employee = await CompanyEmployee.findOne({ user: userId, company: companyId, isActive: true });
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }
        
        // Deactivate employee
        await employee.deactivate();
        
        // Update user's employee profile
        const user = await User.findById(userId);
        if (user) {
            const profile = user.profiles.find(p => 
                p.type === 'employee' && p.companyId?.toString() === companyId
            );
            if (profile) {
                profile.isActive = false;
                await user.save();
            }
        }
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'employee_removed',
            details: { companyId, removedUserId: userId },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Employee removed successfully'
        });
    } catch (error) {
        console.error('Remove employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove employee'
        });
    }
};

/**
 * Update company settings (company admin)
 * Handles all settings categories: moderation, employee management, privacy
 */
const updateCompanySettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        const {
            // Basic settings
            requireVerification,
            autoApproveEmployees,
            // Moderation settings
            postModeration,
            allowAnonymousPosts,
            commentModeration,
            flaggedContentReview,
            blockedKeywords,
            autoSuspendAfterFlags,
            maxCommentsPerDay,
            maxPostsPerDay,
            // Employee management settings
            verificationMethod,
            allowEmployeeRegistration,
            employeeDepartureHandling,
            departmentAssignment,
            // Privacy settings
            companySpaceVisibility,
            showEmployeeCount,
            showDepartmentDetails,
            allowExternalSharing
        } = req.body;
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        // Basic settings
        if (requireVerification !== undefined) company.settings.requireVerification = requireVerification;
        if (autoApproveEmployees !== undefined) company.settings.autoApproveEmployees = autoApproveEmployees;
        
        // Moderation settings
        if (postModeration !== undefined) company.settings.moderation.postModeration = postModeration;
        if (allowAnonymousPosts !== undefined) company.settings.moderation.allowAnonymousPosts = allowAnonymousPosts;
        if (commentModeration !== undefined) company.settings.moderation.commentModeration = commentModeration;
        if (flaggedContentReview !== undefined) company.settings.moderation.flaggedContentReview = flaggedContentReview;
        if (blockedKeywords !== undefined) company.settings.moderation.blockedKeywords = blockedKeywords;
        if (autoSuspendAfterFlags !== undefined) company.settings.moderation.autoSuspendAfterFlags = autoSuspendAfterFlags;
        if (maxCommentsPerDay !== undefined) company.settings.moderation.maxCommentsPerDay = maxCommentsPerDay;
        if (maxPostsPerDay !== undefined) company.settings.moderation.maxPostsPerDay = maxPostsPerDay;
        
        // Employee management settings
        if (verificationMethod !== undefined) company.settings.employeeManagement.verificationMethod = verificationMethod;
        if (allowEmployeeRegistration !== undefined) company.settings.employeeManagement.allowEmployeeRegistration = allowEmployeeRegistration;
        if (employeeDepartureHandling !== undefined) company.settings.employeeManagement.employeeDepartureHandling = employeeDepartureHandling;
        if (departmentAssignment !== undefined) company.settings.employeeManagement.departmentAssignment = departmentAssignment;
        
        // Privacy settings
        if (companySpaceVisibility !== undefined) company.settings.privacy.companySpaceVisibility = companySpaceVisibility;
        if (showEmployeeCount !== undefined) company.settings.privacy.showEmployeeCount = showEmployeeCount;
        if (showDepartmentDetails !== undefined) company.settings.privacy.showDepartmentDetails = showDepartmentDetails;
        if (allowExternalSharing !== undefined) company.settings.privacy.allowExternalSharing = allowExternalSharing;
        
        await company.save();
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'company_settings_updated',
            details: { companyId, updatedFields: Object.keys(req.body) },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Settings updated successfully',
            settings: company.settings
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings'
        });
    }
};

/**
 * Update general company info (company admin)
 * Handles: name, industry, description, logo, banner, website, contactEmail, contactPhone, location fields
 */
const updateGeneralSettings = async (req, res) => {
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
            streetAddress,
            city,
            postalCode,
            country
        } = req.body;
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        // Validate name if changing
        if (name && name !== company.name) {
            const nameValidation = validateCompanyName(name);
            if (!nameValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: nameValidation.message,
                    field: 'name'
                });
            }
            
            // Check if name is taken
            const existing = await Company.findOne({ name, _id: { $ne: companyId } });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'Company name already taken',
                    field: 'name'
                });
            }
            
            company.name = name;
            // slug auto-updates via pre-save hook
        }
        
        if (industry !== undefined) company.industry = industry;
        if (description !== undefined) company.description = description;
        if (logo !== undefined) company.logo = logo;
        if (banner !== undefined) company.banner = banner;
        if (website !== undefined) company.website = website;
        if (contactEmail !== undefined) company.contactEmail = contactEmail;
        if (contactPhone !== undefined) company.contactPhone = contactPhone;
        if (streetAddress !== undefined) company.streetAddress = streetAddress;
        if (city !== undefined) company.city = city;
        if (postalCode !== undefined) company.postalCode = postalCode;
        if (country !== undefined) company.country = country;
        
        await company.save();
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'company_general_updated',
            details: { companyId, updatedFields: Object.keys(req.body) },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'General settings updated successfully',
            company: {
                id: company._id,
                name: company.name,
                slug: company.slug,
                industry: company.industry,
                description: company.description,
                logo: company.logo,
                banner: company.banner,
                website: company.website,
                contactEmail: company.contactEmail,
                contactPhone: company.contactPhone,
                streetAddress: company.streetAddress,
                city: company.city,
                postalCode: company.postalCode,
                country: company.country
            }
        });
    } catch (error) {
        console.error('Update general settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update general settings'
        });
    }
};

/**
 * Suspend employee (company admin)
 * Restricts employee from posting/commenting for a specified duration
 */
const suspendEmployee = async (req, res) => {
    try {
        const { companyId, userId } = req.params;
        const { duration, reason } = req.body; // duration in days, 0 = indefinite
        
        const employee = await CompanyEmployee.findOne({ user: userId, company: companyId, isActive: true });
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }
        
        // Set suspension
        employee.suspension = {
            isSuspended: true,
            reason: reason || 'No reason provided',
            suspendedAt: new Date(),
            suspendedBy: req.user._id,
            suspendedUntil: duration > 0 ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null
        };
        
        await employee.save();
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'employee_suspended',
            details: { companyId, suspendedUserId: userId, duration, reason },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: `Employee suspended${duration > 0 ? ` for ${duration} day${duration > 1 ? 's' : ''}` : ' indefinitely'}`
        });
    } catch (error) {
        console.error('Suspend employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to suspend employee'
        });
    }
};

/**
 * Unsuspend employee (company admin)
 */
const unsuspendEmployee = async (req, res) => {
    try {
        const { companyId, userId } = req.params;
        
        const employee = await CompanyEmployee.findOne({ user: userId, company: companyId, isActive: true });
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }
        
        if (!employee.suspension || !employee.suspension.isSuspended) {
            return res.status(400).json({
                success: false,
                message: 'Employee is not suspended'
            });
        }
        
        employee.suspension = {
            isSuspended: false,
            reason: null,
            suspendedAt: null,
            suspendedBy: null,
            suspendedUntil: null
        };
        
        await employee.save();
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'employee_unsuspended',
            details: { companyId, unsuspendedUserId: userId },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Employee unsuspended successfully'
        });
    } catch (error) {
        console.error('Unsuspend employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unsuspend employee'
        });
    }
};

/**
 * Get company analytics (company admin)
 */
const getCompanyAnalytics = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { period = '7d' } = req.query;
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        // Calculate date range based on period
        const periodDays = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
        const days = periodDays[period] || 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        // Activity metrics
        const totalPosts = await Post.countDocuments({ companyId, postType: 'company_space', status: 'active' });
        const recentPosts = await Post.countDocuments({ companyId, postType: 'company_space', status: 'active', createdAt: { $gte: since } });
        const flaggedPosts = await Post.countDocuments({ companyId, isFlagged: true, status: 'flagged' });
        const anonymousPosts = await Post.countDocuments({ companyId, isAnonymous: true, postType: 'company_space', status: 'active' });
        
        // Employee participation
        const totalEmployees = await CompanyEmployee.countDocuments({ company: companyId, isVerified: true, isActive: true });
        const activeEmployees = await Post.distinct('user', { companyId, postType: 'company_space', createdAt: { $gte: since } });
        const participationRate = totalEmployees > 0 ? Math.round((activeEmployees.length / totalEmployees) * 100) : 0;
        
        // Department breakdown
        const departments = await Department.find({ companyId, isActive: true })
            .select('name slug employeeCount totalPosts');
        
        // Top departments by posts
        const departmentActivity = await Post.aggregate([
            { $match: { companyId: new mongoose.Types.ObjectId(companyId), postType: 'company_space', status: 'active' } },
            { $group: { _id: '$departmentId', postCount: { $sum: 1 } } },
            { $sort: { postCount: -1 } },
            { $limit: 10 }
        ]);
        
        // Common topics - most used words in recent posts (simple word frequency)
        const recentPostsContent = await Post.find({ companyId, postType: 'company_space', status: 'active', createdAt: { $gte: since } })
            .select('content -_id')
            .limit(100)
            .lean();
        
        const wordFreq = {};
        const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their']);
        
        recentPostsContent.forEach(post => {
            const words = (post.content || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
            words.forEach(word => {
                if (word.length > 3 && !stopWords.has(word)) {
                    wordFreq[word] = (wordFreq[word] || 0) + 1;
                }
            });
        });
        
        const commonTopics = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([word, count]) => ({ word, count }));
        
        // Daily activity trend
        const dailyActivity = await Post.aggregate([
            { $match: { companyId: new mongoose.Types.ObjectId(companyId), postType: 'company_space', createdAt: { $gte: since } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        res.json({
            success: true,
            analytics: {
                period,
                overview: {
                    totalPosts,
                    recentPosts,
                    flaggedPosts,
                    anonymousPosts,
                    totalEmployees,
                    activeEmployees: activeEmployees.length,
                    participationRate
                },
                departments,
                departmentActivity,
                commonTopics,
                dailyActivity
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
 * Export company data (company admin)
 */
const exportCompanyData = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const company = await Company.findById(companyId)
            .select('-inviteCodes -usedColorUsernames -registrationDocument');
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        const departments = await Department.find({ companyId, isActive: true })
            .select('name slug description employeeCount totalPosts');
        
        const employees = await CompanyEmployee.find({ company: companyId, isActive: true })
            .populate('user', 'name email')
            .populate('department', 'name')
            .select('colorUsername joinedAt isVerified position');
        
        const posts = await Post.find({ companyId, postType: 'company_space', status: 'active' })
            .select('content isAnonymous likeCount commentCount createdAt')
            .limit(1000);
        
        res.json({
            success: true,
            export: {
                company: {
                    name: company.name,
                    industry: company.industry,
                    description: company.description,
                    employeeCount: company.employeeCount,
                    departmentCount: company.departmentCount,
                    settings: company.settings
                },
                departments,
                employees: employees.map(e => ({
                    name: e.user?.name,
                    email: e.user?.email,
                    department: e.department?.name,
                    position: e.position,
                    joinedAt: e.joinedAt
                })),
                posts: posts.map(p => ({
                    content: p.isAnonymous ? '[Anonymous]' : p.content,
                    isAnonymous: p.isAnonymous,
                    likeCount: p.likeCount,
                    commentCount: p.commentCount,
                    createdAt: p.createdAt
                })),
                exportedAt: new Date()
            }
        });
    } catch (error) {
        console.error('Export company data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export company data'
        });
    }
};

module.exports = {
    getCompanies,
    getCompanyBySlug,
    registerCompany,
    getCompanyDepartments,
    getCompanyStats,
    getCompanyEmployees,
    removeEmployee,
    updateCompanySettings,
    updateGeneralSettings,
    suspendEmployee,
    unsuspendEmployee,
    getCompanyAnalytics,
    exportCompanyData
};