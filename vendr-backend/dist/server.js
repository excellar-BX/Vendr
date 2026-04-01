"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = buildServer;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const auth_routes_1 = require("./services/auth/auth.routes");
const user_routes_1 = require("./services/user/user.routes");
async function buildServer() {
    const app = (0, fastify_1.default)({
        logger: process.env.NODE_ENV === 'development',
    });
    // ─── Plugins ──────────────────────────────────────────────────────────────
    await app.register(cors_1.default, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    // ─── Routes ───────────────────────────────────────────────────────────────
    await app.register(auth_routes_1.authRoutes, { prefix: '/api' });
    await app.register(user_routes_1.userRoutes, { prefix: '/api' });
    // ─── Health check ─────────────────────────────────────────────────────────
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
    return app;
}
//# sourceMappingURL=server.js.map