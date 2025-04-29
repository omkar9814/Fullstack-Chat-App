import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  unseenMessages: {},
  isUsersLoading: false,
  isMessagesLoading: false,
  typingStatus: {}, // new state to track typing status by userId

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, users } = get();
    try {
      const config = {};
      if (messageData instanceof FormData) {
        config.headers = { "Content-Type": "multipart/form-data" };
      }
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData,
        config
      );

      // Add the new message to the chat
      set({ messages: [...messages, res.data.data] });

      // Move the sender to the top of the user list if they sent a message
      const updatedUsers = [...users];
      const senderIndex = updatedUsers.findIndex(
        (user) => user._id === res.data.data.senderId
      );

      if (senderIndex !== -1) {
        // Update lastMessageTime for the sender immutably
        const updatedUser = {
          ...updatedUsers[senderIndex],
          lastMessageTime: new Date(res.data.data.createdAt).getTime(),
        };
        updatedUsers.splice(senderIndex, 1);
        updatedUsers.unshift(updatedUser); // Move sender to the top
        set({ users: [...updatedUsers] });
      }
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, messages, unseenMessages, users } = get();

      // Play sound
      const audio = new Audio("/notification.mp3");
      audio.play();

      // Case when the new message is from the selected user (continue conversation)
      if (newMessage.senderId === selectedUser?._id) {
        set({ messages: [...messages, newMessage] });
      } else {
        // Case when the new message is from someone else (not currently chatting with them)
        set({
          unseenMessages: { ...unseenMessages, [newMessage.senderId]: true },
        });

        // Move user to the top of the users list if they sent a message
        const updatedUsers = [...users];
        const userIndex = updatedUsers.findIndex(
          (u) => u._id === newMessage.senderId
        );

        if (userIndex !== -1) {
          // Update lastMessageTime for the user immutably
          const updatedUser = {
            ...updatedUsers[userIndex],
            lastMessageTime: new Date(newMessage.createdAt).getTime(),
          };
          updatedUsers.splice(userIndex, 1);
          updatedUsers.unshift(updatedUser);
          set({ users: [...updatedUsers] });
        }
      }
    });

    // Add typing event listeners
    socket.on("typing", ({ senderId }) => {
      console.log("Received typing event from senderId:", senderId);
      const { typingStatus } = get();
      const newTypingStatus = { ...typingStatus, [senderId]: true };
      console.log("Updated typingStatus:", newTypingStatus);
      set({ typingStatus: newTypingStatus });
    });

    socket.on("stopTyping", ({ senderId }) => {
      console.log("Received stopTyping event from senderId:", senderId);
      const { typingStatus } = get();
      const updatedTypingStatus = { ...typingStatus };
      delete updatedTypingStatus[senderId];
      console.log("Updated typingStatus after stopTyping:", updatedTypingStatus);
      set({ typingStatus: updatedTypingStatus });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("typing");
    socket.off("stopTyping");

    // Remove new event listeners
    socket.off("readReceipt");
    socket.off("reactionUpdate");
    socket.off("messageEdited");
    socket.off("messageDeleted");
  },

  setSelectedUser: (user) => {
    const { unseenMessages } = get();
    if (user && unseenMessages[user._id]) {
      // Remove notification badge when user opened
      const updatedUnseen = { ...unseenMessages };
      delete updatedUnseen[user._id];
      set({ unseenMessages: updatedUnseen });
    }
    set({ selectedUser: user });
  },

  // New API calls for added features

  markMessageAsRead: async (messageId) => {
    try {
      await axiosInstance.post(`/messages/${messageId}/read`);
    } catch (error) {
      toast.error("Failed to mark message as read");
    }
  },

  reactToMessage: async (messageId, reaction) => {
    try {
      await axiosInstance.post(`/messages/${messageId}/react`, { reaction });
    } catch (error) {
      toast.error("Failed to update reaction");
    }
  },

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.patch(`/messages/${messageId}`, { text });
      const { data } = res;
      const { messages } = get();
      const updatedMessages = messages.map((msg) =>
        msg._id === data._id ? data : msg
      );
      set({ messages: updatedMessages });
    } catch (error) {
      toast.error("Failed to edit message");
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/messages/${messageId}`);
      const { messages } = get();
      const updatedMessages = messages.map((msg) =>
        msg._id === messageId
          ? { ...msg, text: null, image: null, video: null, deleted: true }
          : msg
      );
      set({ messages: updatedMessages });
    } catch (error) {
      toast.error("Failed to delete message");
    }
  },

  // New functions to emit typing events
  emitTyping: () => {
    const socket = useAuthStore.getState().socket;
    const { selectedUser, authUser } = useAuthStore.getState();
    if (socket && selectedUser && authUser) {
      console.log("Emitting typing event", { receiverId: selectedUser._id, senderId: authUser._id });
      socket.emit("typing", { receiverId: selectedUser._id, senderId: authUser._id });
    }
  },

  emitStopTyping: () => {
    const socket = useAuthStore.getState().socket;
    const { selectedUser, authUser } = useAuthStore.getState();
    if (socket && selectedUser && authUser) {
      console.log("Emitting stopTyping event", { receiverId: selectedUser._id, senderId: authUser._id });
      socket.emit("stopTyping", { receiverId: selectedUser._id, senderId: authUser._id });
    }
  },

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, users } = get();
    try {
      const config = {};
      if (messageData instanceof FormData) {
        config.headers = { "Content-Type": "multipart/form-data" };
      }
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData,
        config
      );

      // Add the new message to the chat
      set({ messages: [...messages, res.data.data] });

      // Move the sender to the top of the user list if they sent a message
      const updatedUsers = [...users];
      const senderIndex = updatedUsers.findIndex(
        (user) => user._id === res.data.data.senderId
      );

      if (senderIndex !== -1) {
        // Update lastMessageTime for the sender immutably
        const updatedUser = {
          ...updatedUsers[senderIndex],
          lastMessageTime: new Date(res.data.data.createdAt).getTime(),
        };
        updatedUsers.splice(senderIndex, 1);
        updatedUsers.unshift(updatedUser); // Move sender to the top
        set({ users: [...updatedUsers] });
      }
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, messages, unseenMessages, users } = get();

      // Play sound
      const audio = new Audio("/notification.mp3");
      audio.play();

      // Case when the new message is from the selected user (continue conversation)
      if (newMessage.senderId === selectedUser?._id) {
        set({ messages: [...messages, newMessage] });
      } else {
        // Case when the new message is from someone else (not currently chatting with them)
        set({
          unseenMessages: { ...unseenMessages, [newMessage.senderId]: true },
        });

        // Move user to the top of the users list if they sent a message
        const updatedUsers = [...users];
        const userIndex = updatedUsers.findIndex(
          (u) => u._id === newMessage.senderId
        );

        if (userIndex !== -1) {
          // Update lastMessageTime for the user immutably
          const updatedUser = {
            ...updatedUsers[userIndex],
            lastMessageTime: new Date(newMessage.createdAt).getTime(),
          };
          updatedUsers.splice(userIndex, 1);
          updatedUsers.unshift(updatedUser);
          set({ users: [...updatedUsers] });
        }
      }
    });

    // Add typing event listeners
    socket.on("typing", ({ senderId }) => {
      const { typingStatus } = get();
      set({ typingStatus: { ...typingStatus, [senderId]: true } });
    });

    socket.on("stopTyping", ({ senderId }) => {
      const { typingStatus } = get();
      const updatedTypingStatus = { ...typingStatus };
      delete updatedTypingStatus[senderId];
      set({ typingStatus: updatedTypingStatus });
    });

    // New socket event listeners for added features

    // Read receipt update
    socket.on("readReceipt", ({ messageId, userId }) => {
      const { messages } = get();
      const updatedMessages = messages.map((msg) => {
        if (msg._id === messageId) {
          if (!msg.readBy) msg.readBy = [];
          if (!msg.readBy.includes(userId)) {
            msg.readBy.push(userId);
          }
        }
        return msg;
      });
      set({ messages: updatedMessages });
    });

    // Reaction update
    socket.on("reactionUpdate", ({ messageId, userId, reaction }) => {
      const { messages } = get();
      const updatedMessages = messages.map((msg) => {
        if (msg._id === messageId) {
          if (!msg.reactions) msg.reactions = {};
          if (reaction) {
            msg.reactions[userId] = reaction;
          } else {
            delete msg.reactions[userId];
          }
        }
        return msg;
      });
      set({ messages: updatedMessages });
    });

    // Message edited
    socket.on("messageEdited", (editedMessage) => {
      const { messages } = get();
      const updatedMessages = messages.map((msg) =>
        msg._id === editedMessage._id ? editedMessage : msg
      );
      set({ messages: updatedMessages });
    });

    // Message deleted
    socket.on("messageDeleted", (messageId) => {
      const { messages } = get();
      const updatedMessages = messages.map((msg) =>
        msg._id === messageId
          ? { ...msg, text: null, image: null, video: null, deleted: true }
          : msg
      );
      set({ messages: updatedMessages });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("typing");
    socket.off("stopTyping");
  },

  setSelectedUser: (user) => {
    const { unseenMessages } = get();
    if (user && unseenMessages[user._id]) {
      // Remove notification badge when user opened
      const updatedUnseen = { ...unseenMessages };
      delete updatedUnseen[user._id];
      set({ unseenMessages: updatedUnseen });
    }
    set({ selectedUser: user });
  },
}));
