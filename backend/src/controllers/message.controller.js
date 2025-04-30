// src/controllers/message.controller.js
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// Other existing exports...

// Improved markMessageAsRead function to support read receipt feature
const markMessageAsRead = async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // If user has not already read the message, add to readBy
    if (!message.readBy.includes(userId)) {
      message.readBy.push(userId);
      await message.save();

      // Emit read receipt update to both sender and receiver
      const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
      const senderSocketId = getReceiverSocketId(message.senderId.toString());

      const readReceiptPayload = { messageId, userId };

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("readReceipt", readReceiptPayload);
      }
      if (senderSocketId) {
        io.to(senderSocketId).emit("readReceipt", readReceiptPayload);
      }
    }

    res.status(200).json({ message: "Message marked as read" });
  } catch (error) {
    console.error("Error in markMessageAsRead:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized to delete this message" });
    }

    message.text = null;
    message.image = null;
    message.video = null;
    message.deleted = true;
    await message.save();

    // Emit message delete update
    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
    const senderSocketId = getReceiverSocketId(message.senderId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", messageId);
    }
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageDeleted", messageId);
    }

    res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    console.error("Error in deleteMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Edit message text
const editMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user._id;
    const { text } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized to edit this message" });
    }

    message.text = text;
    message.edited = true;
    await message.save();

    // Emit message edit update
    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
    const senderSocketId = getReceiverSocketId(message.senderId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageEdited", message);
    }
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageEdited", message);
    }

    res.status(200).json({ message: "Message edited", data: message });
  } catch (error) {
    console.error("Error in editMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get messages between two users
const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get users for sidebar with last message info
const getUsersForSidebar = async (req, res) => {
  try {
    const myId = req.user._id;

    // Aggregate users who have chatted with the current user
    const users = await User.aggregate([
      {
        $match: { _id: { $ne: myId } },
      },
      {
        $lookup: {
          from: "messages",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [{ $eq: ["$senderId", myId] }, { $eq: ["$receiverId", "$$userId"] }] },
                    { $and: [{ $eq: ["$senderId", "$$userId"] }, { $eq: ["$receiverId", myId] }] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "lastMessage",
        },
      },
      {
        $unwind: {
          path: "$lastMessage",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          email: 1,
          username: 1,
          fullName: 1,
          profilePic: 1,
          lastMessage: 1,
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    res.status(200).json(users);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// React to a message (add or remove reaction)
const reactToMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user._id;
    const { reaction } = req.body; // e.g., emoji or reaction type

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Initialize reactions map if not present
    if (!message.reactions) {
      message.reactions = {};
    }

    // Toggle reaction: if user already reacted with this reaction, remove it; else add it
    if (message.reactions[userId] === reaction) {
      delete message.reactions[userId];
    } else {
      message.reactions[userId] = reaction;
    }

    await message.save();

    // Emit reaction update
    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
    const senderSocketId = getReceiverSocketId(message.senderId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReactionUpdated", message);
    }
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageReactionUpdated", message);
    }

    res.status(200).json({ message: "Reaction updated", data: message });
  } catch (error) {
    console.error("Error in reactToMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Send a new message
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const receiverId = req.params.id;
    const { text } = req.body;

    // Handle image and video uploads if present
    let imageUrl = null;
    let videoUrl = null;

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        const imageUpload = await cloudinary.uploader.upload(req.files.image[0].path, {
          folder: "chat_images",
        });
        imageUrl = imageUpload.secure_url;
      }
      if (req.files.video && req.files.video[0]) {
        const videoUpload = await cloudinary.uploader.upload(req.files.video[0].path, {
          folder: "chat_videos",
          resource_type: "video",
        });
        videoUrl = videoUpload.secure_url;
      }
    }

    const message = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      video: videoUrl,
      readBy: [senderId], // Mark sender as having read the message
    });

    await message.save();

    // Emit new message event via socket.io
    const receiverSocketId = getReceiverSocketId(receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", message);
    }

    res.status(201).json({ message: "Message sent", data: message });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Export all controller functions used in routes
export {
  getUsersForSidebar,
  getMessages,
  sendMessage,
  markMessageAsRead,
  reactToMessage,
  editMessage,
  deleteMessage,
};
