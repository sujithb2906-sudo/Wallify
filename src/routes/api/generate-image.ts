import { createFileRoute } from "@tanstack/react-router";

import { generateWallpaper, imageSettings } from "@/lib/image-gateway.server";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: { message: "Enter a wallpaper description to begin." } }, { status: 400 });
        }

        if (
          typeof body !== "object" ||
          body === null ||
          !("prompt" in body) ||
          typeof body.prompt !== "string" ||
          body.prompt.trim().length < 4 ||
          body.prompt.length > 1500
        ) {
          return Response.json(
            { error: { message: "Descriptions should be between 4 and 1,500 characters." } },
            { status: 400 },
          );
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { error: { message: "Image generation is temporarily unavailable. Try again later." } },
            { status: 500 },
          );
        }

        try {
          const upstream = await generateWallpaper(
            { ...imageSettings, apiKey },
            body.prompt.trim(),
            !("stream" in body && body.stream === false),
          );
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
              "Cache-Control": "no-cache, no-transform",
            },
          });
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return new Response(null, { status: 499 });
          }
          return Response.json(
            { error: { message: "Image generation could not be reached. Please try again." } },
            { status: 502 },
          );
        }
      },
    },
  },
});