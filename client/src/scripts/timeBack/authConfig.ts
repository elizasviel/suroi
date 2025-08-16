/**
 * TimeBack Authentication Configuration for Suroi
 * Based on FastMathGames integration pattern
 */

// Environment detection
const getEnvironment = (): "staging" | "production" => {
    // Use staging for development, production can be set via build process
    return (globalThis as any).__TIMEBACK_ENV__ || "staging";
};

// Auth endpoints based on environment
const AUTH_ENDPOINTS = {
    staging: {
        authority: "https://alpha-auth-development-idp.auth.us-west-2.amazoncognito.com",
        client_id: "3drsutrtfjm75v158vdm89pe6f", // FastMathGames test credentials
        metadataUrl: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_H5aVRMERg/.well-known/openid-configuration"
    },
    production: {
        authority: "https://alpha-auth-production-idp.auth.us-west-2.amazoncognito.com",
        client_id: (globalThis as any).__TIMEBACK_CLIENT_ID__ || "",
        metadataUrl: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_PRODUCTION_POOL/.well-known/openid-configuration"
    }
};

const currentEnvironment = getEnvironment();
const authConfig = AUTH_ENDPOINTS[currentEnvironment];

export const getTimeBackAuthConfig = () => ({
    authority: authConfig.authority,
    client_id: authConfig.client_id,
    redirect_uri: window.location.origin,
    post_logout_redirect_uri: window.location.origin,
    response_type: "code",
    scope: " ", // TimeBack Cognito requires single space instead of 'openid profile email'
    automaticSilentRenew: true,
    loadUserInfo: true,
    metadataUrl: authConfig.metadataUrl
});

export const getTimeBackApiUrl = (): string => {
    return currentEnvironment === "production"
        ? "https://api.alpha-1edtech.com"
        : "https://api.staging.alpha-1edtech.com";
};

export const getCaliperApiUrl = (): string => {
    return currentEnvironment === "production"
        ? "https://caliper.alpha-1edtech.com"
        : "https://caliper-staging.alpha-1edtech.com";
};

export const getCurrentEnvironment = () => currentEnvironment;

// Simple user type for Suroi integration
export interface SuroiTimeBackUser {
    sourcedId: string
    username: string
    givenName: string
    familyName: string
    email?: string
    role: string
}
