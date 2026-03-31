/**
 * Invite Controller
 * Handles invite code verification and management
 */

const Company = require('../models/company');
const Department = require('../models/department');
const AuditLog = require('../models/auditlog');
const { generateInviteCode, getClientIP, getUserAgent } = require('../utils/helpers');

/**
 * Verify invite code (public)
 */
const verifyInvite = async (req, res) => {
    try {
        const { code } = req.params;
        
        const company = await Company.findOne({
            'inviteCodes.code': code,
            'inviteCodes.expiresAt': { $gt: new Date() },
            'inviteCodes.usedBy': null
        });
        
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired invite code'
            });
        }
        
        const invite = company.inviteCodes.find(i => i.code === code);
        const department = await Department.findById(invite.departmentId);
        
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }
        
        res.json({
            success: true,
            invite: {
                code: invite.code,
                companyName: company.name,
                companyIcon: company.icon,
                departmentName: department.name,
                emailDomain: company.emailDomain,
                expiresAt: invite.expiresAt
            }
        });
    } catch (error) {
        console.error('Verify invite error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify invite code'
        });
    }
};

/**
 * Generate invite code (company admin)
 */
const generateInvite = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { departmentId } = req.body;
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        const department = await Department.findById(departmentId);
        if (!department || department.companyId.toString() !== companyId) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }
        
        const inviteCode = generateInviteCode();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        company.inviteCodes.push({
            code: inviteCode,
            departmentId,
            createdBy: req.user._id,
            expiresAt,
            createdAt: new Date()
        });
        
        await company.save();
        
        await AuditLog.create({
            user: req.user._id,
            action: 'invite_created',
            details: { companyId, departmentId, inviteCode },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.status(201).json({
            success: true,
            message: 'Invite code generated successfully',
            inviteCode,
            expiresAt
        });
    } catch (error) {
        console.error('Generate invite error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate invite code'
        });
    }
};

/**
 * Get company invites (company admin)
 */
const getCompanyInvites = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const company = await Company.findById(companyId)
            .select('inviteCodes')
            .populate('inviteCodes.departmentId', 'name');
        
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        const invites = company.inviteCodes.map(invite => ({
            id: invite._id,
            code: invite.code,
            departmentId: invite.departmentId,
            departmentName: invite.departmentId?.name,
            usedBy: invite.usedBy,
            usedAt: invite.usedAt,
            expiresAt: invite.expiresAt,
            createdAt: invite.createdAt,
            isUsed: !!invite.usedBy,
            isExpired: new Date() > invite.expiresAt
        }));
        
        res.json({
            success: true,
            invites
        });
    } catch (error) {
        console.error('Get company invites error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get invites'
        });
    }
};

/**
 * Revoke invite code (company admin)
 */
const revokeInvite = async (req, res) => {
    try {
        const { companyId, inviteId } = req.params;
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        
        const inviteIndex = company.inviteCodes.findIndex(i => i._id.toString() === inviteId);
        if (inviteIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Invite not found'
            });
        }
        
        // Remove invite (or mark as expired)
        company.inviteCodes.splice(inviteIndex, 1);
        await company.save();
        
        await AuditLog.create({
            user: req.user._id,
            action: 'invite_revoked',
            details: { companyId, inviteId },
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req)
        });
        
        res.json({
            success: true,
            message: 'Invite revoked successfully'
        });
    } catch (error) {
        console.error('Revoke invite error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to revoke invite'
        });
    }
};

module.exports = {
    verifyInvite,
    generateInvite,
    getCompanyInvites,
    revokeInvite
};