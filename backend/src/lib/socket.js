import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your frontend URL
    methods: ["GET", "POST"],
  },
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

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);

    if (userId) {
      delete userSocketMap[userId]; // Remove user from the map
      io.emit("getOnlineUsers", Object.keys(userSocketMap)); // Update online users list
    }
  });
});

// Export app, server, and io
export { app, server, io };
