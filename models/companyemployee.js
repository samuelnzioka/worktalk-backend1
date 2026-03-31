/**
 * CompanyEmployee Model
 * Manages employee verification and company membership
 */

const mongoose = require('mongoose');
const { VERIFICATION_METHODS } = require('../config/constants');

const CompanyEmployeeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true
    },
    position: {
        type: String,
        maxlength: 100
    },
    employeeId: {
        type: String
    },
    
    // Verification
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationMethod: {
        type: String,
        enum: [VERIFICATION_METHODS.EMAIL, VERIFICATION_METHODS.INVITE_CODE, VERIFICATION_METHODS.ADMIN],
        required: true
    },
    verifiedAt: Date,
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Invite code (if used)
    inviteCode: String,
    inviteCodeExpires: Date,
    
    // Employee's color username
    colorUsername: {
        type: String
    },
    
    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    leftAt: Date,
    
    // Metadata
    departmentJoinDate: Date
}, {
    timestamps: true
});

// Indexes
CompanyEmployeeSchema.index({ user: 1, company: 1 }, { unique: true });
CompanyEmployeeSchema.index({ company: 1, department: 1 });
CompanyEmployeeSchema.index({ inviteCode: 1 });
CompanyEmployeeSchema.index({ isVerified: 1, isActive: 1 });

// Update company and department counts after save
CompanyEmployeeSchema.post('save', async function() {
    const Company = mongoose.model('Company');
    const Department = mongoose.model('Department');
    
    if (this.isVerified && this.isActive) {
        // Increment employee count in company
        await Company.findByIdAndUpdate(this.company, {
            $inc: { employeeCount: 1 }
        });
        
        // Increment employee count in department
        await Department.findByIdAndUpdate(this.department, {
            $inc: { employeeCount: 1 }
        });
    }
});

// Update company and department counts after remove
CompanyEmployeeSchema.post('remove', async function() {
    const Company = mongoose.model('Company');
    const Department = mongoose.model('Department');
    
    if (this.isVerified && this.isActive) {
        // Decrement employee count in company
        await Company.findByIdAndUpdate(this.company, {
            $inc: { employeeCount: -1 }
        });
        
        // Decrement employee count in department
        await Department.findByIdAndUpdate(this.department, {
            $inc: { employeeCount: -1 }
        });
    }
});

// Method to verify employee
CompanyEmployeeSchema.methods.verify = async function(verifiedBy, method) {
    this.isVerified = true;
    this.verifiedAt = new Date();
    this.verifiedBy = verifiedBy;
    this.verificationMethod = method || this.verificationMethod;
    await this.save();
};

// Method to deactivate employee (leave company)
CompanyEmployeeSchema.methods.deactivate = async function() {
    this.isActive = false;
    this.leftAt = new Date();
    await this.save();
};

module.exports = mongoose.model('CompanyEmployee', CompanyEmployeeSchema);