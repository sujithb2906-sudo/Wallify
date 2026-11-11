# WALLIFY wallpaper creator

## Goal
Replace the starter screen with a polished, responsive WALLIFY workspace where visitors can browse wallpaper styles, customize a phone wallpaper, generate one from a prompt, preview it on a phone, and download a PNG without signing in or paying.

## Build
- Create a dark, high-contrast purple/blue/black visual direction with a distinctive typography system, concise navigation, and a wallpaper gallery as the first screen.
- Add browsable category filters for Aesthetic, Minimal, Nature, Anime-inspired, Gaming, Abstract, Space, Cars, Quotes, and Dark Wallpapers, with visual previews and a clear path into editing.
- Build a canvas-backed editor with background and gradient controls, editable text, font/size/color/alignment controls, shapes/stickers, local image uploads, and pointer-based selection, dragging, and resizing. Include undo/redo and keep the preview synchronized with edits.
- Add a prompt-based image generator using the Lovable image-generation service, with genuine streamed image output, visible progress/errors, and no fake or static generation results.
- Show the current design in a phone mockup with lock-screen/home-screen previews. Export the composed canvas as PNG at 1080 × 1920 and offer a 4K-sized export when supported by the browser canvas.
- Keep editing and exports available without account creation or payment. Make the workspace usable at mobile and desktop widths, with no decorative controls that do nothing.
- Replace starter metadata with WALLIFY-specific page metadata and verify the central browse → edit/generate → preview → download workflow.

## Technical approach
- Keep the app on its existing TanStack Start and Tailwind v4 structure; implement the single requested experience at `/`.
- Use browser Canvas APIs for composition, pointer interactions, history, image upload, and high-resolution PNG exports; keep uploaded images local to the visitor's session.
- Use a TanStack server route to call the Lovable image gateway with its server-side key, stream results through unchanged, and parse image progress/errors in the browser. No database, login, or persistent storage is needed for this brief.
- Add focused tests for concrete export dimensions and editor state/history rules where practical, then check the preview and current build status.
