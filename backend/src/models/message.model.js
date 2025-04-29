import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        text: {
            type: String,
        },
        image: {
            type: String,
        },
        video: {
            type: String,
        },
        readBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        reactions: {
            type: Map,
            of: String, // userId -> emoji
            default: {},
        },
        edited: {
            type: Boolean,
            default: false,
        },
        deleted: {
            type: Boolean,
            default: false,
        },

    },
    { timestamps: true}
)

const Message = mongoose.model("Message" , messageSchema)


export default Message