import type { RegisterInput, LoginInput, GoogleAuthInput } from './auth.schema';
export declare function register(input: RegisterInput): Promise<{
    user: {
        email: string;
        full_name: string | null;
        id: string;
        avatar_url: string | null;
        created_at: Date;
    };
    accessToken: string;
    refreshToken: string;
}>;
export declare function login(input: LoginInput): Promise<{
    user: {
        email: string;
        full_name: string | null;
        id: string;
        google_id: string | null;
        avatar_url: string | null;
        phone: string | null;
        is_verified: boolean;
        is_deleted: boolean;
        deleted_at: Date | null;
        notifications_enabled: boolean;
        location_enabled: boolean;
        created_at: Date;
        updated_at: Date;
    };
    accessToken: string;
    refreshToken: string;
}>;
export declare function googleAuth(input: GoogleAuthInput): Promise<{
    user: {
        email: string;
        full_name: string | null;
        id: string;
        google_id: string | null;
        avatar_url: string | null;
        phone: string | null;
        is_verified: boolean;
        is_deleted: boolean;
        deleted_at: Date | null;
        notifications_enabled: boolean;
        location_enabled: boolean;
        created_at: Date;
        updated_at: Date;
    };
    accessToken: string;
    refreshToken: string;
}>;
export declare function verifyEmail(token: string): Promise<{
    message: string;
}>;
export declare function resendVerification(email: string): Promise<void>;
export declare function forgotPassword(email: string): Promise<void>;
export declare function resetPassword(token: string, newPassword: string): Promise<void>;
export declare function refresh(token: string): Promise<{
    accessToken: string;
    refreshToken: string;
}>;
export declare function logout(token: string): Promise<void>;
export declare function getMe(userId: string): Promise<{
    created_at: string;
    email: string;
    full_name: string | null;
    id: string;
    avatar_url: string | null;
    phone: string | null;
    is_verified: boolean;
    is_deleted: boolean;
    notifications_enabled: boolean;
    location_enabled: boolean;
    vendor: {
        id: string;
        shop_name: string;
        is_active: boolean;
    } | null;
}>;
//# sourceMappingURL=auth.service.d.ts.map