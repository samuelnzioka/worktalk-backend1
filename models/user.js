/**
 * User Model
 * Manages user accounts, profiles, and authentication
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    
    // Email verification
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    
    // Account status
    role: {
        type: String,
        enum: ['public', 'employee', 'company_admin', 'admin'],
        default: 'public'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Multiple profiles under one account
    profiles: [{
        type: {
            type: String,
            enum: ['employee', 'public'],
            required: true
        },
        username: {
            type: String,
            required: true
        },
        slug: {
            type: String,
            lowercase: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        bio: {
            type: String,
            maxlength: 500
        },
        avatar: String,
        
        // For employee profile only
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company'
        },
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department'
        },
        employeeId: String,
        isEmployeeVerified: {
            type: Boolean,
            default: false
        },
        verifiedAt: Date,
        colorUsername: String,
        
        // For public profile only
        customUsernameChosen: {
            type: Boolean,
            default: false
        },
        usernameModerationStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        }
    }],
    
    // Current active profile
    activeProfileId: {
        type: String
    },
    
    // Password reset
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    
    // Security
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    lockedUntil: Date,
    lastLoginAt: Date,
    lastLoginIP: String,
    
    // User metadata
    name: {
        type: String,
        required: true
    },
    phone: String,
    avatar: String,
    lastActive: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ 'profiles.username': 1 });
UserSchema.index({ 'profiles.slug': 1 });
UserSchema.index({ 'profiles.companyId': 1 });
UserSchema.index({ 'profiles.departmentId': 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Generate slug from username
UserSchema.pre('save', function(next) {
    if (this.profiles && this.profiles.length > 0) {
        this.profiles.forEach(profile => {
            if (profile.username && (!profile.slug || this.isModified('profiles'))) {
                profile.slug = profile.username.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            }
        });
    }
    next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Increment failed login attempts
UserSchema.methods.incrementFailedLogins = async function() {
    this.failedLoginAttempts += 1;
    
    // Lock account after 10 failed attempts
    if (this.failedLoginAttempts >= 10) {
        this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
    
    await this.save();
};

// Reset failed login attempts
UserSchema.methods.resetFailedLogins = async function() {
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
    await this.save();
};

// Check if account is locked
UserSchema.methods.isLocked = function() {
    return this.lockedUntil && this.lockedUntil > new Date();
};

// Get active profile
UserSchema.methods.getActiveProfile = function() {
    if (!this.activeProfileId) {
        return this.profiles[0];
    }
    return this.profiles.find(p => p._id.toString() === this.activeProfileId);
};

// Virtual for active profile
UserSchema.virtual('activeProfile').get(function() {
    return this.getActiveProfile();
});

module.exports = mongoose.model('User', UserSchema);