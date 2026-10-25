import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { synthesizeToFile, getDefaultVoice } from "./tts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use(express.static(path.join(__dirname, "../public")));
app.use("/audio", express.static(path.resolve("output")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "burmese-tts",
    defaultVoice: getDefaultVoice(),
  });
});

app.post("/api/synthesize", async (req, res) => {
  try {
    const {
      text,
      voice,
      rate = "+0%",
      pitch = "+0Hz",
    } = req.body;

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: "The text field is required.",
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        error: "Text must not exceed 5,000 characters.",
      });
    }

    const result = await synthesizeToFile({
      text: text.trim(),
      voice,
      rate,
      pitch,
    });

    res.json({
      success: true,
      voice: voice || getDefaultVoice(),
      fileName: result.fileName,
      audioUrl: `/audio/${result.fileName}`,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Speech synthesis failed.",
      details: error.message,
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Burmese TTS running at http://localhost:${PORT}`);
});
