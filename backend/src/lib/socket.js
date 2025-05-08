import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js"; // Import User model

const app = express();
const server = http.createServer(app);

// Shared CORS options for Express and Socket.IO
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:3000"],
  methods: ["GET", "POST"],
  credentials: true,
};

const io = new Server(server, {
  cors: corsOptions,
});

const userSocketMap = {}; // This will store user socket ids

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;

  if (userId) {
    userSocketMap[userId] = socket.id; // Store user socket ID
    console.log(`User ${userId} connected with socket ID: ${socket.id}`);
    io.emit("getOnlineUsers", Object.keys(userSocketMap)); // Emit online users
  }

  socket.on("sendMessage", (messageData) => {
    const receiverSocketId = getReceiverSocketId(messageData.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", messageData);
    }
  });

  socket.on("typing", ({ receiverId, senderId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { senderId });
    }
  });

  socket.on("stopTyping", (data) => {
    if (!data) {
      console.warn("stopTyping event received with undefined data");
      return;
    }
    const { receiverId, senderId } = data;
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stopTyping", { senderId });
    }
  });

  // WebRTC signaling handlers for audio/video calls
  socket.on("callUser", async ({ to, from, offer, callType }) => {
    const receiverSocketId = getReceiverSocketId(to);
    console.log("callUser event received with from:", from, "to:", to);
    if (receiverSocketId) {
      try {
        // Fetch caller user details
        const callerUser = await User.findById(from).select("_id fullName profilePic").lean();
        console.log("Fetched callerUser:", callerUser);
        const caller = callerUser ? {
          _id: callerUser._id.toString(),
          fullName: callerUser.fullName,
          profilePic: callerUser.profilePic,
        } : { _id: from };

        io.to(receiverSocketId).emit("callUser", { from, offer, callType, caller });
      } catch (error) {
        console.error("Error fetching caller user details for callUser event", error);
        io.to(receiverSocketId).emit("callUser", { from, offer, callType, caller: { _id: from } });
      }
    }
  });

  socket.on("answerCall", ({ to, answer }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("answerCall", { answer });
    }
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("iceCandidate", { candidate });
    }
  });

  socket.on("endCall", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("endCall");
    }
  });

  socket.on("missedCall", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("missedCall", { from: socket.handshake.query.userId });
    }
  });

  socket.on("disconnect", () => {
    if (userId) {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

export { app, server, io };
