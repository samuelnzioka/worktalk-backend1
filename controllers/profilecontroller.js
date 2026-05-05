/**
 * Profile Controller
 * Handles profile switching and management
 */

const User = require('../models/user');
const AuditLog = require('../models/auditlog');
const { generateTokenPair } = require('../config/auth');
const { getClientIP, getUserAgent } = require('../utils/helpers');
const { validatePublicUsername } = require('../utils/validators');

/**
 * Get user's profiles
 */
const getProfiles = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('profiles activeProfileId role')
            .populate('profiles.companyId', 'name slug icon adminId')
            .populate('profiles.departmentId', 'name');
        
        const enhancedProfiles = user.profiles.map(profile => {
            const profileObj = profile.toObject();
            if (profile.type === 'employee' && profile.companyId) {
                profileObj.companyName = profile.companyId.name;
                profileObj.companySlug = profile.companyId.slug;
                // Check if this user is the admin of this company
                profileObj.isCompanyAdmin = profile.companyId.adminId?.toString() === req.user._id.toString();
                if (profile.departmentId) {
                    profileObj.departmentName = profile.departmentId.name;
                }
            }
            return profileObj;
        });
        
        res.json({
            success: true,
            profiles: enhancedProfiles,
            activeProfileId: user.activeProfileId,
            userRole: user.role
        });
    } catch (error) {
        console.error('Get profiles error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profiles'
        });
    }
};

/**
 * Switch active profile
 */
const switchProfile = async (req, res) => {
    try {
        const { profileId } = req.body;
        
        const user = await User.findById(req.user._id);
        
        // Verify profile exists
        const profileExists = user.profiles.some(p => p._id.toString() === profileId);
        if (!profileExists) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found'
            });
        }
        
        user.activeProfileId = profileId;
        await user.save();
        
        // Create audit log (non-blocking)
        AuditLog.create({
            user: user._id,
            action: 'profile_switched',
            details: { profileId },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        }).catch(err => console.error('Audit log creation failed:', err));
        
        // Get updated user data
        const updatedUser = await User.findById(user._id)
            .select('-password -emailVerificationToken -resetPasswordToken')
            .populate('profiles.companyId', 'name slug icon adminId')
            .populate('profiles.departmentId', 'name');
        
        // Get the switched profile to determine routing
        const switchedProfile = updatedUser.profiles.find(p => p._id.toString() === profileId);
        
        // Check if user is admin of the specific company in this profile
        const isCompanyAdmin = switchedProfile?.companyId?.adminId?.toString() === user._id.toString();
        
        console.log('Switching profile:', profileId);
        console.log('Switched profile type:', switchedProfile?.type);
        console.log('User ID:', user._id);
        console.log('Company admin ID:', switchedProfile?.companyId?.adminId);
        console.log('Is company admin:', isCompanyAdmin);
        
        // FIX: Generate new tokens with the correct companyId when switching to an employee profile
        // This ensures subsequent API calls use the correct company context
        let newAccessToken = null;
        let newRefreshToken = null;
        
        if (switchedProfile?.type === 'employee' && switchedProfile?.companyId?._id) {
            const tokenPayload = {
                ...updatedUser.toObject(),
                companyId: switchedProfile.companyId._id,
                role: isCompanyAdmin ? 'company_admin' : updatedUser.role
            };
            const tokens = generateTokenPair(tokenPayload);
            newAccessToken = tokens.accessToken;
            newRefreshToken = tokens.refreshToken;
        } else if (switchedProfile?.type === 'public') {
            // Switching to public profile - remove companyId from token
            const tokenPayload = {
                ...updatedUser.toObject()
            };
            delete tokenPayload.companyId;
            const tokens = generateTokenPair(tokenPayload);
            newAccessToken = tokens.accessToken;
            newRefreshToken = tokens.refreshToken;
        }
        
        res.json({
            success: true,
            message: 'Profile switched successfully',
            user: updatedUser,
            switchedProfile: {
                type: switchedProfile?.type,
                companyId: switchedProfile?.companyId?._id?.toString(),
                companyName: switchedProfile?.companyId?.name,
                isCompanyAdmin: isCompanyAdmin
            },
            ...(newAccessToken ? { accessToken: newAccessToken, refreshToken: newRefreshToken } : {})
        });
    } catch (error) {
        console.error('Switch profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to switch profile'
        });
    }
};

/**
 * Create public profile (for employees)
 */
const createPublicProfile = async (req, res) => {
    try {
        const { username } = req.body;
        
        // Validate username
        const usernameValidation = validatePublicUsername(username);
        if (!usernameValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: usernameValidation.message,
                field: 'username'
            });
        }
        
        // Check if username already exists
        const existingUser = await User.findOne({ 'profiles.username': username });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username already taken',
                field: 'username'
            });
        }
        
        const user = await User.findById(req.user._id);
        
        // Check if user already has a public profile
        const hasPublicProfile = user.profiles.some(p => p.type === 'public');
        if (hasPublicProfile) {
            return res.status(400).json({
                success: false,
                message: 'You already have a public profile'
            });
        }
        
        // Create public profile
        const publicProfile = {
            type: 'public',
            username,
            isActive: true,
            customUsernameChosen: true,
            usernameModerationStatus: 'approved'
        };
        
        user.profiles.push(publicProfile);
        await user.save();
        
        await AuditLog.create({
            user: user._id,
            action: 'profile_created',
            details: { type: 'public', username },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.status(201).json({
            success: true,
            message: 'Public profile created successfully',
            profile: publicProfile
        });
    } catch (error) {
        console.error('Create public profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create public profile'
        });
    }
};

/**
 * Update public username
 */
const updatePublicUsername = async (req, res) => {
    try {
        const { username } = req.body;
        
        // Validate username
        const usernameValidation = validatePublicUsername(username);
        if (!usernameValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: usernameValidation.message,
                field: 'username'
            });
        }
        
        // Check if username already exists
        const existingUser = await User.findOne({ 
            'profiles.username': username,
            _id: { $ne: req.user._id }
        });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username already taken',
                field: 'username'
            });
        }
        
        const user = await User.findById(req.user._id);
        const publicProfile = user.profiles.find(p => p.type === 'public');
        
        if (!publicProfile) {
            return res.status(404).json({
                success: false,
                message: 'Public profile not found'
            });
        }
        
        publicProfile.username = username;
        await user.save();
        
        await AuditLog.create({
            user: user._id,
            action: 'username_changed',
            details: { username },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Username updated successfully',
            username
        });
    } catch (error) {
        console.error('Update username error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update username'
        });
    }
};

/**
 * Get employee verification status
 */
const getEmployeeVerification = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const employeeProfile = user.profiles.find(p => p.type === 'employee' && p.isActive);
        
        if (!employeeProfile || !employeeProfile.isEmployeeVerified) {
            return res.json({
                success: true,
                isVerified: false,
                message: 'Not verified as employee'
            });
        }
        
        res.json({
            success: true,
            isVerified: true,
            companyId: employeeProfile.companyId,
            departmentId: employeeProfile.departmentId,
            verifiedAt: employeeProfile.verifiedAt
        });
    } catch (error) {
        console.error('Get employee verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get verification status'
        });
    }
};

module.exports = {
    getProfiles,
    switchProfile,
    createPublicProfile,
    updatePublicUsername,
    getEmployeeVerification
};