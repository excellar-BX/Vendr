"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = userRoutes;
const authenticate_1 = require("../../middlewares/authenticate");
const user_controller_1 = require("./user.controller");
const vendors_controller_1 = require("./vendors.controller");
async function userRoutes(app) {
    // Protected - Profile
    app.get('/users/me', { preHandler: authenticate_1.authenticate }, user_controller_1.getMyProfileController);
    app.patch('/users/me/preferences', { preHandler: authenticate_1.authenticate }, user_controller_1.updatePreferencesController);
    app.delete('/users/me', { preHandler: authenticate_1.authenticate }, user_controller_1.deleteMyAccountController);
    // Public - Vendors
    app.get('/vendors', vendors_controller_1.getVendorsController);
}
//# sourceMappingURL=user.routes.js.map