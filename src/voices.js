import { MsEdgeTTS } from "msedge-tts";

export async function getVoices() {
  const tts = new MsEdgeTTS();

  if (typeof tts.getVoices === "function") {
    return await tts.getVoices();
  }

  return 
[];
}
