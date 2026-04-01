"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyProfileOutputSchema = exports.updatePreferencesSchema = void 0;
const zod_1 = require("zod");
exports.updatePreferencesSchema = zod_1.z.object({
    notifications_enabled: zod_1.z.boolean().optional(),
    location_enabled: zod_1.z.boolean().optional()
});
exports.getMyProfileOutputSchema = zod_1.z.object({
    id: zod_1.z.string(),
    email: zod_1.z.string(),
    full_name: zod_1.z.string().nullable(),
    avatar_url: zod_1.z.string().nullable(),
    phone: zod_1.z.string().nullable(),
    is_verified: zod_1.z.boolean(),
    notifications_enabled: zod_1.z.boolean(),
    location_enabled: zod_1.z.boolean(),
    created_at: zod_1.z.string(),
    vendor: zod_1.z.object({
        id: zod_1.z.string(),
        shop_name: zod_1.z.string(),
        is_active: zod_1.z.boolean()
    }).nullable(),
    stats: zod_1.z.object({
        orders: zod_1.z.number(),
        reviews: zod_1.z.number(),
        saved: zod_1.z.number()
    }),
    unread_notifications_count: zod_1.z.number()
});
//# sourceMappingURL=user.schema.js.map