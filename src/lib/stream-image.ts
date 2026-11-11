import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImagePayload = { type?: string; b64_json?: string; error?: { message?: string } };

export async function streamImage(
  endpoint: string,
  input: Record<string, unknown>,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<void> {
  const send = (stream: boolean) =>
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, stream }),
    });

  const response = await send(true);
  if (!response.ok || !response.body) {
    let message = `Image generation failed (${response.status}).`;
    try {
      const payload = (await response.clone().json()) as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text;
    }
    throw new Error(message);
  }

  let completed = false;
  let sawEvent = false;
  let streamError: string | undefined;
  const parser = createParser({
    onEvent(event) {
      let payload: ImagePayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImagePayload;
      } catch {
        return;
      }
      if (event.event === "error" || payload.type === "error") {
        sawEvent = true;
        streamError = payload.error?.message ?? "Image generation failed.";
        return;
      }
      const type = event.event || payload.type;
      if (type !== "image_generation.partial_image" && type !== "image_generation.completed") return;
      sawEvent = true;
      if (!payload.b64_json) {
        streamError = "The image service returned an empty image.";
        return;
      }
      const final = type === "image_generation.completed";
      flushSync(() => onFrame(`data:image/png;base64,${payload.b64_json}`, final));
      if (final) completed = true;
    },
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      parser.feed(chunk.value);
    }
  } catch (error) {
    if (sawEvent || (error instanceof Error && error.name === "AbortError")) throw error;
    sawEvent = false;
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (streamError) throw new Error(streamError);
  if (!completed && sawEvent) throw new Error("The image service ended before your wallpaper was complete.");
  if (!sawEvent) {
    const replay = await send(false);
    if (!replay.ok) {
      const message = await replay.text().catch(() => "");
      throw new Error(message || `Image generation failed (${replay.status}).`);
    }
    const result = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("The image service returned no wallpaper. Please try again.");
    onFrame(`data:image/png;base64,${b64}`, true);
  }
}