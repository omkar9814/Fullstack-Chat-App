import { Server } from "socket.io";
import http from "http";

let io;
let server;

export function initSocket(serverInstance) {
  io = new Server(serverInstance, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  const userSocketMap = {}; // { userId: socketId }

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("disconnect", () => {
      console.log("A user disconnected", socket.id);
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
  });
}

export function getIo() {
  return io;
}
