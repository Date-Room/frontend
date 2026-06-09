export type ConnectionIntent = "playful" | "heartfelt" | "electric" | "reconnect";

export function connectionIntentLabel(id: ConnectionIntent): string {
  switch (id) {
    case "electric":
      return "Electric · brave flirt";
    case "reconnect":
      return "Reconnect · soften";
    case "playful":
      return "Playful";
    case "heartfelt":
      return "Heartfelt";
  }
}
