/**
 * Comment Model
 * Manages comments on posts
 */

const mongoose = require('mongoose');
const { POST_STATUS } = require('../config/constants');

const CommentSchema = new mongoose.Schema({
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
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true,
        index: true
    },
    content: {
        type: String,
        required: true,
        maxlength: 1000
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
    
    // Moderation
    isFlagged: {
        type: Boolean,
        default: false
    },
    flagReason: String,
    status: {
        type: String,
        enum: [POST_STATUS.ACTIVE, POST_STATUS.FLAGGED, POST_STATUS.REMOVED],
        default: POST_STATUS.ACTIVE
    },
    
    // Metadata
    ipAddress: String,
    userAgent: String
}, {
    timestamps: true
});

// Indexes
CommentSchema.index({ post: 1, createdAt: -1 });
CommentSchema.index({ user: 1, createdAt: -1 });
CommentSchema.index({ status: 1 });

// Update likeCount before saving
CommentSchema.pre('save', function(next) {
    this.likeCount = this.likes.length;
    next();
});

// Update post comment count after save
CommentSchema.post('save', async function() {
    const Post = mongoose.model('Post');
    await Post.findByIdAndUpdate(this.post, {
        $inc: { commentCount: 1 }
    });
});

// Update post comment count after remove
CommentSchema.post('remove', async function() {
    const Post = mongoose.model('Post');
    await Post.findByIdAndUpdate(this.post, {
        $inc: { commentCount: -1 }
    });
});

// Method to toggle like
CommentSchema.methods.toggleLike = async function(userId) {
    const index = this.likes.indexOf(userId);
    
    if (index === -1) {
        this.likes.push(userId);
    } else {
        this.likes.splice(index, 1);
    }
    
    this.likeCount = this.likes.length;
    await this.save();
    
    return index === -1;
};

module.exports = mongoose.model('Comment', CommentSchema);