"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const authenticate_1 = require("../../middlewares/authenticate");
const auth_controller_1 = require("./auth.controller");
async function authRoutes(app) {
    // Public
    app.post('/auth/register', auth_controller_1.registerController);
    app.post('/auth/login', auth_controller_1.loginController);
    app.post('/auth/google', auth_controller_1.googleAuthController);
    app.post('/auth/refresh', auth_controller_1.refreshController);
    app.post('/auth/logout', auth_controller_1.logoutController);
    // Email verification
    app.post('/auth/verify-email', auth_controller_1.verifyEmailController);
    app.post('/auth/resend-verification', auth_controller_1.resendVerificationController);
    // Password reset
    app.post('/auth/forgot-password', auth_controller_1.forgotPasswordController);
    app.post('/auth/reset-password', auth_controller_1.resetPasswordController);
    // Protected
    app.get('/auth/me', { preHandler: authenticate_1.authenticate }, auth_controller_1.getMeController);
}
//# sourceMappingURL=auth.routes.js.map