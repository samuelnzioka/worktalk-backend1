/**
 * Authentication Middleware
 * JWT verification and role-based access control
 */

const jwt = require('jsonwebtoken');
const User = require('../models/user');
const CompanyEmployee = require('../models/companyemployee');

/**
 * Protect routes - verify JWT token
 */
const protect = async (req, res, next) => {
    let token;
    
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    
    // Check for token in cookies (optional)
    if (!token && req.cookies?.accessToken) {
        token = req.cookies.accessToken;
    }
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token provided'
        });
    }
    
    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            return res.status(401).json({
                success: false,
                message: 'Account is temporarily locked. Please try again later.'
            });
        }
        
        req.user = user;
        // Attach companyId and role from token if present (for company admin/employee context)
        if (decoded.companyId) {
            req.user.companyId = decoded.companyId;
        }
        if (decoded.role) {
            req.user.role = decoded.role;
        }
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        return res.status(401).json({
            success: false,
            message: 'Not authorized, invalid token'
        });
    }
};

/**
 * Employee only - user must be verified employee of ANY company
 */
const employeeOnly = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized'
        });
    }
    
    // Check if user has an active employee profile
    const employeeProfile = req.user.profiles?.find(p => p.type === 'employee' && p.isActive);
    
    if (!employeeProfile || !employeeProfile.isEmployeeVerified) {
        return res.status(403).json({
            success: false,
            message: 'Employee access required'
        });
    }
    
    // Get employee details from CompanyEmployee
    const employeeRecord = await CompanyEmployee.findOne({
        user: req.user._id,
        company: employeeProfile.companyId,
        isActive: true
    });
    
    if (!employeeRecord || !employeeRecord.isVerified) {
        return res.status(403).json({
            success: false,
            message: 'Employee verification required'
        });
    }
    
    req.employeeRecord = employeeRecord;
    req.employeeCompany = employeeRecord.company;
    req.employeeDepartment = employeeRecord.department;
    
    next();
};

/**
 * Company employee only - user must be employee of specific company
 * @param {string} companyIdParam - Parameter name for company ID in request
 */
const companyEmployeeOnly = (companyIdParam = 'companyId') => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const companyId = req.params[companyIdParam] || req.body[companyIdParam];
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID required'
            });
        }
        
        // Check if user is employee of this company
        const employeeRecord = await CompanyEmployee.findOne({
            user: req.user._id,
            company: companyId,
            isVerified: true,
            isActive: true
        });
        
        if (!employeeRecord) {
            return res.status(403).json({
                success: false,
                message: 'Not an employee of this company'
            });
        }
        
        req.employeeRecord = employeeRecord;
        req.employeeDepartment = employeeRecord.department;
        
        next();
    };
};

/**
 * Department employee only - user must be employee of specific department
 * @param {string} departmentIdParam - Parameter name for department ID in request
 */
const departmentEmployeeOnly = (departmentIdParam = 'departmentId') => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const departmentId = req.params[departmentIdParam] || req.body[departmentIdParam];
        
        if (!departmentId) {
            return res.status(400).json({
                success: false,
                message: 'Department ID required'
            });
        }
        
        // Check if user is employee of this department
        const employeeRecord = await CompanyEmployee.findOne({
            user: req.user._id,
            department: departmentId,
            isVerified: true,
            isActive: true
        });
        
        if (!employeeRecord) {
            return res.status(403).json({
                success: false,
                message: 'Not a member of this department'
            });
        }
        
        req.employeeRecord = employeeRecord;
        
        next();
    };
};

/**
 * Company admin only - user must be admin of specific company
 * @param {string} companyIdParam - Parameter name for company ID in request
 */
const companyAdminOnly = (companyIdParam = 'companyId') => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const companyId = req.params[companyIdParam] || req.body[companyIdParam];
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID required'
            });
        }
        
        // Check if user is company admin
        const company = await require('../models/company').findById(companyId);
        
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        // Check if user has company admin role
        const isAdmin = req.user.role === 'admin' || 
                        req.user.role === 'company_admin' ||
                        (company.adminId && company.adminId.toString() === req.user._id.toString());
        
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Company admin access required'
            });
        }
        
        next();
    };
};

/**
 * Admin only - super admin access
 */
const adminOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized'
        });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    
    next();
};

/**
 * Optional auth - doesn't fail if no token, just sets req.user if available
 */
const optionalAuth = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
        req.user = null;
        return next();
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        req.user = user;
    } catch (error) {
        req.user = null;
    }
    
    next();
};

module.exports = {
    protect,
    employeeOnly,
    companyEmployeeOnly,
    departmentEmployeeOnly,
    companyAdminOnly,
    adminOnly,
    optionalAuth
};