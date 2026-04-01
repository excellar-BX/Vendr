"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.googleAuth = googleAuth;
exports.verifyEmail = verifyEmail;
exports.resendVerification = resendVerification;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.refresh = refresh;
exports.logout = logout;
exports.getMe = getMe;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const google_auth_library_1 = require("google-auth-library");
const prisma_1 = __importDefault(require("../../lib/prisma"));
const env_1 = require("../../config/env");
const email_1 = require("../../lib/email");
const googleClient = new google_auth_library_1.OAuth2Client(env_1.env.GOOGLE_CLIENT_ID);
// ─── Token helpers ────────────────────────────────────────────────────────────
function generateAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_ACCESS_SECRET, {
        expiresIn: env_1.env.JWT_ACCESS_EXPIRES_IN,
    });
}
function generateRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_REFRESH_SECRET, {
        expiresIn: env_1.env.JWT_REFRESH_EXPIRES_IN,
    });
}
function getRefreshTokenExpiry() {
    const days = parseInt(env_1.env.JWT_REFRESH_EXPIRES_IN.replace('d', ''), 10) || 30;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
}
function generateSecureToken() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
// ─── Register ─────────────────────────────────────────────────────────────────
async function register(input) {
    const existing = await prisma_1.default.user.findUnique({ where: { email: input.email } });
    if (existing) {
        throw { statusCode: 409, message: 'Email already in use' };
    }
    const hashed = await bcryptjs_1.default.hash(input.password, 12);
    const user = await prisma_1.default.user.create({
        data: {
            email: input.email,
            password: hashed,
            full_name: input.full_name,
        },
        select: { id: true, email: true, full_name: true, avatar_url: true, created_at: true },
    });
    // Create email verification token (24h expiry)
    const verifyToken = generateSecureToken();
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma_1.default.emailVerificationToken.create({
        data: { token: verifyToken, user_id: user.id, expires_at: verifyExpiry },
    });
    await (0, email_1.sendVerificationEmail)(user.email, verifyToken);
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });
    await prisma_1.default.refreshToken.create({
        data: { token: refreshToken, user_id: user.id, expires_at: getRefreshTokenExpiry() },
    });
    return { user, accessToken, refreshToken };
}
// ─── Login ────────────────────────────────────────────────────────────────────
async function login(input) {
    const user = await prisma_1.default.user.findUnique({ where: { email: input.email } });
    if (!user || !user.password) {
        throw { statusCode: 401, message: 'Invalid email or password' };
    }
    const valid = await bcryptjs_1.default.compare(input.password, user.password);
    if (!valid) {
        throw { statusCode: 401, message: 'Invalid email or password' };
    }
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });
    await prisma_1.default.refreshToken.create({
        data: { token: refreshToken, user_id: user.id, expires_at: getRefreshTokenExpiry() },
    });
    const { password: _pw, ...safeUser } = user;
    return { user: safeUser, accessToken, refreshToken };
}
// ─── Google OAuth ─────────────────────────────────────────────────────────────
async function googleAuth(input) {
    const ticket = await googleClient.verifyIdToken({
        idToken: input.id_token,
        audience: env_1.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
        throw { statusCode: 401, message: 'Invalid Google token' };
    }
    let user = await prisma_1.default.user.findUnique({ where: { email: payload.email } });
    if (!user) {
        user = await prisma_1.default.user.create({
            data: {
                email: payload.email,
                full_name: payload.name ?? null,
                avatar_url: payload.picture ?? null,
                google_id: payload.sub,
                is_verified: true, // Google accounts are pre-verified
            },
        });
    }
    else if (!user.google_id) {
        user = await prisma_1.default.user.update({
            where: { id: user.id },
            data: { google_id: payload.sub, is_verified: true },
        });
    }
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });
    await prisma_1.default.refreshToken.create({
        data: { token: refreshToken, user_id: user.id, expires_at: getRefreshTokenExpiry() },
    });
    const { password: _pw, ...safeUser } = user;
    return { user: safeUser, accessToken, refreshToken };
}
// ─── Verify Email ─────────────────────────────────────────────────────────────
async function verifyEmail(token) {
    const record = await prisma_1.default.emailVerificationToken.findUnique({ where: { token } });
    if (!record) {
        throw { statusCode: 400, message: 'Invalid verification token' };
    }
    if (record.expires_at < new Date()) {
        await prisma_1.default.emailVerificationToken.delete({ where: { token } });
        throw { statusCode: 400, message: 'Verification token has expired' };
    }
    await prisma_1.default.user.update({
        where: { id: record.user_id },
        data: { is_verified: true },
    });
    await prisma_1.default.emailVerificationToken.delete({ where: { token } });
    return { message: 'Email verified successfully' };
}
// ─── Resend Verification ──────────────────────────────────────────────────────
async function resendVerification(email) {
    const user = await prisma_1.default.user.findUnique({ where: { email } });
    // Always return success to avoid email enumeration
    if (!user || user.is_verified)
        return;
    // Delete any existing tokens for this user
    await prisma_1.default.emailVerificationToken.deleteMany({ where: { user_id: user.id } });
    const token = generateSecureToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma_1.default.emailVerificationToken.create({
        data: { token, user_id: user.id, expires_at: expiry },
    });
    await (0, email_1.sendVerificationEmail)(email, token);
}
// ─── Forgot Password ──────────────────────────────────────────────────────────
async function forgotPassword(email) {
    const user = await prisma_1.default.user.findUnique({ where: { email } });
    // Always return success to avoid email enumeration
    if (!user || !user.password)
        return;
    // Delete any existing reset tokens for this user
    await prisma_1.default.passwordResetToken.deleteMany({ where: { user_id: user.id } });
    const token = generateSecureToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma_1.default.passwordResetToken.create({
        data: { token, user_id: user.id, expires_at: expiry },
    });
    await (0, email_1.sendPasswordResetEmail)(email, token);
}
// ─── Reset Password ───────────────────────────────────────────────────────────
async function resetPassword(token, newPassword) {
    const record = await prisma_1.default.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.used) {
        throw { statusCode: 400, message: 'Invalid or already used reset token' };
    }
    if (record.expires_at < new Date()) {
        await prisma_1.default.passwordResetToken.delete({ where: { token } });
        throw { statusCode: 400, message: 'Reset token has expired' };
    }
    const hashed = await bcryptjs_1.default.hash(newPassword, 12);
    await prisma_1.default.user.update({
        where: { id: record.user_id },
        data: { password: hashed },
    });
    // Mark token as used and invalidate all refresh tokens (force re-login)
    await prisma_1.default.passwordResetToken.update({ where: { token }, data: { used: true } });
    await prisma_1.default.refreshToken.deleteMany({ where: { user_id: record.user_id } });
}
// ─── Refresh ──────────────────────────────────────────────────────────────────
async function refresh(token) {
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_REFRESH_SECRET);
    }
    catch {
        throw { statusCode: 401, message: 'Invalid or expired refresh token' };
    }
    const stored = await prisma_1.default.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expires_at < new Date()) {
        throw { statusCode: 401, message: 'Refresh token not found or expired' };
    }
    await prisma_1.default.refreshToken.delete({ where: { token } });
    const newAccessToken = generateAccessToken({ id: decoded.id, email: decoded.email });
    const newRefreshToken = generateRefreshToken({ id: decoded.id, email: decoded.email });
    await prisma_1.default.refreshToken.create({
        data: { token: newRefreshToken, user_id: decoded.id, expires_at: getRefreshTokenExpiry() },
    });
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}
// ─── Logout ───────────────────────────────────────────────────────────────────
async function logout(token) {
    await prisma_1.default.refreshToken.deleteMany({ where: { token } });
}
// ─── Me ───────────────────────────────────────────────────────────────────────
async function getMe(userId) {
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            full_name: true,
            avatar_url: true,
            phone: true,
            is_verified: true,
            is_deleted: true,
            notifications_enabled: true,
            location_enabled: true,
            created_at: true,
            vendor: {
                select: { id: true, shop_name: true, is_active: true },
            },
        },
    });
    if (!user) {
        throw { statusCode: 404, message: 'User not found' };
    }
    // Convert Date to ISO string for JSON serialization
    return {
        ...user,
        created_at: user.created_at.toISOString()
    };
}
//# sourceMappingURL=auth.service.js.map