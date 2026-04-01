import { z } from 'zod';
export declare const updatePreferencesSchema: z.ZodObject<{
    notifications_enabled: z.ZodOptional<z.ZodBoolean>;
    location_enabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    notifications_enabled?: boolean | undefined;
    location_enabled?: boolean | undefined;
}, {
    notifications_enabled?: boolean | undefined;
    location_enabled?: boolean | undefined;
}>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export declare const getMyProfileOutputSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    full_name: z.ZodNullable<z.ZodString>;
    avatar_url: z.ZodNullable<z.ZodString>;
    phone: z.ZodNullable<z.ZodString>;
    is_verified: z.ZodBoolean;
    notifications_enabled: z.ZodBoolean;
    location_enabled: z.ZodBoolean;
    created_at: z.ZodString;
    vendor: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        shop_name: z.ZodString;
        is_active: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        shop_name: string;
        is_active: boolean;
    }, {
        id: string;
        shop_name: string;
        is_active: boolean;
    }>>;
    stats: z.ZodObject<{
        orders: z.ZodNumber;
        reviews: z.ZodNumber;
        saved: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        orders: number;
        reviews: number;
        saved: number;
    }, {
        orders: number;
        reviews: number;
        saved: number;
    }>;
    unread_notifications_count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    email: string;
    full_name: string | null;
    id: string;
    avatar_url: string | null;
    phone: string | null;
    is_verified: boolean;
    notifications_enabled: boolean;
    location_enabled: boolean;
    created_at: string;
    vendor: {
        id: string;
        shop_name: string;
        is_active: boolean;
    } | null;
    stats: {
        orders: number;
        reviews: number;
        saved: number;
    };
    unread_notifications_count: number;
}, {
    email: string;
    full_name: string | null;
    id: string;
    avatar_url: string | null;
    phone: string | null;
    is_verified: boolean;
    notifications_enabled: boolean;
    location_enabled: boolean;
    created_at: string;
    vendor: {
        id: string;
        shop_name: string;
        is_active: boolean;
    } | null;
    stats: {
        orders: number;
        reviews: number;
        saved: number;
    };
    unread_notifications_count: number;
}>;
export type GetMyProfileOutput = z.infer<typeof getMyProfileOutputSchema>;
//# sourceMappingURL=user.schema.d.ts.map