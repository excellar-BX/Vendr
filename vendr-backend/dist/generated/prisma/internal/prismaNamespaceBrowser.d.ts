import * as runtime from "@prisma/client/runtime/index-browser";
export type * from '../models';
export type * from './prismaNamespace';
export declare const Decimal: typeof runtime.Decimal;
export declare const NullTypes: {
    DbNull: (new (secret: never) => typeof runtime.DbNull);
    JsonNull: (new (secret: never) => typeof runtime.JsonNull);
    AnyNull: (new (secret: never) => typeof runtime.AnyNull);
};
/**
 * Helper for filtering JSON entries that have `null` on the database (empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const DbNull: import("@prisma/client-runtime-utils").DbNullClass;
/**
 * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
/**
 * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const AnyNull: import("@prisma/client-runtime-utils").AnyNullClass;
export declare const ModelName: {
    readonly User: "User";
    readonly RefreshToken: "RefreshToken";
    readonly EmailVerificationToken: "EmailVerificationToken";
    readonly PasswordResetToken: "PasswordResetToken";
    readonly Vendor: "Vendor";
    readonly Order: "Order";
    readonly Review: "Review";
    readonly SavedVendor: "SavedVendor";
    readonly Notification: "Notification";
    readonly Product: "Product";
};
export type ModelName = (typeof ModelName)[keyof typeof ModelName];
export declare const TransactionIsolationLevel: {
    readonly ReadUncommitted: "ReadUncommitted";
    readonly ReadCommitted: "ReadCommitted";
    readonly RepeatableRead: "RepeatableRead";
    readonly Serializable: "Serializable";
};
export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];
export declare const UserScalarFieldEnum: {
    readonly id: "id";
    readonly email: "email";
    readonly password: "password";
    readonly full_name: "full_name";
    readonly avatar_url: "avatar_url";
    readonly phone: "phone";
    readonly google_id: "google_id";
    readonly is_verified: "is_verified";
    readonly is_deleted: "is_deleted";
    readonly deleted_at: "deleted_at";
    readonly notifications_enabled: "notifications_enabled";
    readonly location_enabled: "location_enabled";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum];
export declare const RefreshTokenScalarFieldEnum: {
    readonly id: "id";
    readonly token: "token";
    readonly user_id: "user_id";
    readonly expires_at: "expires_at";
    readonly created_at: "created_at";
};
export type RefreshTokenScalarFieldEnum = (typeof RefreshTokenScalarFieldEnum)[keyof typeof RefreshTokenScalarFieldEnum];
export declare const EmailVerificationTokenScalarFieldEnum: {
    readonly id: "id";
    readonly token: "token";
    readonly user_id: "user_id";
    readonly expires_at: "expires_at";
    readonly created_at: "created_at";
};
export type EmailVerificationTokenScalarFieldEnum = (typeof EmailVerificationTokenScalarFieldEnum)[keyof typeof EmailVerificationTokenScalarFieldEnum];
export declare const PasswordResetTokenScalarFieldEnum: {
    readonly id: "id";
    readonly token: "token";
    readonly user_id: "user_id";
    readonly expires_at: "expires_at";
    readonly used: "used";
    readonly created_at: "created_at";
};
export type PasswordResetTokenScalarFieldEnum = (typeof PasswordResetTokenScalarFieldEnum)[keyof typeof PasswordResetTokenScalarFieldEnum];
export declare const VendorScalarFieldEnum: {
    readonly id: "id";
    readonly user_id: "user_id";
    readonly shop_name: "shop_name";
    readonly description: "description";
    readonly category: "category";
    readonly city: "city";
    readonly address: "address";
    readonly logo_url: "logo_url";
    readonly lat: "lat";
    readonly lng: "lng";
    readonly is_verified: "is_verified";
    readonly is_active: "is_active";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type VendorScalarFieldEnum = (typeof VendorScalarFieldEnum)[keyof typeof VendorScalarFieldEnum];
export declare const OrderScalarFieldEnum: {
    readonly id: "id";
    readonly buyer_id: "buyer_id";
    readonly vendor_id: "vendor_id";
    readonly total: "total";
    readonly status: "status";
    readonly created_at: "created_at";
};
export type OrderScalarFieldEnum = (typeof OrderScalarFieldEnum)[keyof typeof OrderScalarFieldEnum];
export declare const ReviewScalarFieldEnum: {
    readonly id: "id";
    readonly user_id: "user_id";
    readonly vendor_id: "vendor_id";
    readonly rating: "rating";
    readonly comment: "comment";
    readonly created_at: "created_at";
};
export type ReviewScalarFieldEnum = (typeof ReviewScalarFieldEnum)[keyof typeof ReviewScalarFieldEnum];
export declare const SavedVendorScalarFieldEnum: {
    readonly id: "id";
    readonly user_id: "user_id";
    readonly vendor_id: "vendor_id";
    readonly created_at: "created_at";
};
export type SavedVendorScalarFieldEnum = (typeof SavedVendorScalarFieldEnum)[keyof typeof SavedVendorScalarFieldEnum];
export declare const NotificationScalarFieldEnum: {
    readonly id: "id";
    readonly user_id: "user_id";
    readonly title: "title";
    readonly body: "body";
    readonly type: "type";
    readonly data: "data";
    readonly is_read: "is_read";
    readonly created_at: "created_at";
};
export type NotificationScalarFieldEnum = (typeof NotificationScalarFieldEnum)[keyof typeof NotificationScalarFieldEnum];
export declare const ProductScalarFieldEnum: {
    readonly id: "id";
    readonly vendor_id: "vendor_id";
    readonly name: "name";
    readonly description: "description";
    readonly price: "price";
    readonly image_url: "image_url";
    readonly in_stock: "in_stock";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type ProductScalarFieldEnum = (typeof ProductScalarFieldEnum)[keyof typeof ProductScalarFieldEnum];
export declare const SortOrder: {
    readonly asc: "asc";
    readonly desc: "desc";
};
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
export declare const NullableJsonNullValueInput: {
    readonly DbNull: import("@prisma/client-runtime-utils").DbNullClass;
    readonly JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
};
export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput];
export declare const QueryMode: {
    readonly default: "default";
    readonly insensitive: "insensitive";
};
export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];
export declare const NullsOrder: {
    readonly first: "first";
    readonly last: "last";
};
export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];
export declare const JsonNullValueFilter: {
    readonly DbNull: import("@prisma/client-runtime-utils").DbNullClass;
    readonly JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
    readonly AnyNull: import("@prisma/client-runtime-utils").AnyNullClass;
};
export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter];
//# sourceMappingURL=prismaNamespaceBrowser.d.ts.map