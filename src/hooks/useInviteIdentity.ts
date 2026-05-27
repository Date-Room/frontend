import { useEffect, useState } from "react";
import {
  getDailyToken,
  getUserId,
  getUserName,
  setDailyToken,
  setUserId,
  setUserName,
} from "@/lib/room";

export type Identity = {
  userId: string;
  userName: string;
  token: string;
};

type InviteState = {
  identity: Identity | null;
  isReady: boolean;
};

/**
 * Reads ?token=&name=&id= from the URL synchronously on first load,
 * persists to localStorage, cleans the URL, and returns the active identity.
 *
 * `isReady` is false until the URL has been parsed at least once, so
 * privacy gates can wait before redirecting.
 */
export function useInviteIdentity(): InviteState {
  const [state, setState] = useState<InviteState>(() => {
    // Parse URL params SYNCHRONOUSLY before any render decisions.
    if (typeof window === "undefined") {
      return { identity: null, isReady: true };
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const name = params.get("name");
    const id = params.get("id");

    if (token && name && id) {
      setDailyToken(token);
      setUserName(name);
      setUserId(id);
      return {
        identity: { token, userName: name, userId: id },
        isReady: true,
      };
    }

    // Require a previously-stored invite (token + name). Without all three,
    // the visitor is anonymous and must be redirected to /invite. No guest
    // auto-provisioning, no preview-pane bypass.
    const storedToken = getDailyToken();
    const storedName = getUserName();
    if (storedToken && storedName) {
      return {
        identity: { token: storedToken, userName: storedName, userId: getUserId() },
        isReady: true,
      };
    }

    return { identity: null, isReady: true };
  });

  useEffect(() => {
    // Strip invite params from the URL after they've been persisted.
    const params = new URLSearchParams(window.location.search);
    if (params.has("token") || params.has("name") || params.has("id")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // Re-sync if something else changed localStorage in the meantime.
    if (!state.identity) {
      const tok = getDailyToken();
      const name = getUserName();
      if (tok && name) {
        setState({
          identity: { token: tok, userName: name, userId: getUserId() },
          isReady: true,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
