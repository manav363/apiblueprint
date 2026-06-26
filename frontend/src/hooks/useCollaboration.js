import { useEffect, useRef, useState } from "react";
import { createCollabConnection } from "../services/collab";
import { getStoredToken, getStoredUsername } from "../services/api";

/**
 * Open a collaboration session for a project. Returns the current roster, a
 * connection status, and a `sendEdit` to broadcast local changes. Remote edits
 * are delivered to the `onRemoteEdit` callback (e.g. to refetch).
 */
export function useCollaboration(projectId, { onRemoteEdit } = {}) {
  const [collaborators, setCollaborators] = useState([]);
  const [status, setStatus] = useState("idle");
  const connectionRef = useRef(null);
  const onRemoteEditRef = useRef(onRemoteEdit);

  // Keep the latest callback in a ref so the connection effect doesn't need to
  // tear down and reconnect every time the caller passes a new closure.
  useEffect(() => {
    onRemoteEditRef.current = onRemoteEdit;
  }, [onRemoteEdit]);

  useEffect(() => {
    if (!projectId) {
      setCollaborators([]);
      setStatus("idle");
      return undefined;
    }

    let connection;
    try {
      connection = createCollabConnection({
        projectId,
        token: getStoredToken(),
        name: getStoredUsername() || "Anonymous",
        onStatus: setStatus,
        onPresence: (message) => setCollaborators(message.users || []),
        onEdit: (message) => onRemoteEditRef.current?.(message),
      });
      connectionRef.current = connection;
    } catch {
      setStatus("error");
      return undefined;
    }

    return () => {
      connection.close();
      connectionRef.current = null;
      setCollaborators([]);
      setStatus("idle");
    };
  }, [projectId]);

  function sendEdit(payload) {
    connectionRef.current?.sendEdit(payload);
  }

  return { collaborators, status, sendEdit };
}
