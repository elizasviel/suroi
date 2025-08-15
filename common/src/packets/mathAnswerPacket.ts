import { Packet, PacketType } from "./packet";

export interface MathAnswerData {
    readonly type: PacketType.MathAnswer
    readonly answer: number
    readonly problemId: number
}

export const MathAnswerPacket = new Packet<MathAnswerData>(PacketType.MathAnswer, {
    serialize(stream, data) {
        stream.writeInt16(data.answer);
        stream.writeUint16(data.problemId);
    },

    deserialize(stream, data, saveIndex, recordTo) {
        data.answer = stream.readInt16();
        data.problemId = stream.readUint16();
    }
});