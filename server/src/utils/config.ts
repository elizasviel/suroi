import { existsSync, readFileSync, writeFileSync } from "fs";

let configExists = existsSync("config.json");
if (!configExists && existsSync("config.example.json")) {
    writeFileSync("config.json", readFileSync("config.example.json", "utf8"));
    configExists = true;
}

import type { ConfigSchema } from "./config.d";
const baseConfig = (configExists ? JSON.parse(readFileSync("config.json", "utf8")) : {}) as ConfigSchema;

// Override with environment variables for Heroku deployment
export const Config: ConfigSchema = {
    ...baseConfig,
    hostname: process.env.NODE_ENV === "production" ? "0.0.0.0" : baseConfig.hostname,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : baseConfig.port
};
