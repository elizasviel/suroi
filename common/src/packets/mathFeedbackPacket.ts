import { Packet, PacketType } from "./packet";

export interface MathFeedbackData {
    readonly type: PacketType.MathFeedback
    readonly isCorrect: boolean
    readonly problemId: number
    readonly xpEarned?: number
    readonly totalXP?: number
}

export const MathFeedbackPacket = new Packet<MathFeedbackData>(PacketType.MathFeedback, {
    serialize(stream, data) {
        const hasXpEarned = data.xpEarned !== undefined;
        const hasTotalXP = data.totalXP !== undefined;
        
        stream.writeBooleanGroup(
            data.isCorrect,
            hasXpEarned,
            hasTotalXP
        );
        
        stream.writeUint16(data.problemId);
        
        if (hasXpEarned) {
            stream.writeUint16(data.xpEarned!);
        }
        
        if (hasTotalXP) {
            stream.writeUint32(data.totalXP!);
        }
    },

    deserialize(stream, data) {
        const [
            isCorrect,
            hasXpEarned,
            hasTotalXP
        ] = stream.readBooleanGroup();
        
        data.isCorrect = isCorrect;
        data.problemId = stream.readUint16();
        
        if (hasXpEarned) {
            data.xpEarned = stream.readUint16();
        }
        
        if (hasTotalXP) {
            data.totalXP = stream.readUint32();
        }
    }
});