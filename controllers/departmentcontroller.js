/**
 * Department Controller
 * Handles department CRUD operations (company admin only)
 */

const Department = require('../models/department');
const Company = require('../models/company');
const Post = require('../models/post');
const CompanyEmployee = require('../models/companyemployee');
const AuditLog = require('../models/auditlog');
const { validateDepartmentName } = require('../utils/validators');
const { getClientIP, getUserAgent } = require('../utils/helpers');

/**
 * Create a new department (company admin)
 */
const createDepartment = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { name, description } = req.body;
        
        // Validate department name
        const nameValidation = validateDepartmentName(name);
        if (!nameValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: nameValidation.message,
                field: 'name'
            });
        }
        
        // Check if department already exists
        const existingDept = await Department.findOne({ name, companyId });
        if (existingDept) {
            return res.status(400).json({
                success: false,
                message: 'Department already exists',
                field: 'name'
            });
        }
        
        // Get current department count for ordering
        const deptCount = await Department.countDocuments({ companyId });
        
        const { icon, headOfDepartment, isHidden } = req.body;
        
        const department = await Department.create({
            name,
            companyId,
            description,
            icon,
            headOfDepartment,
            isHidden: isHidden || false,
            order: deptCount,
            isActive: true
        });
        
        // Update company department count
        await Company.findByIdAndUpdate(companyId, { $inc: { departmentCount: 1 } });
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'department_created',
            details: { companyId, departmentId: department._id, name },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.status(201).json({
            success: true,
            message: 'Department created successfully',
            department
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
 * Update department (company admin)
 */
const updateDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { name, description, icon, order, headOfDepartment, isHidden } = req.body;
        
        const department = await Department.findById(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }
        
        if (name) {
            const nameValidation = validateDepartmentName(name);
            if (!nameValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: nameValidation.message,
                    field: 'name'
                });
            }
            
            // Check if name already taken
            const existingDept = await Department.findOne({ 
                name, 
                companyId: department.companyId,
                _id: { $ne: departmentId }
            });
            if (existingDept) {
                return res.status(400).json({
                    success: false,
                    message: 'Department name already exists',
                    field: 'name'
                });
            }
            
            department.name = name;
        }
        
        if (description !== undefined) department.description = description;
        if (icon !== undefined) department.icon = icon;
        if (order !== undefined) department.order = order;
        if (headOfDepartment !== undefined) department.headOfDepartment = headOfDepartment;
        if (isHidden !== undefined) department.isHidden = isHidden;
        
        await department.save();
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'department_updated',
            details: { departmentId, updates: { name, description, icon, order, headOfDepartment, isHidden } },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Department updated successfully',
            department
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
 * Delete department (company admin)
 * Only allowed if no employees are assigned
 */
const deleteDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        
        const department = await Department.findById(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }
        
        // Check if department has employees
        const employeeCount = await CompanyEmployee.countDocuments({ 
            department: departmentId, 
            isActive: true 
        });
        
        if (employeeCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete department with active employees. Reassign employees first.'
            });
        }
        
        // Soft delete - mark as inactive
        department.isActive = false;
        await department.save();
        
        // Update company department count
        await Company.findByIdAndUpdate(department.companyId, { $inc: { departmentCount: -1 } });
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'department_deleted',
            details: { departmentId, name: department.name },
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
 * Get department posts (public with department access control)
 */
const getDepartmentPosts = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        
        const department = await Department.findById(departmentId);
        if (!department || !department.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }
        
        const skip = (page - 1) * limit;
        
        const posts = await Post.find({ 
            departmentId, 
            postType: 'company_space',
            status: 'active'
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('user', 'name profiles')
            .lean();
        
        // Anonymize posts if isAnonymous is true
        const anonymizedPosts = posts.map(post => {
            let username = post.username;
            if (post.isAnonymous) {
                username = 'Anonymous Employee';
            }
            return {
                ...post,
                username,
                user: undefined
            };
        });
        
        const total = await Post.countDocuments({ 
            departmentId, 
            postType: 'company_space',
            status: 'active'
        });
        
        res.json({
            success: true,
            posts: anonymizedPosts,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            hasNextPage: skip + limit < total,
            hasPrevPage: page > 1
        });
    } catch (error) {
        console.error('Get department posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get department posts'
        });
    }
};

/**
 * Reorder departments (company admin)
 */
const reorderDepartments = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { order } = req.body; // Array of { departmentId, order }
        
        if (!Array.isArray(order)) {
            return res.status(400).json({
                success: false,
                message: 'Order must be an array of { departmentId, order }'
            });
        }
        
        for (const item of order) {
            await Department.findByIdAndUpdate(item.departmentId, { order: item.order });
        }
        
        await AuditLog.log({
            userId: req.user._id,
            action: 'departments_reordered',
            details: { companyId, order },
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

module.exports = {
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getDepartmentPosts,
    reorderDepartments
};