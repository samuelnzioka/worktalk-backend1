/**
 * Email Service
 * Handles sending all email notifications
 */

const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Send email
 * @param {Object} options - Email options
 * @returns {Promise}
 */
const sendEmail = async (options) => {
    try {
        const mailOptions = {
            from: `"WorkTalk" <${process.env.SMTP_FROM}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('Email send error:', error);
        throw error;
    }
};

/**
 * Send verification email
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 * @param {string} name - User's name
 */
const sendVerificationEmail = async (email, token, name) => {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email.html?token=${token}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Verify Your Email</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 20px; background: #2563eb; color: white; border-radius: 10px; }
                .content { padding: 30px; background: #f9fafb; border-radius: 10px; margin-top: 20px; }
                .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>WorkTalk</h1>
                </div>
                <div class="content">
                    <h2>Hello ${name},</h2>
                    <p>Thank you for registering with WorkTalk! Please verify your email address to get started.</p>
                    <p style="text-align: center;">
                        <a href="${verificationUrl}" class="button">Verify Email Address</a>
                    </p>
                    <p>Or copy and paste this link: <br> ${verificationUrl}</p>
                    <p>This link will expire in 24 hours.</p>
                    <hr>
                    <p>If you didn't create an account with WorkTalk, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2024 WorkTalk. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const text = `Hello ${name},\n\nPlease verify your email address by clicking this link: ${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, please ignore this email.`;
    
    return sendEmail({
        to: email,
        subject: 'Verify Your WorkTalk Account',
        html,
        text
    });
};

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 * @param {string} name - User's name
 */
const sendPasswordResetEmail = async (email, token, name) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reset Your Password</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 20px; background: #2563eb; color: white; border-radius: 10px; }
                .content { padding: 30px; background: #f9fafb; border-radius: 10px; margin-top: 20px; }
                .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>WorkTalk</h1>
                </div>
                <div class="content">
                    <h2>Hello ${name},</h2>
                    <p>We received a request to reset your password. Click the button below to create a new password.</p>
                    <p style="text-align: center;">
                        <a href="${resetUrl}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link: <br> ${resetUrl}</p>
                    <p>This link will expire in 1 hour.</p>
                    <hr>
                    <p>If you didn't request a password reset, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2024 WorkTalk. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const text = `Hello ${name},\n\nReset your password by clicking this link: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`;
    
    return sendEmail({
        to: email,
        subject: 'Reset Your WorkTalk Password',
        html,
        text
    });
};

/**
 * Send employee invite email
 * @param {string} email - Recipient email
 * @param {string} inviteCode - Invite code
 * @param {string} companyName - Company name
 * @param {string} departmentName - Department name
 * @param {string} inviterName - Person who sent the invite
 */
const sendEmployeeInviteEmail = async (email, inviteCode, companyName, departmentName, inviterName) => {
    const inviteUrl = `${process.env.FRONTEND_URL}/invite-accept.html?code=${inviteCode}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>You've Been Invited to Join WorkTalk</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 20px; background: #10b981; color: white; border-radius: 10px; }
                .content { padding: 30px; background: #f9fafb; border-radius: 10px; margin-top: 20px; }
                .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
                .invite-code { background: #f3f4f6; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 18px; text-align: center; letter-spacing: 2px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>WorkTalk</h1>
                </div>
                <div class="content">
                    <h2>Hello,</h2>
                    <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on WorkTalk.</p>
                    <p>You've been added to the <strong>${departmentName}</strong> department.</p>
                    <p>Click the button below to create your account and join your company's private space.</p>
                    <p style="text-align: center;">
                        <a href="${inviteUrl}" class="button">Accept Invitation</a>
                    </p>
                    <p>Or use this invite code: <br><div class="invite-code">${inviteCode}</div></p>
                    <p>This invite will expire in 7 days.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2024 WorkTalk. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const text = `You've been invited to join ${companyName} on WorkTalk.\n\nInvite code: ${inviteCode}\n\nAccept here: ${inviteUrl}\n\nThis invite expires in 7 days.`;
    
    return sendEmail({
        to: email,
        subject: `Invitation to join ${companyName} on WorkTalk`,
        html,
        text
    });
};

/**
 * Send company verification email (to admin)
 * @param {string} email - Admin email
 * @param {string} companyName - Company name
 */
const sendCompanyVerificationEmail = async (email, companyName) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Company Registration Received</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 20px; background: #f59e0b; color: white; border-radius: 10px; }
                .content { padding: 30px; background: #f9fafb; border-radius: 10px; margin-top: 20px; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>WorkTalk</h1>
                </div>
                <div class="content">
                    <h2>Company Registration Received</h2>
                    <p>Thank you for registering <strong>${companyName}</strong> on WorkTalk.</p>
                    <p>Our team will review your application within 2-3 business days. You will receive an email once your company is verified.</p>
                    <p>Once verified, you'll be able to:</p>
                    <ul>
                        <li>Invite employees to join</li>
                        <li>Create department spaces</li>
                        <li>Moderate discussions</li>
                        <li>View analytics</li>
                    </ul>
                    <p>If you have any questions, please contact our support team.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2024 WorkTalk. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return sendEmail({
        to: email,
        subject: `WorkTalk - ${companyName} Registration Received`,
        html,
        text: `Thank you for registering ${companyName} on WorkTalk. Our team will review your application within 2-3 business days.`
    });
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendEmployeeInviteEmail,
    sendCompanyVerificationEmail
};