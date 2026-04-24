import { useParticipantIds, useLocalSessionId } from "@daily-co/daily-react";
import { VideoTile } from "./VideoTile";
import { useMemo } from "react";

export function VideoGrid() {
  const localSessionId = useLocalSessionId();
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });

  // Grid layout logic based on participant count
  const allIds = useMemo(() => {
    const ids = [];
    if (localSessionId) ids.push(localSessionId);
    ids.push(...remoteParticipantIds);
    return ids;
  }, [localSessionId, remoteParticipantIds]);

  const gridClass = useMemo(() => {
    const count = allIds.length;
    if (count === 1) return "grid-cols-1 max-w-4xl mx-auto";
    if (count === 2) return "grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto";
    if (count <= 4) return "grid-cols-2 max-w-5xl mx-auto";
    if (count <= 6) return "grid-cols-2 md:grid-cols-3 max-w-6xl mx-auto";
    if (count <= 9) return "grid-cols-3 max-w-6xl mx-auto";
    return "grid-cols-3 md:grid-cols-4 lg:grid-cols-5 max-w-7xl mx-auto";
  }, [allIds.length]);

  return (
    <div className="custom-scrollbar h-full w-full flex-1 overflow-y-auto p-4 md:p-6">
      <div className={`grid gap-4 ${gridClass} h-full content-center`}>
        {allIds.map((id) => (
          <VideoTile key={id} id={id} isLocal={id === localSessionId} />
        ))}
      </div>
    </div>
  );
}
