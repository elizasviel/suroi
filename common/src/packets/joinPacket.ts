import { GameConstants } from "../constants";
import { Badges, type BadgeDefinition } from "../definitions/badges";
import { Emotes, type EmoteDefinition } from "../definitions/emotes";
import { type SkinDefinition } from "../definitions/items/skins";
import { Loots } from "../definitions/loots";
import { Packet, PacketType } from "./packet";

export interface JoinData {
    readonly type: PacketType.Join
    readonly protocolVersion: number
    readonly name: string
    readonly isMobile: boolean

    readonly skin: SkinDefinition
    readonly badge?: BadgeDefinition

    readonly emotes: ReadonlyArray<EmoteDefinition | undefined>

    // TimeBack authentication data
    readonly authToken?: string
    readonly studentId?: string
}

// protocol version is automatically set; use this type when
// creating an object for use by a JoinPacket
export type JoinPacketCreation = Omit<JoinData, "protocolVersion">;

export const JoinPacket = new Packet<JoinPacketCreation, JoinData>(PacketType.Join, {
    serialize(stream, data) {
        const emotes = data.emotes;
        const hasBadge = data.badge !== undefined;
        const hasAuthToken = data.authToken !== undefined;
        const hasStudentId = data.studentId !== undefined;
        stream.writeBooleanGroup2(
            data.isMobile,
            hasBadge,
            hasAuthToken,
            hasStudentId,
            emotes[0] !== undefined,
            emotes[1] !== undefined,
            emotes[2] !== undefined,
            emotes[3] !== undefined,
            emotes[4] !== undefined,
            emotes[5] !== undefined
        );

        stream.writeUint16(GameConstants.protocolVersion);
        stream.writePlayerName(data.name);

        Loots.writeToStream(stream, data.skin);

        if (hasBadge) {
            Badges.writeToStream(stream, data.badge);
        }

        if (hasAuthToken) {
            stream.writeString(256, data.authToken); // Auth tokens can be long
        }

        if (hasStudentId) {
            stream.writeString(64, data.studentId);
        }

        for (let i = 0; i < 6; i++) { // Reduced from 8 to 6 due to boolean group constraints
            const emote = emotes[i];
            if (emote === undefined) continue;
            Emotes.writeToStream(stream, emote);
        }
    },

    deserialize(stream, data) {
        const [
            isMobile,
            hasBadge,
            hasAuthToken,
            hasStudentId,
            ...emotes
        ] = stream.readBooleanGroup2();
        data.isMobile = isMobile;

        data.protocolVersion = stream.readUint16();
        data.name = stream.readPlayerName().split(/<[^>]+>/g).join("").trim(); // Regex strips out HTML

        data.skin = Loots.readFromStream(stream);

        if (hasBadge) {
            data.badge = Badges.readFromStream(stream);
        }

        if (hasAuthToken) {
            data.authToken = stream.readString(256);
        }

        if (hasStudentId) {
            data.studentId = stream.readString(64);
        }

        data.emotes = new Array(8);
        for (let i = 0; i < 6; i++) { // Reduced from 8 to 6 due to boolean group constraints
            if (!emotes[i]) continue;
            data.emotes[i] = Emotes.readFromStream(stream);
        }
    }
});
