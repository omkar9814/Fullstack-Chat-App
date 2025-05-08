import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  unseenMessages: {},
  isUsersLoading: false,
  isMessagesLoading: false,
  typingStatus: {},

  listenersSubscribed: false,

  callActive: false,
  callOutgoing: false,
  callType: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  callIncoming: false,
  caller: null,
  incomingOffer: null,
  missedCallTimeoutId: null,
  incomingCallAudio: null,
  iceCandidateQueue: [],

  notificationAudio: null,

  setSelectedUser: (user) => set({ selectedUser: user }),

  initNotificationAudio: () => {
    if (!get().notificationAudio) {
      const audio = new Audio("/notification.mp3");
      audio.load();
      set({ notificationAudio: audio });
    }
  },

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch users");
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
      toast.error(error.response?.data?.message || "Failed to fetch messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, users } = get();
    if (!selectedUser) {
      toast.error("No user selected to send message");
      return;
    }
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

      set({ messages: [...messages, res.data.data] });

      // Emit socket event to notify receiver
      const socket = useAuthStore.getState().socket;
      if (socket && socket.connected) {
        socket.emit("sendMessage", res.data.data);
      }

      const updatedUsers = [...users];
      const senderIndex = updatedUsers.findIndex(
        (user) => user._id === res.data.data.senderId
      );

      if (senderIndex !== -1) {
        const updatedUser = {
          ...updatedUsers[senderIndex],
          lastMessageTime: new Date(res.data.data.createdAt).getTime(),
          lastMessage: res.data.data.text || "", // optionally update last message text
        };
        updatedUsers.splice(senderIndex, 1);
        updatedUsers.unshift(updatedUser);
        set({ users: updatedUsers });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  handleNotificationClick: (userId) => {
    const { users } = get();
    const user = users.find((u) => u._id === userId);
    if (user) {
      set({ selectedUser: user });
    }
  },

  subscribeToMessages: () => {
    if (get().listenersSubscribed) {
      return;
    }
    const { selectedUser, callActive, callOutgoing } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.warn("Socket not available in subscribeToMessages");
      return;
    }

    // Remove previous listeners to avoid duplicates
    socket.off("newMessage");
    socket.off("missedCall");
    socket.off("callUser");
    socket.off("iceCandidate");
    socket.off("endCall");
    socket.off("answerCall");

    socket.on("newMessage", (newMessage) => {
      const {
        selectedUser,
        messages,
        unseenMessages,
        users,
        notificationAudio,
        callActive,
        callOutgoing,
      } = get();

      // Suppress notification if call is active or outgoing
      if (callActive || callOutgoing) {
        if (
          newMessage.senderId === selectedUser?._id ||
          newMessage.receiverId === selectedUser?._id
        ) {
          set({ messages: [...messages, newMessage] });
        }
        return;
      }

      if (notificationAudio) {
        notificationAudio.pause();
        notificationAudio.currentTime = 0;
        notificationAudio.play().catch((error) => {
          console.error("Error playing notification audio:", error);
        });
      }

      if (
        newMessage.senderId === selectedUser?._id ||
        newMessage.receiverId === selectedUser?._id
      ) {
        set({ messages: [...messages, newMessage] });
      } else {
        set({
          unseenMessages: {
            ...unseenMessages,
            [newMessage.senderId]: (unseenMessages[newMessage.senderId] || 0) + 1,
          },
        });
      }
    });

    socket.on("missedCall", ({ from }) => {
      console.log("Frontend received missedCall event from", from);
      get().handleMissedCallNotification?.(from);
      const incomingCallAudio = get().incomingCallAudio;
      if (incomingCallAudio) {
        incomingCallAudio.pause();
        set({ incomingCallAudio: null });
      }
    });

    socket.on("callUser", async ({ from, offer, callType, caller }) => {
      console.log("Frontend received callUser event from", from);
      try {
        const { notificationAudio, users } = get();
        if (notificationAudio) {
          notificationAudio.loop = true;
          notificationAudio.play().catch((error) => {
            console.error("Error playing incoming call audio:", error);
          });
          set({ incomingCallAudio: notificationAudio });
        } else {
          const incomingCallAudio = new Audio("/notification.mp3");
          incomingCallAudio.loop = true;
          incomingCallAudio.play().catch((error) => {
            console.error("Error playing incoming call audio:", error);
          });
          set({ incomingCallAudio });
        }

        if (!caller || !caller._id) {
          console.warn(
            "callUser event received with missing or invalid caller object",
            caller
          );
          caller = { _id: from };
        }

        // Enrich caller with full user info from users list if available
        const fullCallerInfo = users.find((user) => user._id === caller._id);
        if (fullCallerInfo) {
          caller = { ...caller, ...fullCallerInfo };
        }

        if (!caller._id) {
          console.error("Invalid caller._id, cannot proceed with callUser event");
          return;
        }

        toast("Incoming call from " + (caller?.fullName || "Unknown"), {
          duration: 5000,
          icon: "📞",
        });

        console.log("Setting callIncoming to true and caller:", caller);

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        let localStream;
        try {
          localStream = await navigator.mediaDevices.getUserMedia(
            callType === "video"
              ? { video: true, audio: true }
              : { video: false, audio: true }
          );
        } catch (error) {
          console.error("Error accessing media devices:", error);
          toast.error("Failed to access camera/microphone. Please allow permissions.");
          return;
        }
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
        set({ localStream });

        pc.ontrack = (event) => {
          console.log("peerConnection ontrack event");
          set({ remoteStream: event.streams[0] });
        };

        pc.onicecandidate = (event) => {
          console.log("peerConnection onicecandidate event", event.candidate);
          if (event.candidate && event.candidate.candidate !== "") {
            const socket = useAuthStore.getState().socket;
            socket.emit("iceCandidate", {
              to: caller._id,
              candidate: event.candidate,
            });
            console.log("Emitted iceCandidate event");
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("peerConnection connection state:", pc.connectionState);
          if (pc.connectionState === "failed") {
            toast.error(
              "WebRTC connection failed. Please check your TURN server configuration."
            );
            console.error(
              "peerConnection connection state failed, check TURN server and network."
            );
          }
        };
        pc.onicegatheringstatechange = () => {
          console.log("ICE gathering state:", pc.iceGatheringState);
        };
        pc.oniceconnectionstatechange = () => {
          console.log("ICE connection state:", pc.iceConnectionState);
        };

        set({
          callIncoming: true,
          caller: caller,
          incomingOffer: offer,
          callType,
          peerConnection: pc,
        });
      } catch (error) {
        console.error("Error handling callUser event", error);
      }
    });

    socket.on("iceCandidate", async ({ candidate }) => {
      console.log("Frontend received iceCandidate event", candidate);
      const peerConnection = get().peerConnection;
      if (candidate) {
        try {
          if (
            peerConnection &&
            peerConnection.remoteDescription &&
            peerConnection.remoteDescription.type
          ) {
            console.log("Adding ICE candidate immediately", candidate);
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("Added ICE candidate successfully", candidate);
          } else {
            const iceCandidateQueue = get().iceCandidateQueue || [];
            iceCandidateQueue.push(candidate);
            set({ iceCandidateQueue });
            console.log(
              "Queued ICE candidate until peerConnection and remote description are set",
              candidate
            );
          }
        } catch (error) {
          console.error("Error adding received ice candidate", error);
        }
      } else {
        console.warn("No ICE candidate received");
      }
    });

    socket.on("endCall", () => {
      console.log("Frontend received endCall event");
      const incomingCallAudio = get().incomingCallAudio;
      if (incomingCallAudio) {
        incomingCallAudio.pause();
        set({ incomingCallAudio: null });
      }
      console.log("Calling endCall() due to endCall socket event");
      get().endCall(false);
    });

    socket.on("answerCall", async ({ answer }) => {
      console.log("Frontend received answerCall event with answer SDP");
      const peerConnection = get().peerConnection;
      const iceCandidateQueue = get().iceCandidateQueue || [];
      if (peerConnection && answer) {
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          console.log("Set remote description on caller peerConnection");

          if (iceCandidateQueue.length > 0) {
            for (const candidate of iceCandidateQueue) {
              try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("Added queued ICE candidate");
              } catch (error) {
                console.error("Error adding queued ICE candidate", error);
              }
            }
            set({ iceCandidateQueue: [] });
          }

          set({
            callActive: true,
            callOutgoing: false,
            callIncoming: false,
            incomingCallAudio: null,
          });
        } catch (error) {
          console.error(
            "Error setting remote description on caller peerConnection",
            error
          );
        }
      } else {
        console.warn("Caller peerConnection or answer SDP missing");
      }
    });
    set({ listenersSubscribed: true });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.warn("Socket not available in unsubscribeFromMessages");
      return;
    }
    socket.off("newMessage");
    socket.off("missedCall");
    socket.off("callUser");
    socket.off("iceCandidate");
    socket.off("endCall");
    socket.off("answerCall");
    set({ listenersSubscribed: false });
  },

  emitStopTyping: (receiverId, senderId) => {
    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.warn("Socket not available in emitStopTyping");
      return;
    }
    socket.emit("stopTyping", { receiverId, senderId });
  },

  emitTyping: (receiverId, senderId) => {
    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.warn("Socket not available in emitTyping");
      return;
    }
    socket.emit("typing", { receiverId, senderId });
  },

  // Start a call (audio or video)
  startCall: async (type) => {
    const { selectedUser } = get();
    const { authUser } = useAuthStore.getState();
    if (!selectedUser || !authUser) {
      console.warn("startCall aborted: selectedUser or authUser missing");
      return;
    }

    try {
      const mediaConstraints =
        type === "video"
          ? { video: true, audio: true }
          : { video: false, audio: true };
      console.log("Requesting user media with constraints:", mediaConstraints);
      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      } catch (error) {
        console.error("Error accessing media devices:", error);
        toast.error("Failed to access camera/microphone. Please allow permissions.");
        return;
      }
      console.log("User media obtained");
      set({
        localStream,
        callType: type,
        callActive: true,
        callOutgoing: true,
        caller: authUser,
      });
      console.log("startCall: callOutgoing set to true and caller set to authUser");

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      console.log("RTCPeerConnection created");

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
        console.log("Added local track to peer connection:", track.kind);
      });

      pc.ontrack = (event) => {
        console.log("peerConnection ontrack event");
        set({ remoteStream: event.streams[0] });
      };

      pc.onicecandidate = (event) => {
        console.log("peerConnection onicecandidate event", event.candidate);
        if (event.candidate) {
          const socket = useAuthStore.getState().socket;
          console.log(
            "Emitting iceCandidate to",
            selectedUser._id,
            "candidate:",
            event.candidate
          );
          socket.emit("iceCandidate", {
            to: selectedUser._id,
            candidate: event.candidate,
          });
          console.log("Emitted iceCandidate event");
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("peerConnection connection state:", pc.connectionState);
        if (pc.connectionState === "failed") {
          toast.error(
            "WebRTC connection failed. Please check your TURN server configuration."
          );
        }
      };

      set({ peerConnection: pc });

      const offer = await pc.createOffer();
      console.log("Created offer");
      await pc.setLocalDescription(offer);
      console.log("Set local description");

      const socket = useAuthStore.getState().socket;
      socket.emit("callUser", {
        to: selectedUser._id,
        from: authUser._id,
        offer,
        callType: type,
      });
      console.log(
        `Call initiated from ${authUser._id} to ${selectedUser._id} with type ${type}`
      );
    } catch (error) {
      console.error("Error starting call", error);
    }
  },

  // Answer an incoming call
  answerCall: async () => {
    const {
      peerConnection,
      incomingOffer,
      localStream,
      missedCallTimeoutId,
      caller,
      iceCandidateQueue,
      incomingCallAudio,
    } = get();
    if (!peerConnection || !incomingOffer) {
      console.log("answerCall aborted: peerConnection or incomingOffer missing");
      return;
    }

    if (missedCallTimeoutId) {
      clearTimeout(missedCallTimeoutId);
      set({ missedCallTimeoutId: null });
    }

    if (incomingCallAudio) {
      incomingCallAudio.pause();
      set({ incomingCallAudio: null });
    }

    try {
      console.log("answerCall: setting remote description");
      await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));

      if (iceCandidateQueue && iceCandidateQueue.length > 0) {
        for (const candidate of iceCandidateQueue) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("Added queued ICE candidate");
          } catch (error) {
            console.error("Error adding queued ICE candidate", error);
          }
        }
        set({ iceCandidateQueue: [] });
      }

      console.log("answerCall: creating answer");
      const answer = await peerConnection.createAnswer();
      console.log("answerCall: setting local description");
      await peerConnection.setLocalDescription(answer);

      const socket = useAuthStore.getState().socket;
      console.log("answerCall: caller state:", caller);
      if (caller && caller._id) {
        console.log("answerCall: emitting answerCall event");
        socket.emit("answerCall", { to: caller._id, answer });
      } else {
        console.warn(
          "answerCall: caller is undefined or missing _id, cannot emit answerCall event"
        );
      }

      set({ callActive: true, callIncoming: false, callOutgoing: false });
      console.log(
        "answerCall: callActive set to true, callIncoming and callOutgoing set to false"
      );
    } catch (error) {
      console.error("Error answering call", error);
    }
  },

  // End the current call
  getCallDisplayName: () => {
    const { callOutgoing, caller, selectedUser } = get();
    if (callOutgoing) {
      return caller?.fullName || caller?.username || "Unknown";
    } else {
      return selectedUser?.fullName || selectedUser?.username || "Unknown";
    }
  },

  getCallDisplayInfo: () => {
    const { callOutgoing, caller, selectedUser } = get();
    if (callOutgoing) {
      // For outgoing call, reverse to show selectedUser's info
      return {
        name: selectedUser?.fullName || selectedUser?.username || "Unknown",
        image: selectedUser?.avatar || selectedUser?.image || null,
      };
    } else {
      // For incoming call, reverse to show caller's info
      return {
        name: caller?.fullName || caller?.username || "Unknown",
        image: caller?.avatar || caller?.image || null,
      };
    }
  },

  endCall: (emitEvent = true) => {
    const {
      peerConnection,
      localStream,
      remoteStream,
      missedCallTimeoutId,
      caller,
      incomingCallAudio,
      selectedUser,
    } = get();

    if (missedCallTimeoutId) {
      clearTimeout(missedCallTimeoutId);
      set({ missedCallTimeoutId: null });
    }

    if (peerConnection) {
      peerConnection.close();
      set({ peerConnection: null });
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      set({ localStream: null });
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      set({ remoteStream: null });
    }

    if (incomingCallAudio) {
      incomingCallAudio.pause();
      set({ incomingCallAudio: null });
    }

    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;

    // Determine recipientId as the other user in the call
    let recipientId = null;
    if (selectedUser && selectedUser._id && authUser && authUser._id) {
      if (selectedUser._id === authUser._id) {
        recipientId = caller && caller._id ? caller._id : null;
      } else {
        recipientId = selectedUser._id;
      }
    } else if (caller && caller._id) {
      recipientId = caller._id;
    } else if (authUser && authUser._id) {
      recipientId = authUser._id;
    }

    if (!recipientId) {
      console.warn("endCall called but no valid recipient id found, skipping socket emit");
      // Still clear call state to avoid stuck state
      set({
        callActive: false,
        callOutgoing: false,
        callType: null,
        callIncoming: false,
        caller: null,
        incomingOffer: null,
        incomingCallAudio: null,
      });
      return;
    }
    if (emitEvent) {
      socket.emit("endCall", { to: recipientId });
    }

    set({
      callActive: false,
      callOutgoing: false,
      callType: null,
      callIncoming: false,
      caller: null,
      incomingOffer: null,
      incomingCallAudio: null,
    });
  },
}));
