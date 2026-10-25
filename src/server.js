import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
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

// Windows FileTime based Sec-MS-GEC Token generator
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
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "The text field is required." });
    }

    const connectionId = crypto.randomUUID().replace(/-/g, "");
    const secMsGec = getSecMsGec();

    // Microsoft Edge TTS Endpoint အသစ် 
[9]
    const wsUrl = `wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-131.0.2903.86&ConnectionId=${connectionId}`;

    const ws = new WebSocket(wsUrl, {
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      },
    });

    const audioChunks = 
[];
    let isDone = false;

    const cleanup = () => {
      if (!isDone) {
        isDone = true;
        clearTimeout(timer);
        try {
          ws.close();
        } catch (e) {}
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      if (!res.headersSent) {
        res.status(504).json({ error: "TTS Generation Timeout" });
      }
    }, 20000);

    req.on("close", cleanup);

    ws.on("open", () => {
      const dateStr = new Date().toUTCString();
      const reqId = crypto.randomUUID().replace(/-/g, "");
      const cleanText = text
        .trim()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='my-MM'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}'>${cleanText}</prosody></voice></speak>`;

      ws.send(
        `X-Timestamp:${dateStr}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
      );

      ws.send(
        `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateStr}\r\nPath:ssml\r\n\r\n${ssml}`
      );
    });

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (buffer.length > 2) {
          const headerLen = buffer.readUInt16BE(0);
          if (buffer.length > headerLen + 2) {
            const headerText = buffer.toString("utf8", 2, headerLen + 2);
            if (headerText.includes("Path:audio")) {
              audioChunks.push(buffer.subarray(headerLen + 2));
            }
          }
        }
      } else {
        const str = data.toString();
        if (str.includes("Path:turn.end")) {
          cleanup();
          const audioBuffer = Buffer.concat(audioChunks);
          if (!res.headersSent) {
            res.set({
              "Content-Type": "audio/mpeg",
              "Content-Length": audioBuffer.length,
            });
            res.send(audioBuffer);
          }
        }
      }
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({ error: "Edge TTS WebSocket Failed" });
      }
    });

    ws.on("close", (code) => {
      if (!isDone && audioChunks.length === 0) {
        cleanup();
        if (!res.headersSent) {
          res.status(502).json({ error: `Connection closed (Code: ${code})` });
        }
      }
    });
  } catch (error) {
    console.error("Server error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Server Error" });
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Burmese TTS running on port ${PORT}`);
});
