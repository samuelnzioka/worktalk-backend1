/**
 * Company Model
 * Manages company information, verification, and settings
 */

const mongoose = require('mongoose');
const { COMPANY_INDUSTRY_ICONS } = require('../config/constants');

const CompanySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        index: true
    },
    industry: {
        type: String,
        required: true
    },
    description: {
        type: String,
        maxlength: 5000
    },
    logo: String,
    banner: String,
    website: String,
    icon: {
        type: String,
        default: '🏢'
    },
    
    // Email domain for verification (e.g., @safaricom.co.ke)
    emailDomain: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    
    // Registration and verification
    registrationDocument: String,
    isVerified: {
        type: Boolean,
        default: false
    },
    verifiedAt: Date,
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Company admin
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Statistics
    employeeCount: {
        type: Number,
        default: 0
    },
    departmentCount: {
        type: Number,
        default: 0
    },
    totalPosts: {
        type: Number,
        default: 0
    },
    
    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Invite codes management
    inviteCodes: [{
        code: {
            type: String,
            unique: true
        },
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department'
        },
        usedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        usedAt: Date,
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Used color usernames to avoid duplicates
    usedColorUsernames: [{
        color: String,
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        profileId: String,
        assignedAt: Date
    }],
    
    // Company settings
    settings: {
        requireVerification: {
            type: Boolean,
            default: true
        },
        allowAnonymousPosts: {
            type: Boolean,
            default: true
        },
        moderationEnabled: {
            type: Boolean,
            default: true
        },
        autoApproveEmployees: {
            type: Boolean,
            default: false
        }
    },
    
    // Contact information
    contactName: String,
    contactEmail: String,
    contactPhone: String
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
CompanySchema.index({ name: 1 });
CompanySchema.index({ slug: 1 });
CompanySchema.index({ emailDomain: 1 });
CompanySchema.index({ industry: 1 });
CompanySchema.index({ isVerified: 1 });
CompanySchema.index({ isActive: 1 });

// Generate slug from name before saving
CompanySchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    // Set icon based on industry if not set
    if (!this.icon && this.industry) {
        this.icon = COMPANY_INDUSTRY_ICONS[this.industry] || '🏢';
    }
    
    next();
});

// Virtual for departments
CompanySchema.virtual('departments', {
    ref: 'Department',
    localField: '_id',
    foreignField: 'companyId'
});

// Virtual for posts
CompanySchema.virtual('posts', {
    ref: 'Post',
    localField: '_id',
    foreignField: 'companyId'
});

// Virtual for employees
CompanySchema.virtual('employees', {
    ref: 'CompanyEmployee',
    localField: '_id',
    foreignField: 'company'
});

// Method to check if email domain matches
CompanySchema.methods.isCompanyEmail = function(email) {
    return email.toLowerCase().endsWith(`@${this.emailDomain}`);
};

// Method to assign a new color username
CompanySchema.methods.assignColorUsername = async function(userId, profileId) {
    const { COLOR_USERNAMES } = require('../config/constants');
    
    // Get used colors
    const usedColors = this.usedColorUsernames.map(c => c.color);
    
    // Find available color
    let availableColors = COLOR_USERNAMES.filter(c => !usedColors.includes(c));
    
    if (availableColors.length === 0) {
        // Fallback: add number suffix
        const baseColor = COLOR_USERNAMES[Math.floor(Math.random() * COLOR_USERNAMES.length)];
        let counter = 1;
        while (usedColors.includes(`${baseColor}${counter}`)) {
            counter++;
        }
        availableColors = [`${baseColor}${counter}`];
    }
    
    const assignedColor = availableColors[0];
    
    // Save to used colors
    this.usedColorUsernames.push({
        color: assignedColor,
        userId,
        profileId,
        assignedAt: new Date()
    });
    
    await this.save();
    
    return assignedColor;
};

module.exports = mongoose.model('Company', CompanySchema);