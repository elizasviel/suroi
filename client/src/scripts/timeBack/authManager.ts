/**
 * TimeBack Authentication Manager for Suroi
 * Handles OIDC authentication flow and user management
 */

import { UserManager, type User } from "oidc-client-ts";
import { getTimeBackAuthConfig, type SuroiTimeBackUser } from "./authConfig";
import { suroiTimeBackAPI } from "./timeBackAPI";

export class SuroiAuthManager {
    private readonly userManager: UserManager;
    private currentUser: SuroiTimeBackUser | null = null;
    private readonly authCallbacks: Array<(user: SuroiTimeBackUser | null) => void> = [];

    constructor() {
        this.userManager = new UserManager(getTimeBackAuthConfig());
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        this.userManager.events.addUserLoaded((user: User) => {
            console.log("✅ TimeBack user loaded:", user.profile);
            this.handleUserAuthenticated(user);
        });

        this.userManager.events.addUserUnloaded(() => {
            console.log("❌ TimeBack user unloaded");
            this.handleUserSignedOut();
        });

        this.userManager.events.addAccessTokenExpired(() => {
            console.log("🔄 TimeBack access token expired, attempting renewal");
            this.userManager.signinSilent().catch(error => {
                console.warn("Silent renewal failed:", error);
                this.handleUserSignedOut();
            });
        });

        this.userManager.events.addSilentRenewError(error => {
            console.warn("Silent renewal error:", error);
            this.handleUserSignedOut();
        });
    }

    private handleUserAuthenticated(user: User): void {
        this.currentUser = suroiTimeBackAPI.createUser(user);
        suroiTimeBackAPI.setAccessToken(user.access_token);

        // Notify all callbacks
        this.authCallbacks.forEach(callback => callback(this.currentUser));
    }

    private handleUserSignedOut(): void {
        this.currentUser = null;
        suroiTimeBackAPI.setAccessToken("");

        // Notify all callbacks
        this.authCallbacks.forEach(callback => callback(null));
    }

    // Check if user is currently authenticated
    async isAuthenticated(): Promise<boolean> {
        try {
            const user = await this.userManager.getUser();
            return user !== null && !user.expired;
        } catch (error) {
            console.warn("Error checking authentication status:", error);
            return false;
        }
    }

    // Get current authenticated user
    getCurrentUser(): SuroiTimeBackUser | null {
        return this.currentUser;
    }

    // Initialize authentication - check for existing session
    async initialize(): Promise<void> {
        try {
            // Check if we're returning from auth redirect
            if (window.location.search.includes("code=") || window.location.search.includes("state=")) {
                await this.userManager.signinRedirectCallback();
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }

            // Check for existing user session
            const user = await this.userManager.getUser();
            if (user && !user.expired) {
                this.handleUserAuthenticated(user);
            }
        } catch (error) {
            console.warn("Error initializing authentication:", error);
        }
    }

    // Start authentication flow
    async signIn(): Promise<void> {
        try {
            await this.userManager.signinRedirect();
        } catch (error) {
            console.error("Error starting sign-in flow:", error);
            throw new Error("Failed to start authentication. Please try again.");
        }
    }

    // Sign out user
    async signOut(): Promise<void> {
        try {
            await this.userManager.signoutRedirect();
        } catch (error) {
            console.error("Error signing out:", error);
            this.handleUserSignedOut();
        }
    }

    // Add callback for authentication state changes
    onAuthStateChanged(callback: (user: SuroiTimeBackUser | null) => void): void {
        this.authCallbacks.push(callback);

        // Immediately call with current state
        callback(this.currentUser);
    }

    // Remove callback
    removeAuthStateCallback(callback: (user: SuroiTimeBackUser | null) => void): void {
        const index = this.authCallbacks.indexOf(callback);
        if (index > -1) {
            this.authCallbacks.splice(index, 1);
        }
    }

    // Get access token for API calls
    async getAccessToken(): Promise<string | null> {
        try {
            const user = await this.userManager.getUser();
            return user?.access_token || null;
        } catch (error) {
            console.warn("Error getting access token:", error);
            return null;
        }
    }
}

// Export singleton instance
export const suroiAuthManager = new SuroiAuthManager();
