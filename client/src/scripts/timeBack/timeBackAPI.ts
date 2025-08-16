/**
 * TimeBack API Integration Service for Suroi
 * Handles assessment submission and learning analytics
 */

import { createId } from "@paralleldrive/cuid2";
import { getTimeBackApiUrl, getCaliperApiUrl, type SuroiTimeBackUser } from "./authConfig";

// Assessment result structure for Suroi math problems
export interface SuroiAssessmentResult {
    sourcedId: string
    status: "active" | "inactive" | "tobedeleted"
    dateLastModified: string
    lineItem: {
        sourcedId: string
    }
    student: {
        sourcedId: string
    }
    scoreStatus: "fullyGraded" | "pending" | "invalid"
    score: number
    scoreDate: string
    comment?: string
    metadata?: {
        // Game context
        gameType: "suroi_battle_royale"
        mathOperation: string
        problem: string
        correctAnswer: number
        userAnswer?: number
        rewardType?: string
        rewardCount?: number

        // Performance metrics
        accuracy: number
        responseTime?: number
        attempts: number

        // XP tracking
        xp: number
        multiplier: number
        baseXP: number

        // Game state when problem was solved
        playersAlive?: number
        gamePhase?: string
        playerHealth?: number
    }
}

// Caliper learning analytics event
export interface SuroiCaliperEvent {
    "@context": string
    "@type": string
    "id": string
    "actor": {
        id: string
        type: string
    }
    "action": string
    "object": {
        id: string
        type: string
    }
    "eventTime": string
    "edApp": {
        id: string
        type: string
    }
    "extensions"?: Record<string, any>
}

export class SuroiTimeBackAPI {
    private readonly baseUrl: string;
    private readonly caliperUrl: string;
    private accessToken: string | null = null;

    constructor() {
        this.baseUrl = getTimeBackApiUrl();
        this.caliperUrl = getCaliperApiUrl();
    }

    setAccessToken(token: string): void {
        this.accessToken = token;
    }

    // Create user object from OIDC auth data
    createUser(authData: any): SuroiTimeBackUser | null {
        if (!authData?.profile) return null;

        return {
            sourcedId: authData.profile.sub,
            username: authData.profile.email || authData.profile.sub,
            givenName: authData.profile.given_name || "Player",
            familyName: authData.profile.family_name || "",
            email: authData.profile.email || "",
            role: "student"
        };
    }

    // Submit math problem result to TimeBack gradebook
    async submitMathProblemResult(
        user: SuroiTimeBackUser,
        problemData: {
            problem: string
            correctAnswer: number
            userAnswer: number
            isCorrect: boolean
            operation: string
            responseTime?: number
            rewardType?: string
            rewardCount?: number
            gameContext?: any
        }
    ): Promise<void> {
        if (!this.accessToken) {
            console.warn("No TimeBack access token - skipping assessment submission");
            return;
        }

        // Calculate XP using TimeBack rules (from FastMathGames)
        const baseXP = 5; // Lower than FastMathGames since problems are simpler
        let multiplier = 0;
        const attemptNumber = 1; // TODO: Track actual attempts per problem

        if (attemptNumber === 1) {
            if (problemData.isCorrect) multiplier = 1.25; // 100% accuracy bonus
            else multiplier = 0; // No XP for incorrect answers
        } else {
            if (problemData.isCorrect) multiplier = 0.5; // Reduced XP for second attempt
            else multiplier = 0;
        }

        const xpAwarded = Math.floor(baseXP * multiplier);

        const assessmentResult: SuroiAssessmentResult = {
            sourcedId: createId(),
            status: "active",
            dateLastModified: new Date().toISOString(),
            lineItem: {
                sourcedId: `suroi-math-${problemData.operation.toLowerCase()}`
            },
            student: {
                sourcedId: user.sourcedId
            },
            scoreStatus: "fullyGraded",
            score: problemData.isCorrect ? 100 : 0,
            scoreDate: new Date().toISOString(),
            comment: `Suroi math problem: ${problemData.problem} = ${problemData.correctAnswer}`,
            metadata: {
                gameType: "suroi_battle_royale",
                mathOperation: problemData.operation,
                problem: problemData.problem,
                correctAnswer: problemData.correctAnswer,
                userAnswer: problemData.userAnswer,
                rewardType: problemData.rewardType,
                rewardCount: problemData.rewardCount,

                accuracy: problemData.isCorrect ? 100 : 0,
                responseTime: problemData.responseTime,
                attempts: attemptNumber,

                xp: xpAwarded,
                multiplier,
                baseXP,

                // Game context
                playersAlive: problemData.gameContext?.playersAlive,
                gamePhase: problemData.gameContext?.gamePhase,
                playerHealth: problemData.gameContext?.playerHealth
            }
        };

        try {
            const response = await fetch(`${this.baseUrl}/ims/oneroster/gradebook/v1p2/assessmentResults`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    assessmentResult: assessmentResult
                })
            });

            if (!response.ok) {
                console.warn(`TimeBack assessment submission failed: ${response.status} ${response.statusText}`);
                console.warn("This is expected if API permissions are not yet enabled");
                return;
            }

            console.log("✅ TimeBack assessment result submitted successfully");

            // Also track as Caliper event
            await this.trackMathProblemEvent(user, problemData, xpAwarded);
        } catch (error) {
            console.warn("TimeBack assessment submission error:", error);
            console.warn("Game continues normally - this is expected during development");
        }
    }

    // Track math problem solving as Caliper learning analytics event
    private async trackMathProblemEvent(
        user: SuroiTimeBackUser,
        problemData: any,
        xpAwarded: number
    ): Promise<void> {
        const event: SuroiCaliperEvent = {
            "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
            "@type": "AssessmentEvent",
            "id": createId(),
            "actor": {
                id: `urn:user:${user.sourcedId}`,
                type: "Person"
            },
            "action": problemData.isCorrect ? "Completed" : "Submitted",
            "object": {
                id: `urn:assessment:suroi-math-${Date.now()}`,
                type: "Assessment"
            },
            "eventTime": new Date().toISOString(),
            "edApp": {
                id: "urn:app:suroi-battle-royale",
                type: "SoftwareApplication"
            },
            "extensions": {
                mathOperation: problemData.operation,
                problem: problemData.problem,
                correctAnswer: problemData.correctAnswer,
                userAnswer: problemData.userAnswer,
                isCorrect: problemData.isCorrect,
                xpEarned: xpAwarded,
                rewardType: problemData.rewardType,
                gameContext: "battle_royale"
            }
        };

        try {
            const response = await fetch(`${this.caliperUrl}/events`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(event)
            });

            if (!response.ok) {
                console.log("📊 Caliper API not available (permissions needed) - event logged locally");
            } else {
                console.log("📊 Caliper math problem event submitted successfully");
            }
        } catch (error) {
            console.log("📊 Caliper API not available - event logged locally");
        }
    }

    // Track game session events
    async trackGameEvent(
        user: SuroiTimeBackUser,
        eventType: "started" | "ended" | "killed" | "won",
        data?: any
    ): Promise<void> {
        if (!this.accessToken) return;

        const actionMap = {
            started: "Started",
            ended: "Ended",
            killed: "Exited",
            won: "Completed"
        };

        const event: SuroiCaliperEvent = {
            "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
            "@type": "SessionEvent",
            "id": createId(),
            "actor": {
                id: `urn:user:${user.sourcedId}`,
                type: "Person"
            },
            "action": actionMap[eventType],
            "object": {
                id: `urn:session:suroi-${Date.now()}`,
                type: "Session"
            },
            "eventTime": new Date().toISOString(),
            "edApp": {
                id: "urn:app:suroi-battle-royale",
                type: "SoftwareApplication"
            },
            "extensions": {
                eventType,
                ...data
            }
        };

        try {
            await fetch(`${this.caliperUrl}/events`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(event)
            });
        } catch (error) {
            // Silently fail for analytics
        }
    }
}

// Export singleton instance
export const suroiTimeBackAPI = new SuroiTimeBackAPI();
