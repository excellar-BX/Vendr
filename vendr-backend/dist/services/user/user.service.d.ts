import type { GetMyProfileOutput, UpdatePreferencesInput } from './user.schema';
export declare function getMyProfile(userId: string): Promise<GetMyProfileOutput>;
export declare function updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<{
    id: string;
    notifications_enabled: boolean;
    location_enabled: boolean;
}>;
export declare function deleteMyAccount(userId: string): Promise<{
    email: string;
    id: string;
}>;
//# sourceMappingURL=user.service.d.ts.map