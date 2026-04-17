/**
 * User Settings Model
 * Stores user preferences and settings
 */

const mongoose = require('mongoose');

const usersettingsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    
    // Appearance Settings
    appearance: {
        theme: {
            type: String,
            enum: ['light', 'dark', 'system'],
            default: 'light'
        },
        fontSize: {
            type: String,
            enum: ['small', 'medium', 'large'],
            default: 'medium'
        },
        compactMode: {
            type: Boolean,
            default: false
        },
        animations: {
            type: Boolean,
            default: true
        }
    },
    
    // Notification Settings
    notifications: {
        email: {
            enabled: {
                type: Boolean,
                default: true
            },
            newComment: {
                type: Boolean,
                default: true
            },
            postLike: {
                type: Boolean,
                default: true
            },
            mention: {
                type: Boolean,
                default: true
            },
            companyUpdate: {
                type: Boolean,
                default: false
            },
            weeklyDigest: {
                type: Boolean,
                default: true
            }
        },
        push: {
            enabled: {
                type: Boolean,
                default: false
            },
            newComment: {
                type: Boolean,
                default: true
            },
            postLike: {
                type: Boolean,
                default: true
            },
            mention: {
                type: Boolean,
                default: true
            }
        },
        inApp: {
            newComment: {
                type: Boolean,
                default: true
            },
            postLike: {
                type: Boolean,
                default: true
            },
            mention: {
                type: Boolean,
                default: true
            },
            inviteReceived: {
                type: Boolean,
                default: true
            }
        }
    },
    
    // Privacy Settings
    privacy: {
        profileVisibility: {
            type: String,
            enum: ['public', 'private', 'only_me'],
            default: 'public'
        },
        showEmail: {
            type: Boolean,
            default: false
        },
        showActivityStatus: {
            type: Boolean,
            default: true
        },
        showInSearch: {
            type: Boolean,
            default: true
        },
        allowDirectMessages: {
            type: String,
            enum: ['everyone', 'followers', 'no_one'],
            default: 'everyone'
        }
    },
    
    // Content Preferences
    content: {
        defaultTab: {
            type: String,
            enum: ['companies', 'timeline'],
            default: 'companies'
        },
        postsPerPage: {
            type: Number,
            enum: [10, 20, 50],
            default: 20
        },
        sortCommentsBy: {
            type: String,
            enum: ['newest', 'oldest', 'most_liked'],
            default: 'newest'
        },
        hideFlaggedContent: {
            type: Boolean,
            default: true
        },
        anonymousPostingDefault: {
            type: String,
            enum: ['always', 'ask_each_time', 'never'],
            default: 'ask_each_time'
        }
    },
    
    // Security Settings
    security: {
        twoFactorEnabled: {
            type: Boolean,
            default: false
        },
        twoFactorSecret: {
            type: String,
            default: null
        },
        loginNotifications: {
            type: Boolean,
            default: true
        },
        sessionTimeout: {
            type: Number,
            enum: [15, 30, 60, 120],
            default: 30
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

usersettingsSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('UserSettings', usersettingsSchema);