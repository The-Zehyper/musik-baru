import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';

// Memory cache for audio stream URLs (valid 1.5 hours)
const ytCache = new Map<string, { data: { duration: string; audio: string }; expireAt: number }>();
const CACHE_TTL = 90 * 60 * 1000;

async function getDownload(url: string) {
  const idMatch = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/
  ].find(p => p.test(url))?.exec(url)?.[1] || (url.length === 11 ? url : null);

  if (!idMatch) {
    console.error("Invalid URL or video ID:", url);
    return null;
  }

  // Check cache first
  const cached = ytCache.get(idMatch);
  if (cached && cached.expireAt > Date.now()) {
    console.log(`[EXTRACT] Cache hit for video ID: ${idMatch}`);
    return cached.data;
  }

  const fullUrl = "https://www.youtube.com/watch?v=" + idMatch;
  const cdns = ["cdn405.savetube.vip", "cdn403.savetube.vip", "cdn401.savetube.vip"];

  for (const cdn of cdns) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const api = axios.create({
          headers: {
            "content-type": "application/json",
            "origin": "https://yt.savetube.me",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          },
          timeout: 25000
        });

        const infoResponse = await api.post(`https://${cdn}/v2/info`, { url: fullUrl });
        const encryptedData = infoResponse?.data?.data;
        if (!encryptedData) continue;

        const encrypted = Buffer.from(encryptedData, "base64");
        const decipher = crypto.createDecipheriv("aes-128-cbc",
          Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex"),
          encrypted.subarray(0, 16)
        );

        const decryptedBuffer = Buffer.concat([
          decipher.update(encrypted.subarray(16)),
          decipher.final()
        ]);

        const decrypted = JSON.parse(decryptedBuffer.toString());
        const downloadRes = await api.post(`https://${cdn}/download`, {
          id: idMatch,
          downloadType: "audio",
          quality: "128",
          key: decrypted.key
        });

        const audioUrl = downloadRes.data?.data?.downloadUrl || downloadRes.data?.downloadUrl;
        if (audioUrl) {
          const result = {
            duration: `${Math.floor(decrypted.duration / 60)}:${(decrypted.duration % 60).toString().padStart(2, "0")}`,
            audio: audioUrl
          };
          ytCache.set(idMatch, { data: result, expireAt: Date.now() + CACHE_TTL });
          return result;
        }
      } catch (err: any) {
        console.error(`Extraction attempt ${attempt} on ${cdn} failed:`, err?.message || err);
      }
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || searchParams.get('query') || searchParams.get('url');
  
  if (!id) {
    return NextResponse.json({ status: false, message: 'Parameter query/id/url required' }, { status: 400 });
  }

  try {
    const audioData = await getDownload(id);
    if (audioData && audioData.audio) {
      return NextResponse.json({
        status: true,
        result: {
          duration: audioData.duration || null,
          download: { audio: audioData.audio }
        }
      });
    }

    return NextResponse.json({ status: false, error: 'Extraction service unavailable' }, { status: 503 });
  } catch (err: any) {
    return NextResponse.json({ status: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = (body.query || body.url || body.id || '').trim();

    if (!url) {
      return NextResponse.json({ status: false, message: 'Parameter query wajib diisi' }, { status: 400 });
    }

    const audioData = await getDownload(url);
    if (audioData && audioData.audio) {
      return NextResponse.json({
        status: true,
        result: {
          duration: audioData.duration || null,
          download: { audio: audioData.audio }
        }
      });
    }

    return NextResponse.json({ status: false, error: 'Extraction service overloaded' }, { status: 503 });
  } catch (err: any) {
    return NextResponse.json({ status: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
