"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().min(1),
    JWT_ACCESS_SECRET: zod_1.z.string().min(1),
    JWT_REFRESH_SECRET: zod_1.z.string().min(1),
    JWT_ACCESS_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('30d'),
    GOOGLE_CLIENT_ID: zod_1.z.string().min(1),
    RESEND_API_KEY: zod_1.z.string().min(1),
    PORT: zod_1.z.coerce.number().default(3000),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = parsed.data;
//# sourceMappingURL=env.js.map