import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import io from "socket.io-client";
import { SkipForward, Send } from "lucide-react";
import { Socket } from "socket.io-client";

const Room = ({
  name,
  stream,
}: {
  name: string;
  localAudioTrack: MediaStreamTrack | null;
  localVideoTrack: MediaStreamTrack | null;
  stream: MediaStream | null;
}) => {
  const [searchParams] = useSearchParams();
  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("");
  const [roomId, setRoomId] = useState("");
  const [messages, setMessages] = useState<{ text: string; isSelf: boolean }[]>(
    [
      { text: "Hi there!", isSelf: true },
      { text: "Hello!", isSelf: false },
    ]
  );

  const handleSendMessage = () => {
    if (message.trim()) {
      setMessages((messages) => [...messages, { text: message, isSelf: true }]);
      setMessage("");
      socket?.emit("message", {
        text: message,
        roomId,
        socketId: socket.id,
      });
    }
  };

  // Store pending ICE candidates until remote description is set
  const [pendingCandidates, setPendingCandidates] = useState<RTCIceCandidate[]>(
    []
  );
  const [remoteDescriptionSet, setRemoteDescriptionSet] = useState(false);

  const userName = name || searchParams.get("name") || "Anonymous";

  // Set up local video
  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  //handling the messages

  // Main connection setup
  useEffect(() => {
    const newSocket = io(
      "ws://ec2-13-60-251-80.eu-north-1.compute.amazonaws.com:3000",
      {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      }
    );
    setSocket(newSocket);
    let peerConnection: RTCPeerConnection | null = null;

    // Function to add all pending ICE candidates
    const addPendingCandidates = async () => {
      if (
        peerConnection &&
        remoteDescriptionSet &&
        pendingCandidates.length > 0
      ) {
        console.log(
          `Adding ${pendingCandidates.length} pending ICE candidates`
        );
        for (const candidate of pendingCandidates) {
          try {
            await peerConnection.addIceCandidate(candidate);
          } catch (e) {
            console.error("Error adding pending ICE candidate:", e);
          }
        }
        setPendingCandidates([]);
      }
    };

    // Connection established with server
    newSocket.on("connect", () => {
      console.log("Connected to server with ID:", newSocket.id);
      newSocket.emit("join-lobby", { name: userName });
    });

    // Initialize sender peer connection
    newSocket.on("send-offer", async (m: { roomId: string }) => {
      console.log("Received send-offer for room:", m.roomId);
      setRoomId(m.roomId);

      // Create peer connection
      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
        iceTransportPolicy: "all",
        iceCandidatePoolSize: 10,
      });
      setPc(peerConnection);
      console.log("Created peer connection (sender)");

      // Add tracks to peer connection
      if (stream) {
        console.log("Adding local stream tracks to connection");
        stream.getTracks().forEach((track) => {
          if (peerConnection) peerConnection.addTrack(track, stream);
        });
      }

      // Handle ICE candidates
      console.error("code reached before generating ice candidates");

      // Handle remote tracks
      peerConnection.ontrack = (e) => {
        console.log("Sender: Received remote track", e.track.kind);
        if (remoteVideoRef.current && e.streams && e.streams[0]) {
          console.log("Setting remote stream to video element");
          remoteVideoRef.current.srcObject = e.streams[0];

          // Safe play after metadata is loaded
          remoteVideoRef.current.onloadedmetadata = () => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current
                .play()
                .catch((err) =>
                  console.error("Error playing remote video:", err)
                );
            }
          };
        }
      };

      // Create and send offer
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log("Sender: Created and set local offer");

        newSocket.emit("offer", {
          sdp: offer,
          roomId: m.roomId,
          socketId: newSocket.id,
        });
      } catch (err) {
        console.error("Error creating offer:", err);
      }
      peerConnection.onicecandidate = (e) => {
        if (e.candidate) {
          console.log("Sender: Generated ICE candidate");
          newSocket.emit("add-ice-candidates", {
            candidate: e.candidate,
            type: "sender",
            roomId: m.roomId,
            socketId: newSocket.id,
          });
        }
      };
    });

    // Initialize receiver peer connection
    newSocket.on(
      "offer",
      async ({
        roomId,
        sdp,
      }: {
        roomId: string;
        sdp: RTCSessionDescriptionInit;
      }) => {
        console.log("Received offer for room:", roomId);
        setRoomId(roomId);

        // Create peer connection
        peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        setPc(peerConnection);
        console.log("Created peer connection (receiver)");

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("Receiver: Generated ICE candidate");
            newSocket.emit("add-ice-candidates", {
              candidate: event.candidate,
              roomId,
              socketId: newSocket.id,
              type: "receiver",
            });
          }
        };

        // Handle remote tracks
        peerConnection.ontrack = (event) => {
          console.log("Receiver: Received remote track", event.track.kind);
          if (remoteVideoRef.current && event.streams && event.streams[0]) {
            console.log("Setting remote stream to video element");
            remoteVideoRef.current.srcObject = event.streams[0];

            // Safe play after metadata is loaded
            remoteVideoRef.current.onloadedmetadata = () => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current
                  .play()
                  .catch((err) =>
                    console.error("Error playing remote video:", err)
                  );
              }
            };
          }
        };

        // Add local tracks
        if (stream) {
          stream.getTracks().forEach((track) => {
            if (peerConnection) peerConnection.addTrack(track, stream);
          });
        }

        // Set remote description (offer)
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(sdp)
          );
          setRemoteDescriptionSet(true);
          console.log("Receiver: Set remote description (offer)");

          // Create and send answer
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          console.log("Receiver: Created and set local answer");

          newSocket.emit("answer", {
            sdp: answer,
            roomId,
            socketId: newSocket.id,
          });

          // Add any pending ICE candidates
          await addPendingCandidates();
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      }
    );

    // Handle incoming answer
    newSocket.on(
      "answer",
      async ({
        roomId,
        sdp,
      }: {
        roomId: string;
        sdp: RTCSessionDescriptionInit;
      }) => {
        console.log("Received answer for room:", roomId);

        if (!peerConnection) {
          console.error("No peer connection available");
          return;
        }

        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(sdp)
          );
          setRemoteDescriptionSet(true);
          console.log("Sender: Set remote description (answer)");

          // Add any pending ICE candidates
          await addPendingCandidates();
        } catch (err) {
          console.error("Error setting remote description:", err);
        }
      }
    );

    // Handle ICE candidates
    newSocket.on(
      "add-ice-candidate",
      async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        if (!peerConnection) {
          console.log("Storing ICE candidate for later");
          setPendingCandidates((prev) => [
            ...prev,
            new RTCIceCandidate(candidate),
          ]);
          return;
        }

        if (!remoteDescriptionSet) {
          console.log("Remote description not set, storing ICE candidate");
          setPendingCandidates((prev) => [
            ...prev,
            new RTCIceCandidate(candidate),
          ]);
          return;
        }

        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("Added ICE candidate successfully");
        } catch (e) {
          console.error("Error adding ICE candidate:", e);
        }
      }
    );

    // Effect cleanup
    newSocket.on("disconnect", () => {
      console.log("Disconnected from server");
      if (peerConnection) {
        peerConnection.close();
        setPc(null);
      }
    });

    setSocket(newSocket);

    // Cleanup on component unmount
    return () => {
      console.log("Cleaning up WebRTC connections");
      newSocket.disconnect();
      if (peerConnection) {
        peerConnection.close();
        setPc(null);
      }
    };
  }, [name, userName, stream]);

  // Effect to handle pending candidates when remote description is set
  useEffect(() => {
    const addPendingCandidates = async () => {
      if (pc && remoteDescriptionSet && pendingCandidates.length > 0) {
        console.log(
          `Adding ${pendingCandidates.length} pending ICE candidates after remote description set`
        );
        for (const candidate of pendingCandidates) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (e) {
            console.error("Error adding pending ICE candidate:", e);
          }
        }
        setPendingCandidates([]);
      }
    };

    addPendingCandidates();
  }, [remoteDescriptionSet, pendingCandidates, pc]);

  // HANDLE MESSAGES
  useEffect(() => {
    console.error("socket got triggered for meessage: ");

    socket?.on("participantMessage", (e: { text: string }) => {
      console.log(messages);

      console.log(e);
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: e.text, isSelf: false },
      ]);
    });

    socket?.on("skipOther", () => {
      console.log("Received skipOther");
      setRoomId("");
      setMessages([]);
      if (pc) {
        pc.close();
        setPc(null);
      }
    });
  }, [socket]);
  const handleSkipForward = () => {
    if (socket && roomId) {
      socket.emit("skip", { roomId, socketId: socket.id });
    }
    setRoomId("");
    setMessages([]);
    if (pc) {
      pc.close();
      setPc(null);
    }
  };
  return (
    <div className="min-h-screen bg-blue-200 flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex p-4 gap-4">
        {/* Left Side - Videos */}
        <div className="w-1/3 flex flex-col gap-4">
          <div className="relative bg-amber-100 rounded-lg shadow-md aspect-video flex items-center justify-center">
            <div className="absolute top-2 left-2 bg-blue-500 px-2 py-1 rounded text-xs text-white z-10">
              Stranger
            </div>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover rounded-lg"
            />
          </div>

          <div className="relative bg-white rounded-lg shadow-md aspect-video flex items-center justify-center">
            <div className="absolute top-2 left-2 bg-green-500 px-2 py-1 rounded text-xs text-white">
              You
            </div>
            <div className="text-gray-400 text-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>

          {/* Video Controls */}
          <div className="flex justify-center gap-4 p-4 bg-white rounded-lg shadow-md">
            <button
              onClick={handleSkipForward}
              className="p-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors"
            >
              <SkipForward className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Right Side - Chat */}
        <div className="flex-1 bg-white rounded-lg shadow-md flex flex-col">
          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex flex-col gap-3">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.isSelf ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      msg.isSelf
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendMessage}
                className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white shadow-sm p-4 mt-4">
        <p className="text-gray-500 text-center text-sm">
          By using this service, you agree to our Terms of Service and Privacy
          Policy
        </p>
      </footer>
    </div>
  );
};

export default Room;
