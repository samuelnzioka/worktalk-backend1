/**
 * AuditLog Model
 * Tracks security events and user actions
 */

const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    action: {
        type: String,
        enum: [
            // Auth actions
            'login', 'login_success', 'login_failed', 'logout', 'logout_all',
            'register', 'register_employee', 'register_company',
            'email_verified', 'email_verification_sent',
            'password_reset_requested', 'password_reset_completed',
            
            // Company actions
            'company_created', 'company_updated', 'company_verified', 'company_deactivated',
            'department_created', 'department_updated', 'department_deleted',
            
            // Employee actions
            'employee_invited', 'employee_invite_used', 'employee_verified', 'employee_removed',
            
            // Content actions
            'post_created', 'post_edited', 'post_deleted', 'post_flagged', 'post_unflagged',
            'comment_created', 'comment_deleted',
            'like_added', 'like_removed',
            
            // Moderation actions
            'content_moderated', 'content_removed', 'user_suspended', 'user_banned',
            
            // Profile actions
            'profile_switched', 'username_changed', 'profile_created',
            
            // Security events
            'account_locked', 'account_unlocked', 'suspicious_activity'
        ],
        required: true,
        index: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    strict: false
});

// Indexes for efficient querying
AuditLogSchema.index({ user: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

// TTL index to auto-delete logs after 90 days
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static method to log an event
AuditLogSchema.statics.log = async function(data) {
    return this.create({
        user: data.userId,
        action: data.action,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
    });
};

module.exports = mongoose.model('AuditLog', AuditLogSchema);