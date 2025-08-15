import { type ReferenceTo } from "../utils/objectDefinitions";
import { Packet, PacketType } from "./packet";

export interface MathProblemData {
    readonly type: PacketType.MathProblem
    readonly problem: string
    readonly rewardType: string
    readonly rewardCount: number
    readonly problemId: number
}

export const MathProblemPacket = new Packet<MathProblemData>(PacketType.MathProblem, {
    serialize(stream, data) {
        stream.writeString(32, data.problem);
        stream.writeString(32, data.rewardType);
        stream.writeUint8(data.rewardCount);
        stream.writeUint16(data.problemId);
    },

    deserialize(stream, data, saveIndex, recordTo) {
        data.problem = stream.readString(32);
        data.rewardType = stream.readString(32);
        data.rewardCount = stream.readUint8();
        data.problemId = stream.readUint16();
    }
});