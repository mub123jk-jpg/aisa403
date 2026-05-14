import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

// Default fallback: a deep, warm male voice ("Bill") if Magnus lookup fails.
const FALLBACK_VOICE_ID = "pqHfZKP75CvOlQylNhV4";

let cachedMagnusId: string | null = null;

async function findMagnusVoiceId(apiKey: string): Promise<string> {
  if (cachedMagnusId) return cachedMagnusId;
  try {
    const r = await fetch(
      "https://api.elevenlabs.io/v1/shared-voices?search=magnus&page_size=10",
      { headers: { "xi-api-key": apiKey } },
    );
    if (r.ok) {
      const data = (await r.json()) as any;
      const match =
        data?.voices?.find((v: any) => v?.name?.toLowerCase() === "magnus") ??
        data?.voices?.[0];
      if (match?.voice_id) {
        cachedMagnusId = match.voice_id as string;
        return cachedMagnusId;
      }
    }
  } catch {
    // ignore
  }
  cachedMagnusId = FALLBACK_VOICE_ID;
  return cachedMagnusId;
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response("Missing ELEVENLABS_API_KEY", { status: 500 });
        }
        const { text, voiceId } = (await request.json()) as {
          text?: string;
          voiceId?: string;
        };
        if (!text || text.trim().length === 0) {
          return new Response("text is required", { status: 400 });
        }
        const trimmed = text.slice(0, 4000);
        const finalVoice = voiceId || (await findMagnusVoiceId(apiKey));

        const r = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${finalVoice}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: trimmed,
              model_id: "eleven_turbo_v2_5",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.8,
                style: 0.3,
                use_speaker_boost: true,
              },
            }),
          },
        );
        if (!r.ok) {
          const err = await r.text();
          return new Response(err || `TTS failed: ${r.status}`, { status: r.status });
        }
        const buf = await r.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
