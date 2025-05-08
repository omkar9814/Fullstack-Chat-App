import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import movieRoutes from "./routes/movie.route.js";
import { app, server } from "./lib/socket.js"; // Import app and server from socket.js

dotenv.config();

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

// Shared CORS options for Express and Socket.IO
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://fullstack-chat-app-10-3dfg.onrender.com/", // Add your deployed frontend domain here
  ],
  credentials: true,
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

// Increase the request body size limit
app.use(express.json({ limit: "1gb" })); // Set a higher limit (e.g., 1gb)
app.use(cookieParser());

// Use CORS middleware with shared options
app.use(cors(corsOptions));

// Add Content-Security-Policy header middleware
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' http://localhost:5173 http://localhost:5001 https://res.cloudinary.com https://randomuser.me data: blob:; script-src 'self' 'unsafe-inline' http://localhost:5173 http://localhost:5001 https://res.cloudinary.com https://randomuser.me; style-src 'self' 'unsafe-inline' http://localhost:5173 http://localhost:5001 https://res.cloudinary.com https://randomuser.me; img-src 'self' data: http://localhost:5173 http://localhost:5001 https://res.cloudinary.com https://randomuser.me; connect-src 'self' ws://localhost:5001 http://localhost:5173 http://localhost:5001 https://res.cloudinary.com https://randomuser.me; font-src 'self' http://localhost:5173 http://localhost:5001 https://res.cloudinary.com https://randomuser.me; frame-src 'self' http://localhost:5173 http://localhost:5001 https://res.cloudinary.com https://randomuser.me;"
  );
  next();
});

// Explicitly handle OPTIONS preflight requests with shared options
app.options("*", cors(corsOptions));

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/movies", movieRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Start the server here
server.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`);
  connectDB();
});
