/**
 * Timeline Controller
 * Handles public timeline operations
 */

const Post = require('../models/post');
const { paginate } = require('../utils/helpers');

/**
 * Get public timeline posts
 */
const getPublicTimeline = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const query = { postType: 'public_timeline', status: 'active' };
        
        const total = await Post.countDocuments(query);
        const pagination = paginate(page, limit, total);
        
        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .populate('user', 'name profiles')
            .lean();
        
        // Anonymize posts if isAnonymous is true
        const anonymizedPosts = posts.map(post => {
            let username = post.username;
            if (post.isAnonymous) {
                username = 'Anonymous';
            }
            return {
                id: post._id,
                content: post.content,
                username,
                isAnonymous: post.isAnonymous,
                likeCount: post.likeCount,
                commentCount: post.commentCount,
                createdAt: post.createdAt,
                userLiked: req.user ? post.likes.includes(req.user._id) : false
            };
        });
        
        res.json({
            success: true,
            posts: anonymizedPosts,
            total,
            page: pagination.page,
            pages: pagination.totalPages,
            hasNextPage: pagination.hasNextPage,
            hasPrevPage: pagination.hasPrevPage,
            nextPage: pagination.nextPage,
            prevPage: pagination.prevPage
        });
    } catch (error) {
        console.error('Get public timeline error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get public timeline'
        });
    }
};

module.exports = {
    getPublicTimeline
};