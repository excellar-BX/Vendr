"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerController = registerController;
exports.loginController = loginController;
exports.googleAuthController = googleAuthController;
exports.refreshController = refreshController;
exports.logoutController = logoutController;
exports.getMeController = getMeController;
exports.verifyEmailController = verifyEmailController;
exports.resendVerificationController = resendVerificationController;
exports.forgotPasswordController = forgotPasswordController;
exports.resetPasswordController = resetPasswordController;
const AuthService = __importStar(require("./auth.service"));
const auth_schema_1 = require("./auth.schema");
async function registerController(request, reply) {
    const parsed = auth_schema_1.registerSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    try {
        const result = await AuthService.register(parsed.data);
        return reply.status(201).send({ success: true, data: result });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
async function loginController(request, reply) {
    const parsed = auth_schema_1.loginSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    try {
        const result = await AuthService.login(parsed.data);
        return reply.status(200).send({ success: true, data: result });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
async function googleAuthController(request, reply) {
    const parsed = auth_schema_1.googleAuthSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    try {
        const result = await AuthService.googleAuth(parsed.data);
        return reply.status(200).send({ success: true, data: result });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
async function refreshController(request, reply) {
    const parsed = auth_schema_1.refreshSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    try {
        const result = await AuthService.refresh(parsed.data.refresh_token);
        return reply.status(200).send({ success: true, data: result });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
async function logoutController(request, reply) {
    const parsed = auth_schema_1.refreshSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    try {
        await AuthService.logout(parsed.data.refresh_token);
        return reply.status(200).send({ success: true, message: 'Logged out successfully' });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
async function getMeController(request, reply) {
    try {
        const user = await AuthService.getMe(request.user.id);
        return reply.status(200).send({ success: true, data: user });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
async function verifyEmailController(request, reply) {
    const parsed = auth_schema_1.verifyEmailSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    try {
        const result = await AuthService.verifyEmail(parsed.data.token);
        return reply.status(200).send({ success: true, data: result });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
async function resendVerificationController(request, reply) {
    const parsed = auth_schema_1.resendVerificationSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    try {
        await AuthService.resendVerification(parsed.data.email);
        return reply.status(200).send({ success: true, message: 'If that email exists, a verification link has been sent' });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
async function forgotPasswordController(request, reply) {
    const parsed = auth_schema_1.forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    try {
        await AuthService.forgotPassword(parsed.data.email);
        return reply.status(200).send({ success: true, message: 'If that email exists, a reset link has been sent' });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
async function resetPasswordController(request, reply) {
    const parsed = auth_schema_1.resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    try {
        await AuthService.resetPassword(parsed.data.token, parsed.data.new_password);
        return reply.status(200).send({ success: true, message: 'Password reset successfully. Please log in again.' });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
//# sourceMappingURL=auth.controller.js.map