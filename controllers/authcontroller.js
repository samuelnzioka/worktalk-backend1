/**
 * Auth Controller
 * Handles user authentication, registration, and account management
 */

const crypto = require('crypto');
const User = require('../models/user');
const Company = require('../models/company');
const Department = require('../models/department');
const CompanyEmployee = require('../models/companyemployee');
const AuditLog = require('../models/auditlog');
const { generateTokenPair, verifyRefreshToken } = require('../config/auth');
const { sendVerificationEmail, sendPasswordResetEmail, sendEmployeeInviteEmail } = require('../services/emailservice');
const { generateToken, generateInviteCode, getClientIP, getUserAgent } = require('../utils/helpers');
const { validatePublicUsername } = require('../utils/validators');
const { COLOR_USERNAMES } = require('../config/constants');

/**
 * Register a new public user
 */
const register = async (req, res) => {
    try {
        const { name, email, username, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists',
                field: 'email'
            });
        }

        // Validate username
        const usernameValidation = validatePublicUsername(username);
        if (!usernameValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: usernameValidation.message,
                field: 'username'
            });
        }

        // Check if username is taken
        const existingUsername = await User.findOne({ 'profiles.username': username });
        if (existingUsername) {
            return res.status(400).json({
                success: false,
                message: 'Username already taken',
                field: 'username'
            });
        }

        // Create user with public profile
        const user = await User.create({
            name,
            email,
            password,
            profiles: [{
                type: 'public',
                username,
                isActive: true,
                customUsernameChosen: true,
                usernameModerationStatus: 'approved'
            }],
            activeProfileId: null, // Will be set after creation
            isEmailVerified: true // Auto-verify for now
        });

        // Set active profile
        user.activeProfileId = user.profiles[0]._id;
        await user.save();

        // Generate tokens for automatic login after registration
        const { accessToken, refreshToken } = generateTokenPair(user);

        // Get user data (without password)
        const userData = user.toJSON();
        delete userData.password;
        delete userData.emailVerificationToken;
        delete userData.resetPasswordToken;

        // Log registration
        await AuditLog.log({
            userId: user._id,
            action: 'register',
            details: { email, username },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            accessToken,
            refreshToken,
            user: userData,
            redirectTo: '/index.html'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
};

/**
 * Register employee with invite code
 */
const registerEmployee = async (req, res) => {
    try {
        const { inviteCode, name, email, password } = req.body;

        // Find valid invite
        const company = await Company.findOne({
            'inviteCodes.code': inviteCode,
            'inviteCodes.expiresAt': { $gt: new Date() },
            'inviteCodes.usedBy': null
        });

        if (!company) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired invite code',
                field: 'inviteCode'
            });
        }

        const invite = company.inviteCodes.find(i => i.code === inviteCode);

        // Check if user already exists
        let user = await User.findOne({ email });

        if (!user) {
            // Create new user
            user = await User.create({
                name,
                email,
                password,
                profiles: [],
                isEmailVerified: true, // Auto-verify for now
                role: 'employee'
            });
        }

        // Check if already employee of this company
        const existingEmployee = await CompanyEmployee.findOne({
            user: user._id,
            company: company._id,
            isActive: true
        });

        if (existingEmployee) {
            return res.status(400).json({
                success: false,
                message: 'You are already an employee of this company',
                field: 'email'
            });
        }

        // Get department
        const department = await Department.findById(invite.departmentId);
        if (!department) {
            return res.status(400).json({
                success: false,
                message: 'Department not found',
                field: 'inviteCode'
            });
        }

        // Assign color username
        const assignedColor = await company.assignColorUsername(user._id, null);

        // Create employee profile
        const employeeProfile = {
            type: 'employee',
            username: assignedColor,
            isActive: true,
            companyId: company._id,
            departmentId: department._id,
            isEmployeeVerified: true,
            verifiedAt: new Date(),
            colorUsername: assignedColor
        };

        user.profiles.push(employeeProfile);
        
        // Set as active profile if no active profile
        if (!user.activeProfileId) {
            user.activeProfileId = employeeProfile._id;
        }
        
        await user.save();

        // Create company employee record
        await CompanyEmployee.create({
            user: user._id,
            company: company._id,
            department: department._id,
            isVerified: true,
            verificationMethod: 'invite_code',
            verifiedAt: new Date(),
            inviteCode,
            colorUsername: assignedColor,
            joinedAt: new Date()
        });

        // Mark invite as used
        invite.usedBy = user._id;
        invite.usedAt = new Date();
        await company.save();

        // Update department employee count
        department.employeeCount += 1;
        await department.save();

        // Update company employee count
        company.employeeCount += 1;
        await company.save();

        // Generate tokens for automatic login after employee registration
        const { accessToken, refreshToken } = generateTokenPair(user);

        // Get user data (without password)
        const userData = user.toJSON();
        delete userData.password;
        delete userData.emailVerificationToken;
        delete userData.resetPasswordToken;

        // Log registration
        await AuditLog.log({
            userId: user._id,
            action: 'register_employee',
            details: { email, companyId: company._id, departmentId: department._id },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });

        res.status(201).json({
            success: true,
            message: 'Employee account created successfully!',
            accessToken,
            refreshToken,
            user: userData,
            redirectTo: '/index.html'
        });
    } catch (error) {
        console.error('Employee registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
};

/**
 * Login user
 */
const login = async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if account is locked
        if (user.isLocked()) {
            const remainingTime = Math.ceil((user.lockedUntil - new Date()) / 60000);
            return res.status(401).json({
                success: false,
                message: `Account is locked. Please try again in ${remainingTime} minutes.`
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            await user.incrementFailedLogins();
            
            await AuditLog.log({
                userId: user._id,
                action: 'login_failed',
                details: { email, reason: 'Invalid password' },
                ipAddress: getClientIP(req),
                userAgent: getUserAgent(req)
            });
            
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Reset failed login attempts on success
        await user.resetFailedLogins();

        // Update last login
        user.lastLoginAt = new Date();
        user.lastLoginIP = getClientIP(req);
        user.lastActive = new Date();
        await user.save();

        // Generate tokens
        const expiry = rememberMe ? '30d' : '7d';
        const { accessToken, refreshToken } = generateTokenPair(user);

        // Log login
        await AuditLog.log({
            userId: user._id,
            action: 'login_success',
            details: { email, rememberMe },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });

        // Get user data (without password)
        const userData = user.toJSON();
        delete userData.password;
        delete userData.emailVerificationToken;
        delete userData.resetPasswordToken;

        res.json({
            success: true,
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: userData,
            redirectTo: user.role === 'company_admin' ? '/company-dashboard.html' : '/index.html'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
};

/**
 * Refresh access token
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token required'
            });
        }

        const decoded = verifyRefreshToken(refreshToken);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user);

        res.json({
            success: true,
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token'
        });
    }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
    try {
        if (req.user) {
            await AuditLog.log({
                userId: req.user._id,
                action: 'logout',
                details: {},
                ipAddress: getClientIP(req),
                userAgent: getUserAgent(req)
            });
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
};

/**
 * Verify email
 */
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerificationExpires = null;
        await user.save();

        await AuditLog.log({
            userId: user._id,
            action: 'email_verified',
            details: {},
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });

        res.json({
            success: true,
            message: 'Email verified successfully. You can now log in.'
        });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Verification failed. Please try again.'
        });
    }
};

/**
 * Resend verification email
 */
const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email already verified'
            });
        }

        // Generate new token
        const emailVerificationToken = generateToken();
        const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        user.emailVerificationToken = emailVerificationToken;
        user.emailVerificationExpires = emailVerificationExpires;
        await user.save();

        // Send verification email
        await sendVerificationEmail(email, emailVerificationToken, user.name);

        await AuditLog.log({
            userId: user._id,
            action: 'email_verification_sent',
            details: { email },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });

        res.json({
            success: true,
            message: 'Verification email sent. Please check your inbox.'
        });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send verification email'
        });
    }
};

/**
 * Forgot password - send reset email
 */
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal that user doesn't exist for security
            return res.json({
                success: true,
                message: 'If an account exists, a password reset link has been sent.'
            });
        }

        // Generate reset token
        const resetToken = generateToken();
        const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetPasswordExpires;
        await user.save();

        // Send reset email
        await sendPasswordResetEmail(email, resetToken, user.name);

        await AuditLog.log({
            userId: user._id,
            action: 'password_reset_requested',
            details: { email },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });

        res.json({
            success: true,
            message: 'If an account exists, a password reset link has been sent.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send password reset email'
        });
    }
};

/**
 * Reset password
 */
const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired password reset token'
            });
        }

        // Update password
        user.password = password;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        await AuditLog.log({
            userId: user._id,
            action: 'password_reset_completed',
            details: {},
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });

        res.json({
            success: true,
            message: 'Password reset successfully. You can now log in with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
};

/**
 * Get current user
 */
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -emailVerificationToken -resetPasswordToken')
            .populate('profiles.companyId', 'name slug icon')
            .populate('profiles.departmentId', 'name');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Enhance profile data with company/department names
        const enhancedProfiles = user.profiles.map(profile => {
            const profileObj = profile.toObject();
            if (profile.type === 'employee' && profile.companyId) {
                profileObj.companyName = profile.companyId.name;
                profileObj.companySlug = profile.companyId.slug;
                if (profile.departmentId) {
                    profileObj.departmentName = profile.departmentId.name;
                }
            }
            return profileObj;
        });

        const userData = user.toJSON();
        userData.profiles = enhancedProfiles;

        res.json({
            success: true,
            user: userData
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user data'
        });
    }
};

module.exports = {
    register,
    registerEmployee,
    login,
    refreshToken,
    logout,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    getCurrentUser
};