import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "crypto";

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

// Windows FileTime based Sec-MS-GEC Token Generator
function getSecMsGec() {
  const unixSeconds = Math.floor(Date.now() / 1000);
  const fileTimeSeconds = BigInt(unixSeconds) + 11644473600n;
  let ticks = fileTimeSeconds * 10000000n;
  ticks -= ticks % 3000000000n;
  const strToHash = ticks.toString() + "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  return crypto.createHash("sha256").update(strToHash).digest("hex").toUpperCase();
}

app.post("/api/synthesize", async (req, res) => {
  try {
    const {
      text,
      voice = "my-MM-NilarNeural",
      rate = "+0%",
      pitch = "+0Hz",
      volume = "+0%",
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "The text field is required." });
    }

    const cleanText = text
      .trim()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='my-MM'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${cleanText}</prosody></voice></speak>`;

    const secMsGec = getSecMsGec();
    const connectionId = crypto.randomUUID().replace(/-/g, "");

    const endpointUrl = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-131.0.2903.86&ConnectionId=${connectionId}`;

    const dateStr = new Date().toUTCString();
    const reqId = crypto.randomUUID().replace(/-/g, "");

    // Edge Speech SSML Payload
    const payload = `X-Timestamp:${dateStr}\r\nContent-Type:application/ssml+xml\r\nX-RequestId:${reqId}\r\nPath:ssml\r\n\r\n${ssml}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
        "Accept-Encoding": "gzip, deflate, br",
        "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "Content-Type": "application/ssml+xml",
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`TTS Upstream Server returned HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Audio stream header စစ်ဆေးပြီး MP3 binary သီးသန့် ခွဲထုတ်ခြင်း
    const headerSeparator = Buffer.from("Path:audio\r\n");
    const sepIndex = buffer.indexOf(headerSeparator);

    let audioData = buffer;
    if (sepIndex !== -1) {
      // Body payload ထဲမှ audio binary ကို ရယူခြင်း
      audioData = buffer.subarray(sepIndex + headerSeparator.length);
    }

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioData.length,
    });

    res.send(audioData);
  } catch (error) {
    console.error("Server Error:", error);
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
