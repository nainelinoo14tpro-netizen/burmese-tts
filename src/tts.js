import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const DEFAULT_VOICE = process.env.EDGE_TTS_VOICE || "my-MM-NilarNeural";
const OUTPUT_DIR = path.resolve("output");

export async function synthesizeToFile({
  text,
  voice = DEFAULT_VOICE,
  rate = "+0%",
  pitch = "+0Hz",
  outputFile,
}) {
  if (!text || !text.trim()) {
    throw new Error("Text is required.");
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const fileName =
    outputFile ||
    `burmese-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;

  const outputPath = path.join(OUTPUT_DIR, fileName);

  const tts = new MsEdgeTTS();

  await tts.setMetadata(
    voice,
    OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
  );

  const { audioStream } = tts.toStream(text, {
    rate,
    pitch,
  });

  await pipeline(audioStream, fs.createWriteStream(outputPath));

  return {
    fileName,
    outputPath,
  };
}

export function getDefaultVoice() {
  return DEFAULT_VOICE;
}
