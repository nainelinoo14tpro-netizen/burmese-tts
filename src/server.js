import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "burmese-tts" });
});

app.post("/api/synthesize", async (req, res) => {
  try {
    const {
      text,
      voice = "my-MM-NilarNeural",
      rate = "+0%",
      pitch = "+0Hz",
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "The text field is required." });
    }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text.trim(), {
      rate: rate,
      pitch: pitch,
    });

    res.set({
      "Content-Type": "audio/mpeg",
      "Transfer-Encoding": "chunked",
    });

    audioStream.pipe(res);

    audioStream.on("error", (err) => {
      console.error("Audio stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "TTS Streaming Failed" });
      }
    });

    req.on("close", () => {
      audioStream.destroy();
    });
  } catch (error) {
    console.error("Server error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Speech synthesis failed.",
        details: error.message,
      });
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Burmese TTS running on port ${PORT}`);
});
