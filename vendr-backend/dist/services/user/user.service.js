"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyProfile = getMyProfile;
exports.updatePreferences = updatePreferences;
exports.deleteMyAccount = deleteMyAccount;
const prisma_1 = __importDefault(require("../../lib/prisma"));
async function getMyProfile(userId) {
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            full_name: true,
            avatar_url: true,
            phone: true,
            is_verified: true,
            notifications_enabled: true,
            location_enabled: true,
            created_at: true,
            vendor: {
                select: { id: true, shop_name: true, is_active: true }
            }
        }
    });
    if (!user) {
        throw { statusCode: 404, message: 'User not found' };
    }
    // Get stats
    const [ordersCount, reviewsCount, savedCount, unreadNotifications] = await Promise.all([
        prisma_1.default.order.count({ where: { buyer_id: userId } }),
        prisma_1.default.review.count({ where: { user_id: userId } }),
        prisma_1.default.savedVendor.count({ where: { user_id: userId } }),
        prisma_1.default.notification.count({ where: { user_id: userId, is_read: false } })
    ]);
    return {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        phone: user.phone,
        is_verified: user.is_verified,
        notifications_enabled: user.notifications_enabled,
        location_enabled: user.location_enabled,
        created_at: user.created_at.toISOString(),
        vendor: user.vendor,
        stats: {
            orders: ordersCount,
            reviews: reviewsCount,
            saved: savedCount
        },
        unread_notifications_count: unreadNotifications
    };
}
async function updatePreferences(userId, input) {
    const user = await prisma_1.default.user.update({
        where: { id: userId },
        data: {
            ...(input.notifications_enabled !== undefined && { notifications_enabled: input.notifications_enabled }),
            ...(input.location_enabled !== undefined && { location_enabled: input.location_enabled }),
        },
        select: {
            id: true,
            notifications_enabled: true,
            location_enabled: true
        }
    });
    return user;
}
async function deleteMyAccount(userId) {
    // Soft delete
    const user = await prisma_1.default.user.update({
        where: { id: userId },
        data: {
            is_deleted: true,
            deleted_at: new Date()
        },
        select: { id: true, email: true }
    });
    // Invalidate all refresh tokens
    await prisma_1.default.refreshToken.deleteMany({ where: { user_id: userId } });
    return user;
}
//# sourceMappingURL=user.service.js.map