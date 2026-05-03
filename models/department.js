/**
 * Department Model
 * Manages company departments and their settings
 */

const mongoose = require('mongoose');
const { DEPARTMENT_ICON_MAP } = require('../config/constants');

const DepartmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        lowercase: true
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    description: {
        type: String,
        maxlength: 1000
    },
    icon: {
        type: String,
        default: '📁'
    },
    headOfDepartment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    employeeCount: {
        type: Number,
        default: 0
    },
    totalPosts: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isHidden: {
        type: Boolean,
        default: false
    },
    order: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound index for unique department per company
DepartmentSchema.index({ name: 1, companyId: 1 }, { unique: true });
DepartmentSchema.index({ slug: 1, companyId: 1 });
DepartmentSchema.index({ companyId: 1, order: 1 });

// Generate slug from name before saving
DepartmentSchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    // Auto-assign icon based on department name
    if (this.isModified('name') && (!this.icon || this.icon === '📁')) {
        this.icon = this.getIconFromName(this.name);
    }
    
    next();
});

// Method to get icon from department name
DepartmentSchema.methods.getIconFromName = function(name) {
    const lowerName = name.toLowerCase();
    
    for (const [keyword, icon] of Object.entries(DEPARTMENT_ICON_MAP)) {
        if (lowerName.includes(keyword)) {
            return icon;
        }
    }
    
    return '📁';
};

// Virtual for posts
DepartmentSchema.virtual('posts', {
    ref: 'Post',
    localField: '_id',
    foreignField: 'departmentId'
});

// Virtual for employees
DepartmentSchema.virtual('employees', {
    ref: 'CompanyEmployee',
    localField: '_id',
    foreignField: 'department'
});

module.exports = mongoose.model('Department', DepartmentSchema);