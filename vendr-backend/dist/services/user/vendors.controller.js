"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVendorsController = getVendorsController;
const prisma_1 = __importDefault(require("../../lib/prisma"));
async function getVendorsController(_request, reply) {
    try {
        const vendors = await prisma_1.default.vendor.findMany({
            where: { is_active: true },
            select: {
                id: true,
                user_id: true,
                shop_name: true,
                description: true,
                category: true,
                city: true,
                address: true,
                logo_url: true,
                lat: true,
                lng: true,
                is_verified: true,
                is_active: true,
                created_at: true,
                user: {
                    select: {
                        full_name: true,
                        avatar_url: true
                    }
                }
            }
        });
        // Get review counts and average ratings for all vendors
        const vendorReviews = await prisma_1.default.review.groupBy({
            by: ['vendor_id'],
            where: { vendor_id: { in: vendors.map(v => v.id) } },
            _avg: { rating: true },
            _count: { rating: true }
        });
        const reviewMap = new Map();
        vendorReviews.forEach(r => {
            reviewMap.set(r.vendor_id, { avg: r._avg.rating ?? 0, count: r._count.rating });
        });
        // Transform to match frontend expectations
        const transformed = vendors.map(v => {
            const reviews = reviewMap.get(v.id);
            return {
                id: v.id,
                user_id: v.user_id,
                business_name: v.shop_name,
                description: v.description,
                category: v.category,
                city: v.city,
                address: v.address,
                logo_url: v.logo_url,
                is_active: v.is_active,
                is_verified: v.is_verified,
                lat: v.lat ?? 0,
                lng: v.lng ?? 0,
                rating: reviews ? parseFloat(reviews.avg.toFixed(1)) : 0,
                review_count: reviews?.count ?? 0,
                avatar_url: v.user?.avatar_url,
                banner_url: undefined,
                created_at: v.created_at.toISOString(),
                distance: undefined // computed client-side
            };
        });
        return reply.status(200).send({ success: true, data: transformed });
    }
    catch (err) {
        return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
}
//# sourceMappingURL=vendors.controller.js.map