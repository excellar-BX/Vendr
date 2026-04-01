"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.resendVerificationSchema = exports.verifyEmailSchema = exports.refreshSchema = exports.googleAuthSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    full_name: zod_1.z.string().min(1, 'Full name is required'),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.googleAuthSchema = zod_1.z.object({
    id_token: zod_1.z.string().min(1, 'Google ID token is required'),
});
exports.refreshSchema = zod_1.z.object({
    refresh_token: zod_1.z.string().min(1, 'Refresh token is required'),
});
exports.verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
});
exports.resendVerificationSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
    new_password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
//# sourceMappingURL=auth.schema.js.map