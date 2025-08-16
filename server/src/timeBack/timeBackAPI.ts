/**
 * Server-side TimeBack API Integration for Suroi
 * Handles assessment submission and learning analytics from the server
 */

import { type Player } from "../objects/player";

// Assessment result structure for server-side submission
export interface ServerAssessmentResult {
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
        userAnswer: number
        rewardType: string
        rewardCount: number

        // Performance metrics
        accuracy: number
        responseTime?: number
        attempts: number

        // XP tracking
        xp: number
        multiplier: number
        baseXP: number

        // Game state when problem was solved
        playersAlive: number
        gamePhase: string
        playerHealth: number
        survivalTime: number
    }
}

export class ServerTimeBackAPI {
    private readonly baseUrl: string;
    private readonly caliperUrl: string;

    constructor(environment: "staging" | "production" = "staging") {
        this.baseUrl = environment === "production"
            ? "https://api.alpha-1edtech.com"
            : "https://api.staging.alpha-1edtech.com";
        this.caliperUrl = environment === "production"
            ? "https://caliper.alpha-1edtech.com"
            : "https://caliper-staging.alpha-1edtech.com";
    }

    // Generate a simple ID for server-side use
    private generateId(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    // Submit math problem result to TimeBack gradebook
    async submitMathProblemResult(
        player: Player,
        problemData: {
            problem: string
            correctAnswer: number
            userAnswer: number
            isCorrect: boolean
            operation: string
            responseTime?: number
            rewardType: string
            rewardCount: number
        }
    ): Promise<number> {
        const authToken = player.authToken;
        const studentId = player.studentId;

        if (!authToken || !studentId) {
            console.warn(`Player ${player.name} has no TimeBack auth - skipping assessment submission`);
            return 0; // Return 0 XP
        }

        // Calculate XP using TimeBack rules
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

        // Gather game context
        const gameContext = {
            playersAlive: player.game.aliveCount,
            gamePhase: this.getGamePhase(player),
            playerHealth: player.health,
            survivalTime: Date.now() - player.joinTime
        };

        const assessmentResult: ServerAssessmentResult = {
            sourcedId: this.generateId(),
            status: "active",
            dateLastModified: new Date().toISOString(),
            lineItem: {
                sourcedId: `suroi-math-${problemData.operation.toLowerCase()}`
            },
            student: {
                sourcedId: studentId
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
                playersAlive: gameContext.playersAlive,
                gamePhase: gameContext.gamePhase,
                playerHealth: gameContext.playerHealth,
                survivalTime: gameContext.survivalTime
            }
        };

        try {
            const response = await fetch(`${this.baseUrl}/ims/oneroster/gradebook/v1p2/assessmentResults`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${authToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    assessmentResult: assessmentResult
                })
            });

            if (!response.ok) {
                console.warn(`TimeBack assessment submission failed for ${player.name}: ${response.status} ${response.statusText}`);
                console.warn("This is expected if API permissions are not yet enabled");
                return xpAwarded; // Still return XP for local tracking
            }

            console.log(`✅ TimeBack assessment result submitted for ${player.name}: +${xpAwarded} XP`);

            // Also track as Caliper event
            await this.trackMathProblemEvent(player, problemData, xpAwarded, gameContext);

            return xpAwarded;
        } catch (error) {
            console.warn(`TimeBack assessment submission error for ${player.name}:`, error);
            console.warn("Game continues normally - this is expected during development");
            return xpAwarded; // Still return XP for local tracking
        }
    }

    // Track math problem solving as Caliper learning analytics event
    private async trackMathProblemEvent(
        player: Player,
        problemData: any,
        xpAwarded: number,
        gameContext: any
    ): Promise<void> {
        if (!player.authToken || !player.studentId) return;

        const event = {
            "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
            "@type": "AssessmentEvent",
            "id": this.generateId(),
            "actor": {
                id: `urn:user:${player.studentId}`,
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
                gameContext: "battle_royale",
                playersAlive: gameContext.playersAlive,
                playerHealth: gameContext.playerHealth,
                survivalTime: gameContext.survivalTime
            }
        };

        try {
            const response = await fetch(`${this.caliperUrl}/events`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${player.authToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(event)
            });

            if (!response.ok) {
                console.log(`📊 Caliper API not available for ${player.name} (permissions needed)`);
            } else {
                console.log(`📊 Caliper math problem event submitted for ${player.name}`);
            }
        } catch (error) {
            // Silently fail for analytics
        }
    }

    // Determine game phase based on player state and game state
    private getGamePhase(player: Player): string {
        const game = player.game;

        if (game.gas.stage === 0) return "early_game";
        if (game.gas.stage <= 3) return "mid_game";
        if (game.gas.stage <= 6) return "late_game";
        return "final_circle";
    }

    // Track game session events
    async trackGameEvent(
        player: Player,
        eventType: "started" | "ended" | "killed" | "won",
        data?: any
    ): Promise<void> {
        if (!player.authToken || !player.studentId) return;

        const actionMap = {
            started: "Started",
            ended: "Ended",
            killed: "Exited",
            won: "Completed"
        };

        const event = {
            "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
            "@type": "SessionEvent",
            "id": this.generateId(),
            "actor": {
                id: `urn:user:${player.studentId}`,
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
                playerName: player.name,
                ...data
            }
        };

        try {
            await fetch(`${this.caliperUrl}/events`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${player.authToken}`,
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
export const serverTimeBackAPI = new ServerTimeBackAPI();
