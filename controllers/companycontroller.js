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
                contactName,
                contactEmail,
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
                    allowAnonymousPosts: true,
                    moderationEnabled: true,
                    autoApproveEmployees: false
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
        
        // Get logged-in public user — they become the company admin
        const publicUser = req.user;
        console.log('Public user becoming company admin:', publicUser?._id, publicUser?.email);
        
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
            .select('name slug icon description employeeCount totalPosts');
        
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
        const companyId = req.user.companyId || req.query.companyId;
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
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
            colorUsername: emp.colorUsername,
            joinedAt: emp.joinedAt,
            isVerified: emp.isVerified,
            isActive: emp.isActive
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
 */
const updateCompanySettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { allowAnonymousPosts, requireVerification, moderationEnabled, autoApproveEmployees } = req.body;
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        company.settings = {
            allowAnonymousPosts: allowAnonymousPosts !== undefined ? allowAnonymousPosts : company.settings.allowAnonymousPosts,
            requireVerification: requireVerification !== undefined ? requireVerification : company.settings.requireVerification,
            moderationEnabled: moderationEnabled !== undefined ? moderationEnabled : company.settings.moderationEnabled,
            autoApproveEmployees: autoApproveEmployees !== undefined ? autoApproveEmployees : company.settings.autoApproveEmployees
        };
        
        await company.save();
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'company_updated',
            details: { companyId, settings: company.settings },
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

module.exports = {
    getCompanies,
    getCompanyBySlug,
    registerCompany,
    getCompanyDepartments,
    getCompanyStats,
    getCompanyEmployees,
    removeEmployee,
    updateCompanySettings
};