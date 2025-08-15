import { Ammos } from "@common/definitions/items/ammos";
import { HealingItems } from "@common/definitions/items/healingItems";
import { Throwables } from "@common/definitions/items/throwables";
import { type MathProblemData } from "@common/packets/mathProblemPacket";
import { random, randomFloat } from "@common/utils/random";
import { type Player } from "./objects/player";

export interface MathProblem {
    readonly problem: string;
    readonly answer: number;
    readonly rewardType: string;
    readonly rewardCount: number;
    readonly problemId: number;
}

export class MathProblemManager {
    private readonly activeProblem = new Map<number, MathProblem>(); // player id -> problem
    private nextProblemId = 1;

    // Define consumable items that can be rewarded
    private readonly consumableItems = [
        // Healing items
        "gauze",
        "medikit", 
        "cola",
        "tablets",
        // Ammo types
        "12g",
        "556mm", 
        "762mm",
        "9mm",
        // Throwables
        "frag_grenade",
        "smoke_grenade"
    ];

    generateProblem(player: Player): MathProblem {
        // Generate single digit numbers
        const num1 = random(1, 9);
        const num2 = random(1, 9);
        const operation = random(0, 3); // 0=+, 1=-, 2=*, 3=/
        
        let problem: string;
        let answer: number;

        switch (operation) {
            case 0: // Addition
                problem = `${num1} + ${num2}`;
                answer = num1 + num2;
                break;
            case 1: // Subtraction
                // Ensure positive result
                const [larger, smaller] = num1 >= num2 ? [num1, num2] : [num2, num1];
                problem = `${larger} - ${smaller}`;
                answer = larger - smaller;
                break;
            case 2: // Multiplication
                problem = `${num1} × ${num2}`;
                answer = num1 * num2;
                break;
            case 3: // Division
                // Ensure clean division by using multiplication in reverse
                const result = random(1, 9);
                const divisor = random(1, 9);
                const dividend = result * divisor;
                problem = `${dividend} ÷ ${divisor}`;
                answer = result;
                break;
            default:
                problem = `${num1} + ${num2}`;
                answer = num1 + num2;
        }

        // Select random reward
        const rewardType = this.consumableItems[random(0, this.consumableItems.length - 1)];
        const rewardCount = this.getRewardCount(rewardType);
        
        const problemId = this.nextProblemId++;
        
        const mathProblem: MathProblem = {
            problem,
            answer,
            rewardType,
            rewardCount,
            problemId
        };

        this.activeProblem.set(player.id, mathProblem);
        return mathProblem;
    }

    validateAnswer(player: Player, answer: number, problemId: number): boolean {
        const activeProblem = this.activeProblem.get(player.id);
        
        if (!activeProblem || activeProblem.problemId !== problemId) {
            return false;
        }

        const isCorrect = activeProblem.answer === answer;
        
        if (isCorrect) {
            // Award the player the consumable
            const currentAmount = player.inventory.items.getItem(activeProblem.rewardType);
            player.inventory.items.setItem(activeProblem.rewardType, currentAmount + activeProblem.rewardCount);
            player.dirty.items = true;
            
            // Remove the problem and generate a new one
            this.activeProblem.delete(player.id);
            
            // Send new problem immediately
            const newProblem = this.generateProblem(player);
            player.sendPacket(player.game.mathProblemPacket.create({
                problem: newProblem.problem,
                rewardType: newProblem.rewardType,
                rewardCount: newProblem.rewardCount,
                problemId: newProblem.problemId
            }));
        }
        
        return isCorrect;
    }

    getCurrentProblem(player: Player): MathProblem | undefined {
        return this.activeProblem.get(player.id);
    }

    removeProblem(player: Player): void {
        this.activeProblem.delete(player.id);
    }

    private getRewardCount(itemType: string): number {
        switch (itemType) {
            case "gauze":
                return random(2, 5);
            case "medikit":
                return 1;
            case "cola":
                return 1;
            case "tablets":
                return 1;
            case "12g":
                return random(5, 15);
            case "556mm":
            case "762mm":
            case "9mm":
                return random(10, 30);
            case "frag_grenade":
            case "smoke_grenade":
                return random(1, 2);
            default:
                return 1;
        }
    }

    // Initialize problem for new player
    initializeProblem(player: Player): void {
        const problem = this.generateProblem(player);
        player.sendPacket(player.game.mathProblemPacket.create({
            problem: problem.problem,
            rewardType: problem.rewardType,
            rewardCount: problem.rewardCount,
            problemId: problem.problemId
        }));
    }

    // Check if an item is a consumable that should only be obtainable through math problems
    static isConsumable(itemId: string): boolean {
        const consumables = [
            // Healing items
            "gauze", "medikit", "cola", "tablets", "vaccine_syringe",
            // Ammo types
            "12g", "556mm", "762mm", "9mm", "50cal", "338lap", "545mm", "firework_rocket",
            // Throwables
            "frag_grenade", "smoke_grenade", "confetti_grenade", "c4", "flare", "proj_seed"
        ];
        return consumables.includes(itemId);
    }
}