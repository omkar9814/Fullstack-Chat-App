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
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );

      // Add the new message to the chat
      set({ messages: [...messages, res.data] });

      // Move the sender to the top of the user list if they sent a message
      const updatedUsers = [...users];
      const senderIndex = updatedUsers.findIndex(
        (user) => user._id === res.data.senderId
      );

      if (senderIndex !== -1) {
        const [senderToMove] = updatedUsers.splice(senderIndex, 1);
        updatedUsers.unshift(senderToMove); // Move sender to the top
        set({ users: updatedUsers });
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
          const [userToMove] = updatedUsers.splice(userIndex, 1);
          updatedUsers.unshift(userToMove);
          set({ users: updatedUsers });
        }
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
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
