import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js"; // Correct import

// Fetch users for the sidebar (exclude the logged-in user)
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId }, // Exclude the logged-in user
    }).select("-password"); // Exclude password field

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Fetch messages between the logged-in user and a selected user
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params; // Extract the selected user's ID
    const myId = req.user._id; // Get logged-in user's ID

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Send a message from one user to another
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body; // Get message data from request body
    const { id: receiverId } = req.params; // Get receiver's ID from URL params
    const senderId = req.user._id; // Get logged-in user's ID

    let imageUrl;
    if (image) {
      // Upload image to Cloudinary if provided
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url; // Get secure URL after upload
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save(); // Save the new message to the database

    // Emit the message to the receiver via Socket.IO if they are online
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage); // Respond with the new message
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
