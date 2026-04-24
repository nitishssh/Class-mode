import { useCallback } from "react";
import { useDaily, useLocalParticipant } from "@daily-co/daily-react";

export function useMediaControls() {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();

  const isVideoEnabled = localParticipant?.tracks.video.state === "playable";
  const isAudioEnabled = localParticipant?.tracks.audio.state === "playable";

  const toggleVideo = useCallback(() => {
    if (!daily) return;
    daily.setLocalVideo(!daily.localVideo());
  }, [daily]);

  const toggleAudio = useCallback(() => {
    if (!daily) return;
    daily.setLocalAudio(!daily.localAudio());
  }, [daily]);

  return {
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
  };
}
