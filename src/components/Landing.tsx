import { useEffect, useRef, useState } from "react";
import Room from "./Room";

export default function Landing() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] =
    useState<MediaStreamTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] =
    useState<MediaStreamTrack | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const handleJoinButton = () => {
    setJoined(true);
  };
  const getCam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Store the full stream
      setStream(mediaStream);

      // Get individual tracks
      const audioTrack = mediaStream.getAudioTracks()[0] || null;
      const videoTrack = mediaStream.getVideoTracks()[0] || null;
      console.log(1, audioTrack, videoTrack);

      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  useEffect(() => {
    getCam();

    // Clean up function to stop all tracks when component unmounts
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  if (!joined) {
    return (
      <div className=" bg-amber-100 w-full h-screen flex flex-col items-center justify-center">
        <h1 className=" text-5xl text-amber-950">Baateee</h1>
        <div className=" flex flex-col gap-2 items-center justify-center p-5">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "300px", height: "225px", background: "#333" }}
            className=" rounded-2xl border-4 border-amber-950 overflow-hidden "
          />
          <h1 className="  text-xs ">
            "Check does your hairs look good before entering the room"
          </h1>
        </div>
        <div className=" flex items-center justify-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className=" border-2 py-1 px-2 "
            onKeyDown={(e) => e.key === "Enter" && handleJoinButton()}
          />
          <button
            onClick={handleJoinButton}
            className=" bg-orange-800 px-2 py-1 hover:scale-100 active:scale-95"
          >
            Join Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <Room
      name={name}
      localAudioTrack={localAudioTrack}
      localVideoTrack={localVideoTrack}
      stream={stream}
    />
  );
}
