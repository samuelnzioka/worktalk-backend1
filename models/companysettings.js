/**
 * Company Settings Model
 * Stores company-specific configuration
 */

const mongoose = require('mongoose');

const companysettingsSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        unique: true,
        index: true
    },
    
    // General Settings
    general: {
        allowAnonymousPosts: {
            type: Boolean,
            default: true
        },
        allowEmployeeRegistration: {
            type: Boolean,
            default: false
        },
        employeeVerificationMethod: {
            type: String,
            enum: ['email_domain', 'invite_code', 'admin_approval'],
            default: 'invite_code'
        },
        defaultDepartment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department'
        }
    },
    
    // Moderation Settings
    moderation: {
        postModeration: {
            type: String,
            enum: ['auto_approve', 'manual_review'],
            default: 'auto_approve'
        },
        commentModeration: {
            type: String,
            enum: ['auto_approve', 'manual_review'],
            default: 'auto_approve'
        },
        flagThreshold: {
            type: Number,
            default: 3,
            min: 1,
            max: 10
        },
        autoHideFlagged: {
            type: Boolean,
            default: true
        },
        blockedKeywords: [{
            type: String,
            trim: true,
            lowercase: true
        }],
        blockedDomains: [{
            type: String,
            trim: true,
            lowercase: true
        }]
    },
    
    // Privacy Settings
    privacy: {
        companySpaceVisibility: {
            type: String,
            enum: ['public', 'employees_only'],
            default: 'public'
        },
        showEmployeeCount: {
            type: Boolean,
            default: true
        },
        showDepartmentDetails: {
            type: Boolean,
            default: true
        },
        allowExternalSharing: {
            type: Boolean,
            default: true
        }
    },
    
    // Notification Settings (for company admins)
    notifications: {
        emailAlerts: {
            type: Boolean,
            default: true
        },
        flaggedContentAlert: {
            type: Boolean,
            default: true
        },
        newEmployeeAlert: {
            type: Boolean,
            default: true
        },
        weeklyReport: {
            type: Boolean,
            default: true
        }
    },
    
    // Employee Management
    employeeManagement: {
        autoApproveEmployees: {
            type: Boolean,
            default: false
        },
        requireEmailVerification: {
            type: Boolean,
            default: true
        },
        employeeDepartureAction: {
            type: String,
            enum: ['anonymize', 'delete', 'keep'],
            default: 'anonymize'
        },
        departmentAssignment: {
            type: String,
            enum: ['admin', 'employee'],
            default: 'admin'
        }
    },
    
    // Analytics
    analytics: {
        enabled: {
            type: Boolean,
            default: true
        },
        shareAnonymousData: {
            type: Boolean,
            default: true
        }
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

companysettingsSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('CompanySettings', companysettingsSchema);