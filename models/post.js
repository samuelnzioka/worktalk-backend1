/**
 * Post Model
 * Manages posts in company spaces and public timeline
 */

const mongoose = require('mongoose');
const { POST_TYPES, POST_STATUS } = require('../config/constants');

const PostSchema = new mongoose.Schema({
    profileId: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        index: true
    },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        index: true
    },
    content: {
        type: String,
        required: true,
        maxlength: 5000
    },
    postType: {
        type: String,
        enum: [POST_TYPES.COMPANY_SPACE, POST_TYPES.PUBLIC_TIMELINE],
        required: true,
        index: true
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    
    // Engagement
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    likeCount: {
        type: Number,
        default: 0
    },
    commentCount: {
        type: Number,
        default: 0
    },
    
    // Moderation
    isFlagged: {
        type: Boolean,
        default: false
    },
    flagReason: String,
    flaggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    flaggedAt: Date,
    status: {
        type: String,
        enum: [POST_STATUS.ACTIVE, POST_STATUS.FLAGGED, POST_STATUS.REMOVED],
        default: POST_STATUS.ACTIVE,
        index: true
    },
    
    // Metadata
    ipAddress: String,
    userAgent: String
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
PostSchema.index({ companyId: 1, departmentId: 1, createdAt: -1 });
PostSchema.index({ postType: 1, createdAt: -1 });
PostSchema.index({ user: 1, createdAt: -1 });
PostSchema.index({ status: 1, createdAt: -1 });
PostSchema.index({ isFlagged: 1 });

// Update likeCount before saving
PostSchema.pre('save', function(next) {
    this.likeCount = this.likes.length;
    next();
});

// Virtual for comments
PostSchema.virtual('comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'post'
});

// Method to check if user liked the post
PostSchema.methods.isLikedBy = function(userId) {
    return this.likes.includes(userId);
};

// Method to toggle like
PostSchema.methods.toggleLike = async function(userId) {
    const index = this.likes.indexOf(userId);
    
    if (index === -1) {
        this.likes.push(userId);
    } else {
        this.likes.splice(index, 1);
    }
    
    this.likeCount = this.likes.length;
    await this.save();
    
    return index === -1; // Returns true if liked, false if unliked
};

// Method to flag post
PostSchema.methods.flag = async function(reason, userId) {
    this.isFlagged = true;
    this.flagReason = reason;
    this.flaggedBy = userId;
    this.flaggedAt = new Date();
    this.status = POST_STATUS.FLAGGED;
    await this.save();
};

// Method to resolve flag
PostSchema.methods.resolveFlag = async function(action) {
    if (action === 'keep') {
        this.isFlagged = false;
        this.flagReason = null;
        this.flaggedBy = null;
        this.flaggedAt = null;
        this.status = POST_STATUS.ACTIVE;
    } else if (action === 'remove') {
        this.status = POST_STATUS.REMOVED;
    }
    await this.save();
};

module.exports = mongoose.model('Post', PostSchema);