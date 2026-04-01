"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config"); // Load .env first — must be before anything else
require("./config/env"); // Validate env vars
const server_1 = require("./server");
const env_1 = require("./config/env");
async function main() {
    const app = await (0, server_1.buildServer)();
    try {
        await app.listen({ port: env_1.env.PORT, host: '0.0.0.0' });
        console.log(`Vendr backend running on port ${env_1.env.PORT}`);
    }
    catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=app.js.map