import { api } from "@/lib/api";

export type FeedbackKind = "confusing" | "broken" | "idea" | "loved";
export type FeedbackSurface = "room" | "recap" | "pre_room" | "lobby" | "settings" | "other";

export const FEEDBACK_KINDS: { id: FeedbackKind; label: string; hint: string }[] = [
  { id: "confusing", label: "Confusing", hint: "I did not know what to do" },
  { id: "broken", label: "Broken", hint: "Something did not work" },
  { id: "idea", label: "Idea", hint: "It would be better if" },
  { id: "loved", label: "Loved it", hint: "Keep this" },
];

export function submitFeedback(body: {
  surface: FeedbackSurface;
  activity_id?: string | null;
  kind: FeedbackKind;
  text?: string;
  room_id?: string | null;
}): Promise<{ id: string; status: string }> {
  return api.post<{ id: string; status: string }>("/v1/users/me/feedback", {
    ...body,
    platform: "web",
    app_version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? undefined,
  });
}
