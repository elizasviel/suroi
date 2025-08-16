/**
 * TimeBack Authentication UI Manager for Suroi
 * Handles the authentication screen and user interface
 */

import $ from "jquery";
import { suroiAuthManager } from "./authManager";
import { type SuroiTimeBackUser } from "./authConfig";

export class SuroiAuthUI {
    private isAuthenticating = false;
    private currentUser: SuroiTimeBackUser | null = null;

    constructor() {
        this.setupEventHandlers();
        this.setupAuthStateListener();
    }

    private setupEventHandlers(): void {
        // Login button
        $("#timeback-login").on("click", async e => {
            e.preventDefault();
            await this.handleLogin();
        });

        // Continue button (after successful auth)
        $("#auth-continue").on("click", e => {
            e.preventDefault();
            this.hideAuthScreen();
        });

        // Logout button
        $("#auth-logout").on("click", async e => {
            e.preventDefault();
            await this.handleLogout();
        });
    }

    private setupAuthStateListener(): void {
        suroiAuthManager.onAuthStateChanged(user => {
            this.currentUser = user;
            this.updateAuthUI(user);
        });
    }

    private async handleLogin(): Promise<void> {
        if (this.isAuthenticating) return;

        try {
            this.isAuthenticating = true;
            this.showAuthStatus("Connecting to TimeBack...");

            await suroiAuthManager.signIn();
        } catch (error) {
            console.error("Login failed:", error);
            this.showAuthError("Failed to connect to TimeBack. Please try again.");
        } finally {
            this.isAuthenticating = false;
        }
    }

    private async handleLogout(): Promise<void> {
        try {
            this.showAuthStatus("Signing out...");
            await suroiAuthManager.signOut();
        } catch (error) {
            console.error("Logout failed:", error);
            this.showAuthError("Failed to sign out. Please try again.");
        }
    }

    private updateAuthUI(user: SuroiTimeBackUser | null): void {
        this.hideAuthStatus();
        this.hideAuthError();

        if (user) {
            // User is authenticated - set auth data in Game
            // Get the access token from auth manager
            suroiAuthManager.getAccessToken().then(async accessToken => {
                const { Game } = await import("../game");
                Game.setTimeBackAuth(accessToken || undefined, user.sourcedId);
            });

            // Update UI
            $("#auth-user-details").html(`
                <div><strong>${user.givenName} ${user.familyName}</strong></div>
                <div style="color: #aaa;">${user.email}</div>
                <div style="color: #aaa;">ID: ${user.sourcedId}</div>
            `);
            $("#auth-user-info").show();
            $("#timeback-login").hide();
        } else {
            // User is not authenticated - clear auth data
            import("../game").then(({ Game }) => {
                Game.setTimeBackAuth(undefined, undefined);
            });

            $("#auth-user-info").hide();
            $("#timeback-login").show();
        }
    }

    private showAuthStatus(message: string): void {
        $("#auth-status-text").text(message);
        $("#auth-status").show();
        $("#auth-error").hide();
    }

    private showAuthError(message: string): void {
        $("#auth-error-text").text(message);
        $("#auth-error").show();
        $("#auth-status").hide();
    }

    private hideAuthStatus(): void {
        $("#auth-status").hide();
    }

    private hideAuthError(): void {
        $("#auth-error").hide();
    }

    // Public methods for game integration
    public showAuthScreen(): void {
        $("#auth-screen").show();
        $("#splash-options").hide();
    }

    public hideAuthScreen(): void {
        $("#auth-screen").hide();
        $("#splash-options").show();
    }

    public async initialize(): Promise<void> {
        try {
            // Initialize auth manager
            await suroiAuthManager.initialize();

            // Check if user is already authenticated
            const isAuthenticated = await suroiAuthManager.isAuthenticated();

            if (!isAuthenticated) {
                // Show auth screen if not authenticated
                this.showAuthScreen();
            } else {
                // User is authenticated, show main game UI
                this.hideAuthScreen();
            }
        } catch (error) {
            console.error("Auth initialization failed:", error);
            this.showAuthScreen();
            this.showAuthError("Failed to initialize authentication");
        }
    }

    public getCurrentUser(): SuroiTimeBackUser | null {
        return this.currentUser;
    }

    public isUserAuthenticated(): boolean {
        return this.currentUser !== null;
    }

    // XP notification system
    public showXPNotification(xpAmount: number): void {
        const notification = $("#xp-notification");
        $("#xp-notification-text").text(`+${xpAmount} XP Earned!`);

        notification.show();
        notification.addClass("xp-notification-animate");

        // Hide after 3 seconds
        setTimeout(() => {
            notification.removeClass("xp-notification-animate");
            notification.hide();
        }, 3000);
    }

    public updateTotalXP(totalXP: number): void {
        $("#timeback-xp-value").text(totalXP.toString());
        $("#timeback-xp-display").show();
    }

    public updateMathProblemXP(potentialXP: number): void {
        $("#math-xp-amount").text(`+${potentialXP} XP`);
    }
}

// Export singleton instance
export const suroiAuthUI = new SuroiAuthUI();
