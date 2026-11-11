import { createFileRoute } from "@tanstack/react-router";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crop,
  Download,
  ImagePlus,
  Layers2,
  Minus,
  Palette,
  Plus,
  Redo2,
  RefreshCw,
  Sparkles,
  Sticker,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import forestImage from "@/assets/wallpaper-forest.jpg";
import oceanImage from "@/assets/wallpaper-ocean.jpg";
import astralImage from "@/assets/wallpaper-astral.jpg";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  imageElementBounds,
  recordWallpaperChange,
  redoWallpaperChange,
  undoWallpaperChange,
  wallpaperSizes,
  type HistoryState,
  type WallpaperLayer,
  type WallpaperScene,
  type WallpaperSize,
} from "@/lib/wallpaper-editor";
import { streamImage } from "@/lib/stream-image";

const categories = [
  "For you",
  "Aesthetic",
  "Minimal",
  "Nature",
  "Anime-inspired",
  "Gaming",
  "Abstract",
  "Space",
  "Cars",
  "Quotes",
  "Dark wallpapers",
] as const;

const initialScene: WallpaperScene = {
  background: { kind: "image", source: astralImage },
  layers: [
    {
      id: "quote",
      kind: "text",
      x: 500,
      y: 305,
      scale: 1,
      color: "#ffffff",
      font: "DM Sans",
      fontSize: 48,
      text: "make room\nfor wonder",
      align: "center",
    },
    {
      id: "sparkle",
      kind: "sticker",
      x: 500,
      y: 995,
      scale: 1,
      color: "#f1d9ff",
      text: "✦",
    },
  ],
};

type WallpaperPreset = {
  id: string;
  title: string;
  author: string;
  category: (typeof categories)[number][];
  source: string;
  theme: "violet" | "teal" | "green" | "dawn";
  badge?: string;
};

const presets: WallpaperPreset[] = [
  {
    id: "astral",
    title: "A quiet universe",
    author: "Lunar archive",
    category: ["For you", "Aesthetic", "Space", "Dark wallpapers", "Abstract"],
    source: astralImage,
    theme: "violet",
    badge: "Trending",
  },
  {
    id: "ocean",
    title: "Between tides",
    author: "Offshore",
    category: ["For you", "Nature", "Aesthetic", "Minimal"],
    source: oceanImage,
    theme: "teal",
    badge: "New",
  },
  {
    id: "forest",
    title: "The long way home",
    author: "Field notes",
    category: ["For you", "Nature", "Aesthetic"],
    source: forestImage,
    theme: "green",
  },
  {
    id: "dusk",
    title: "Afterglow studies",
    author: "Soft static",
    category: ["For you", "Minimal", "Abstract", "Anime-inspired"],
    source: astralImage,
    theme: "dawn",
  },
];

const fallbackCategoryPreset: Record<string, string> = {
  "Anime-inspired": "dusk",
  Gaming: "astral",
  Cars: "dusk",
  Quotes: "ocean",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WALLIFY — your screen, your style" },
      {
        name: "description",
        content: "Find a feeling, make it yours, and create a wallpaper made for your screen.",
      },
      { property: "og:title", content: "WALLIFY — your screen, your style" },
      {
        property: "og:description",
        content: "A little corner of the internet where your next phone wallpaper takes shape.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap",
      },
    ],
  }),
  component: WallpaperStudio,
});

function WallpaperStudio() {
  const [history, setHistory] = useState<HistoryState<WallpaperScene>>({
    past: [],
    present: initialScene,
    future: [],
  });
  const scene = history.present;
  const [selectedId, setSelectedId] = useState<string | null>("quote");
  const [activeCategory, setActiveCategory] = useState<string>("For you");
  const [activeMode, setActiveMode] = useState<"lock" | "home">("lock");
  const [exportSize, setExportSize] = useState<WallpaperSize>("hd");
  const [backgroundMode, setBackgroundMode] = useState<"photo" | "gradient">("photo");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalImage, setIsFinalImage] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; x: number; y: number; resize: boolean } | null>(null);
  const sceneRef = useRef(scene);
  const imageCache = useRef(new Map<string, HTMLImageElement>());

  useEffect(() => {
    sceneRef.current = scene;
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const draw = async () => {
      const width = canvas.width;
      const height = canvas.height;
      if (scene.background.kind === "image") {
        const source = scene.background.source;
        let image = imageCache.current.get(source);
        if (!image) {
          image = new Image();
          image.src = source;
          imageCache.current.set(source, image);
        }
        if (!image.complete) await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
        if (cancelled) return;
        if (image.naturalWidth) {
          const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
          const cropWidth = width / ratio;
          const cropHeight = height / ratio;
          context.drawImage(
            image,
            (image.naturalWidth - cropWidth) / 2,
            (image.naturalHeight - cropHeight) / 2,
            cropWidth,
            cropHeight,
            0,
            0,
            width,
            height,
          );
        } else {
          context.fillStyle = "#15111f";
          context.fillRect(0, 0, width, height);
        }
      } else {
        const gradient = context.createLinearGradient(width * 0.1, height * 0.05, width, height);
        gradient.addColorStop(0, scene.background.from);
        gradient.addColorStop(1, scene.background.to);
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      }

      context.save();
      context.scale(width / 1000, height / 1778);
      for (const layer of scene.layers) {
        context.save();
        context.translate(layer.x, layer.y);
        context.scale(layer.scale, layer.scale);
        if (layer.kind === "text") {
          const fontSize = layer.fontSize ?? 48;
          const font = layer.font ?? "DM Sans";
          context.font = `${fontSize}px "${font}"`;
          context.fillStyle = layer.color;
          context.textAlign = layer.align ?? "center";
          context.textBaseline = "middle";
          const lines = (layer.text ?? "").split("\n");
          const lineHeight = fontSize * 1.18;
          lines.forEach((line, index) => {
            context.fillText(line, 0, (index - (lines.length - 1) / 2) * lineHeight, 880);
          });
        } else if (layer.kind === "image" && layer.source) {
          let image = imageCache.current.get(layer.source);
          if (!image) {
            image = new Image();
            image.src = layer.source;
            imageCache.current.set(layer.source, image);
          }
          if (!image.complete) await new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          });
          if (cancelled) {
            context.restore();
            break;
          }
          if (image.naturalWidth) {
            const size = 180;
            context.save();
            context.beginPath();
            context.roundRect(-size / 2, -size / 2, size, size, 14);
            context.clip();
            context.drawImage(image, -size / 2, -size / 2, size, size);
            context.restore();
          }
        } else if (layer.kind === "shape") {
          context.fillStyle = layer.color;
          context.beginPath();
          if (layer.shape === "star") {
            for (let point = 0; point < 10; point += 1) {
              const radius = point % 2 === 0 ? 48 : 24;
              const angle = (Math.PI * point) / 5 - Math.PI / 2;
              if (point === 0) context.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
              else context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            context.closePath();
          } else {
            context.arc(0, 0, 38, 0, Math.PI * 2);
          }
          context.fill();
        } else {
          context.fillStyle = layer.color;
          context.font = `${62 * layer.scale}px "DM Sans"`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(layer.text ?? "✦", 0, 0);
        }
        context.restore();
      }
      context.restore();
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [scene]);

  const selectedLayer = useMemo(
    () => scene.layers.find((layer) => layer.id === selectedId) ?? null,
    [scene.layers, selectedId],
  );
  const matchingPresets = useMemo(() => {
    const found = presets.filter((preset) => preset.category.includes(activeCategory as (typeof categories)[number]));
    if (found.length) return found;
    const fallbackId = fallbackCategoryPreset[activeCategory];
    return fallbackId ? presets.filter((preset) => preset.id === fallbackId) : presets.slice(0, 3);
  }, [activeCategory]);

  const updateScene = useCallback((next: WallpaperScene) => {
    setHistory((current) => recordWallpaperChange(current, next));
  }, []);

  const updateLayer = useCallback(
    (id: string, patch: Partial<WallpaperLayer>) => {
      const next = {
        ...sceneRef.current,
        layers: sceneRef.current.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
      };
      updateScene(next);
    },
    [updateScene],
  );

  const changeBackground = useCallback(
    (background: WallpaperScene["background"]) => {
      updateScene({ ...sceneRef.current, background });
      setBackgroundMode(background.kind === "image" ? "photo" : "gradient");
      setSelectedId(null);
    },
    [updateScene],
  );

  const applyPreset = useCallback(
    (preset: WallpaperPreset) => {
      const colors: Record<WallpaperPreset["theme"], [string, string]> = {
        violet: ["#251044", "#10102f"],
        teal: ["#057f77", "#083f4b"],
        green: ["#34734a", "#112b33"],
        dawn: ["#7044a5", "#d76376"],
      };
      const [from, to] = colors[preset.theme];
      updateScene({
        ...sceneRef.current,
        background: { kind: "image", source: preset.source },
        layers: initialScene.layers.map((layer) => ({ ...layer })),
      });
      setBackgroundMode("photo");
      setSelectedId("quote");
      void from;
      void to;
    },
    [updateScene],
  );

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 4) {
      setError("Add a little more detail to your wallpaper idea first.");
      return;
    }
    setError("");
    setIsGenerating(true);
    setIsFinalImage(false);
    try {
      await streamImage(
        "/api/generate-image",
        { prompt: `${cleanPrompt}. Portrait smartphone wallpaper, vertical 2:3 composition.` },
        (source, isFinal) => {
          setIsFinalImage(isFinal);
          const next = { ...sceneRef.current, background: { kind: "image" as const, source } };
          if (isFinal) updateScene(next);
          else sceneRef.current = next;
        },
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Image generation failed. Please try again.");
      setIsFinalImage(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const loadPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to add it to your wallpaper.");
      return;
    }
    const source = URL.createObjectURL(file);
    const layer: WallpaperLayer = {
      id: `photo-${Date.now()}`,
      kind: "image",
      source,
      x: 500,
      y: 890,
      scale: 1,
      color: "#ffffff",
    };
    updateScene({ ...sceneRef.current, layers: [...sceneRef.current.layers, layer] });
    setSelectedId(layer.id);
    setError("");
  };

  const addLayer = (kind: "text" | "sticker" | "shape", shape?: "circle" | "star") => {
    const id = `${kind}-${Date.now()}`;
    const layer: WallpaperLayer = {
      id,
      kind,
      x: 500,
      y: 890 + scene.layers.length * 40,
      scale: 1,
      color: "#ffffff",
      ...(kind === "text" ? { text: "Your words, here", font: "Instrument Serif", fontSize: 88, align: "center" as const } : {}),
      ...(kind === "sticker" ? { text: "✦" } : {}),
      ...(kind === "shape" ? { shape: shape ?? "circle" } : {}),
    };
    updateScene({ ...sceneRef.current, layers: [...sceneRef.current.layers, layer] });
    setSelectedId(id);
  };

  const downloadWallpaper = async () => {
    setIsDownloading(true);
    try {
      const { width, height } = wallpaperSizes[exportSize];
      const image = document.createElement("canvas");
      image.width = width;
      image.height = height;
      const context = image.getContext("2d");
      if (!context) throw new Error("This browser could not prepare the wallpaper image.");

      if (scene.background.kind === "image") {
        let background = imageCache.current.get(scene.background.source);
        if (!background) {
          background = new Image();
          background.src = scene.background.source;
          imageCache.current.set(scene.background.source, background);
        }
        if (!background.complete) await new Promise<void>((resolve, reject) => {
          background.addEventListener("load", () => resolve(), { once: true });
          background.addEventListener("error", () => reject(new Error("This image could not be exported.")), { once: true });
        });
        const scale = Math.max(width / background.naturalWidth, height / background.naturalHeight);
        const cropWidth = width / scale;
        const cropHeight = height / scale;
        context.drawImage(
          background,
          (background.naturalWidth - cropWidth) / 2,
          (background.naturalHeight - cropHeight) / 2,
          cropWidth,
          cropHeight,
          0,
          0,
          width,
          height,
        );
      } else {
        const gradient = context.createLinearGradient(width * 0.1, height * 0.05, width, height);
        gradient.addColorStop(0, scene.background.from);
        gradient.addColorStop(1, scene.background.to);
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      }

      context.save();
      context.scale(width / 1000, height / 1778);
      for (const layer of scene.layers) {
        context.save();
        context.translate(layer.x, layer.y);
        context.scale(layer.scale, layer.scale);
        if (layer.kind === "text") {
          const fontSize = layer.fontSize ?? 48;
          context.font = `${fontSize}px "${layer.font ?? "DM Sans"}"`;
          context.fillStyle = layer.color;
          context.textAlign = layer.align ?? "center";
          context.textBaseline = "middle";
          const lines = (layer.text ?? "").split("\n");
          lines.forEach((line, index) => {
            context.fillText(line, 0, (index - (lines.length - 1) / 2) * fontSize * 1.18, 880);
          });
        } else if (layer.kind === "image" && layer.source) {
          let photo = imageCache.current.get(layer.source);
          if (!photo) {
            photo = new Image();
            photo.src = layer.source;
            imageCache.current.set(layer.source, photo);
          }
          if (!photo.complete) await new Promise<void>((resolve, reject) => {
            photo.addEventListener("load", () => resolve(), { once: true });
            photo.addEventListener("error", () => reject(new Error("The added photo could not be exported.")), { once: true });
          });
          context.drawImage(photo, -90, -90, 180, 180);
        } else if (layer.kind === "shape") {
          context.fillStyle = layer.color;
          context.beginPath();
          if (layer.shape === "star") {
            for (let point = 0; point < 10; point += 1) {
              const radius = point % 2 === 0 ? 48 : 24;
              const angle = (Math.PI * point) / 5 - Math.PI / 2;
              if (point === 0) context.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
              else context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            context.closePath();
          } else context.arc(0, 0, 38, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillStyle = layer.color;
          context.font = `62px "DM Sans"`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(layer.text ?? "✦", 0, 0);
        }
        context.restore();
      }
      context.restore();

      const blob = await new Promise<Blob>((resolve, reject) => {
        image.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("Your browser could not save this image. Try the HD size instead."));
        }, "image/png");
      });
      const file = new File([blob], `wallify-${exportSize}.png`, { type: "image/png" });
      if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Your WALLIFY wallpaper" });
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") return;
          throw shareError;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `wallify-${exportSize}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your wallpaper could not be saved.");
    } finally {
      setIsDownloading(false);
    }
  };

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 1000;
    const y = ((event.clientY - bounds.top) / bounds.height) * 1778;
    const topLayer = [...scene.layers].reverse().find((layer) => {
      const dimensions = imageElementBounds(layer);
      return Math.abs(layer.x - x) <= dimensions.width / 2 && Math.abs(layer.y - y) <= dimensions.height / 2;
    });
    if (!topLayer) {
      setSelectedId(null);
      return;
    }
    setSelectedId(topLayer.id);
    const dimensions = imageElementBounds(topLayer);
    const resize = x > topLayer.x + dimensions.width / 2 - 32 && y > topLayer.y + dimensions.height / 2 - 32;
    dragRef.current = { id: topLayer.id, pointerId: event.pointerId, x, y, resize };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 1000;
    const y = ((event.clientY - bounds.top) / bounds.height) * 1778;
    const current = dragRef.current;
    const layer = sceneRef.current.layers.find((candidate) => candidate.id === current.id);
    if (!layer) return;
    if (current.resize) {
      const dimensions = imageElementBounds(layer);
      const scale = Math.max(0.45, Math.min(3.2, layer.scale + ((x - current.x + y - current.y) / 700)));
      updateLayer(current.id, { scale });
      dragRef.current = { ...current, x, y };
    } else {
      updateLayer(current.id, { x: Math.max(42, Math.min(958, layer.x + x - current.x)), y: Math.max(58, Math.min(1720, layer.y + y - current.y)) });
      dragRef.current = { ...current, x, y };
    }
  };

  return (
    <main className="wallify-page">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="WALLIFY home">
          <span className="wordmark-mark">W</span><span>wallify</span><span className="wordmark-dot">.</span>
        </a>
        <nav className="topnav" aria-label="Main navigation">
          <a className="topnav-link active" href="#explore">Explore</a>
          <a className="topnav-link" href="#studio">Studio</a>
        </nav>
        <div className="topbar-end">
          <span className="free-note"><span className="free-dot" /> Free, always</span>
          <Button className="topbar-cta" onClick={() => document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" })}>
            <Sparkles /> Start creating <ArrowRight />
          </Button>
        </div>
      </header>

      <section className="intro-band" id="top">
        <div className="intro-main">
          <span className="overline"><span className="overline-mark">✳</span> A HOME FOR YOUR HOME SCREEN</span>
          <h1>Your screen.<br /><em>Your style.</em></h1>
          <p>Little moments of inspiration, made for the screen you look at most.</p>
          <a className="jump-link" href="#studio"><span className="jump-link-icon"><ArrowRight /></span> Make something yours</a>
        </div>
        <div className="intro-preview">
          <img src={astralImage} alt="An original WALLIFY starfield wallpaper" width={1024} height={1536} fetchPriority="high" />
          <div className="intro-preview-shade" />
          <span className="preview-orbit orbit-one" />
          <span className="preview-orbit orbit-two" />
          <div className="intro-preview-note"><span>01 / 04</span><span>A small universe<br /><i>to call your own</i></span></div>
          <span className="intro-preview-stamp">MADE FOR<br />YOUR SCREEN</span>
        </div>
        <div className="intro-edge-label">CREATE A LITTLE SPACE FOR YOU · WALLIFY STUDIO</div>
      </section>

      <section className="explore-section" id="explore">
        <div className="section-heading-row">
          <div><span className="eyebrow">A GOOD PLACE TO BEGIN</span><h2>Find your <em>feeling.</em></h2></div>
          <span className="section-aside">Made for you, whichever<br />way the day is going.</span>
        </div>
        <div className="category-list" role="group" aria-label="Wallpaper categories">
          {categories.map((category, index) => (
            <Button
              key={category}
              type="button"
              variant="ghost"
              className={`category-chip ${activeCategory === category ? "selected" : ""}`}
              onClick={() => setActiveCategory(category)}
            >
              <span className="category-symbol">{["✳", "✦", "◒", "⌁", "✧", "▧", "❋", "☾", "◈", "“", "◌"][index]}</span>{category}
            </Button>
          ))}
          <span className="category-trailing">A feeling for every home screen <ArrowRight /></span>
        </div>
        <div className="gallery-grid" aria-live="polite">
          {matchingPresets.map((preset, index) => (
            <button
              type="button"
              key={`${activeCategory}-${preset.id}`}
              className={`gallery-card gallery-card-${index + 1}`}
              onClick={() => applyPreset(preset)}
              aria-label={`Edit ${preset.title} wallpaper`}
            >
              <span className={`gallery-art ${preset.theme}`}>
                <img src={preset.source} alt="" loading="lazy" width={1024} height={1536} />
                <span className="gallery-art-wash" />
                <span className="gallery-card-copy"><i>{preset.author}</i><strong>{preset.title}</strong></span>
                <span className="gallery-card-count">0{index + 1}</span>
              </span>
              <span className="gallery-card-info"><span>{preset.title}</span><span>{preset.badge ?? "Made for mobile"}<ArrowRight /></span></span>
            </button>
          ))}
          <button type="button" className="make-card" onClick={() => document.getElementById("prompt-input")?.focus()}>
            <span className="make-card-spark">✳</span><span className="make-card-note">OR START WITH AN IDEA</span><strong>Make it<br /><em>your own.</em></strong>
            <span className="make-card-bottom"><Sparkles /> Go to the studio <ArrowRight /></span>
          </button>
        </div>
      </section>

      <section className="studio-section" id="studio">
        <div className="studio-head"><div><span className="eyebrow">YOUR LITTLE CREATIVE SPACE</span><h2>Make it <em>yours.</em></h2></div><span className="studio-head-aside">No sign-up. No limits.<br />Just a canvas and an idea.</span></div>
        <div className="studio-shell">
          <aside className="editor-panel" aria-label="Wallpaper editor">
            <div className="editor-panel-head"><div><span className="editor-overline">WALLIFY STUDIO <span className="live-indicator" /></span><h3>Your canvas</h3></div><div className="history-actions"><Button variant="ghost" size="icon" title="Undo" aria-label="Undo" disabled={!history.past.length} onClick={() => setHistory(undoWallpaperChange)}><Undo2 /></Button><Button variant="ghost" size="icon" title="Redo" aria-label="Redo" disabled={!history.future.length} onClick={() => setHistory(redoWallpaperChange)}><Redo2 /></Button></div></div>

            <div className="generator-box"><span className="generator-icon"><Sparkles /></span><div className="generator-heading"><strong>Imagine it. Make it.</strong><span>Turn a thought into a wallpaper.</span></div><Textarea id="prompt-input" aria-label="Describe your wallpaper idea" className="prompt-field" placeholder="A quiet moon above a sea of clouds…" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} maxLength={1500} />
              <div className="generator-footer"><span>{prompt.length} / 1500</span><Button onClick={() => void handleGenerate()} disabled={isGenerating || prompt.trim().length < 4} className="generate-button">{isGenerating ? <RefreshCw className="spinning" /> : <Sparkles />}{isGenerating ? "Making yours…" : "Generate"}</Button></div>
              {error && <p className="inline-error" role="alert">{error}</p>}
            </div>

            <div className="tool-section"><div className="tool-heading"><span>01</span><strong>BACKGROUND</strong></div><div className="mode-tabs" role="tablist" aria-label="Background type"><Button type="button" role="tab" aria-selected={backgroundMode === "photo"} variant="ghost" className={backgroundMode === "photo" ? "mode-tab selected" : "mode-tab"} onClick={() => { setBackgroundMode("photo"); if (scene.background.kind !== "image") changeBackground({ kind: "image", source: astralImage }); }}><ImagePlus /> Photos</Button><Button type="button" role="tab" aria-selected={backgroundMode === "gradient"} variant="ghost" className={backgroundMode === "gradient" ? "mode-tab selected" : "mode-tab"} onClick={() => { setBackgroundMode("gradient"); if (scene.background.kind !== "gradient") changeBackground({ kind: "gradient", from: "#312755", to: "#102f47" }); }}><Palette /> Gradient</Button></div>
              {backgroundMode === "photo" ? <div className="background-swatches" aria-label="Choose a wallpaper background">{presets.slice(0, 3).map((preset) => <Button key={preset.id} variant="ghost" type="button" aria-label={`Set ${preset.title} background`} className={`photo-swatch ${(scene.background.kind === "image" && scene.background.source === preset.source) ? "swatch-selected" : ""}`} onClick={() => changeBackground({ kind: "image", source: preset.source })}><img src={preset.source} alt="" loading="lazy" width={1024} height={1536} /></Button>)}<Button variant="ghost" type="button" aria-label="Upload background photo" className="upload-swatch" onClick={() => fileInputRef.current?.click()}><Upload /></Button><input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" aria-label="Upload a photo from your device" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) { if (!file.type.startsWith("image/")) { setError("Choose an image file to add it to your wallpaper."); return; } const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === "string") changeBackground({ kind: "image", source: reader.result }); }; reader.readAsDataURL(file); } event.currentTarget.value = ""; }} /></div>
                : <div className="color-controls"><label className="color-control">START<input aria-label="Gradient start color" type="color" value={scene.background.kind === "gradient" ? scene.background.from : "#312755"} onChange={(event) => changeBackground({ kind: "gradient", from: event.target.value, to: scene.background.kind === "gradient" ? scene.background.to : "#102f47" })} /></label><span className="gradient-arrow">↗</span><label className="color-control">END<input aria-label="Gradient end color" type="color" value={scene.background.kind === "gradient" ? scene.background.to : "#102f47"} onChange={(event) => changeBackground({ kind: "gradient", from: scene.background.kind === "gradient" ? scene.background.from : "#312755", to: event.target.value })} /></label></div>}
            </div>

            <div className="tool-section"><div className="tool-heading"><span>02</span><strong>ADD TO YOUR WALLPAPER</strong></div><div className="insert-tools"><Button variant="ghost" onClick={() => addLayer("text")}><Type /><span>Text</span><Plus /></Button><Button variant="ghost" onClick={() => addLayer("sticker")}><Sticker /><span>Sticker</span><Plus /></Button><Button variant="ghost" onClick={() => addLayer("shape", "star")}><span className="shape-icon">✳</span><span>Shape</span><Plus /></Button><Button variant="ghost" onClick={() => fileInputRef.current?.click()}><Upload /><span>Upload</span><Plus /></Button></div></div>

            {selectedLayer && <div className="tool-section selected-layer-panel"><div className="tool-heading"><span>03</span><strong>MAKE IT JUST RIGHT</strong><Button variant="ghost" size="icon" className="remove-layer" aria-label="Remove selected layer" onClick={() => { updateScene({ ...sceneRef.current, layers: sceneRef.current.layers.filter((layer) => layer.id !== selectedLayer.id) }); setSelectedId(null); }}><X /></Button></div>
              {selectedLayer.kind === "text" && <><label className="field-caption" htmlFor="layer-text">YOUR WORDS</label><Textarea id="layer-text" className="layer-text-field" value={selectedLayer.text ?? ""} onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value })} rows={2} /><div className="layer-setting-row"><label className="field-caption" htmlFor="font-select">TYPEFACE</label><select id="font-select" className="select-control" value={selectedLayer.font ?? "DM Sans"} onChange={(event) => updateLayer(selectedLayer.id, { font: event.target.value })}><option>DM Sans</option><option>Instrument Serif</option><option>Georgia</option><option>monospace</option></select></div><div className="layer-setting-row font-size-row"><span className="field-caption">SIZE</span><Slider value={[selectedLayer.fontSize ?? 48]} min={22} max={150} step={1} onValueChange={([value]) => { if (value !== undefined) updateLayer(selectedLayer.id, { fontSize: value }); }} aria-label="Text size" /><span className="size-value">{selectedLayer.fontSize ?? 48}</span></div><div className="text-style-controls"><div className="alignment-buttons" aria-label="Text alignment">{([ ["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight] ] as const).map(([align, Icon]) => <Button key={align} type="button" variant="ghost" size="icon" aria-label={`Align ${align}`} aria-pressed={(selectedLayer.align ?? "center") === align} className={`align-button ${(selectedLayer.align ?? "center") === align ? "is-active" : ""}`} onClick={() => updateLayer(selectedLayer.id, { align })}><Icon /></Button>)}</div><label className="text-color-pick" title="Text color"><span className="field-caption">INK</span><input aria-label="Text color" type="color" value={selectedLayer.color} onChange={(event) => updateLayer(selectedLayer.id, { color: event.target.value })} /></label></div></>}
              {selectedLayer.kind !== "text" && <div className="layer-setting-row font-size-row"><span className="field-caption">SIZE</span><Slider value={[Math.round(selectedLayer.scale * 100)]} min={45} max={320} step={1} onValueChange={([value]) => { if (value !== undefined) updateLayer(selectedLayer.id, { scale: value / 100 }); }} aria-label="Sticker or shape size" /><span className="size-value">{Math.round(selectedLayer.scale * 100)}%</span></div>}
              <p className="drag-hint"><Crop /> Drag to move · pull the corner to resize</p>
            </div>}
            {!selectedLayer && <div className="empty-layer-note"><Layers2 /><span>Choose something on the preview, or add a new layer.</span></div>}
            <div className="editor-panel-bottom"><span><span className="live-indicator" /> SAVED IN THIS SESSION</span><span>{scene.layers.length} {scene.layers.length === 1 ? "layer" : "layers"}</span></div>
          </aside>

          <div className="preview-panel"><div className="preview-panel-head"><span><span className="preview-live-dot" /> LIVE PREVIEW</span><span className="preview-phone-name">iPhone · Portrait <ChevronDown /></span></div>
            <div className="phone-stage"><span className="stage-caption stage-caption-top">YOUR NEXT HOME SCREEN</span><div className="phone-device"><div className="phone-screen"><canvas ref={canvasRef} width={540} height={960} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} aria-label="Live wallpaper preview. Select and drag items to move, drag a selected item's lower-right corner to resize." className={`wallpaper-canvas ${!isFinalImage ? "render-blur" : ""}`} />{activeMode === "lock" && <div className="phone-overlay lock-screen-overlay" aria-hidden="true"><span className="lock-date"><span>MONDAY, OCTOBER 21</span></span><span className="lock-time">09<span>:</span>41</span><span className="phone-widgets"><span>◒</span><span>•••  ☀  72°</span></span></div>}{activeMode === "home" && <div className="phone-overlay home-screen-overlay" aria-hidden="true"><div className="home-widgets"><span className="mini-clock">09:41</span><span>MON<br />21</span></div><div className="app-icon-grid">{["◉", "▣", "✳", "⌂", "●", "◌", "♫", "▧", "☾", "◈", "⊙", "✦"].map((icon, index) => <span className={`mini-app app-${index % 4}`} key={`${index}-${icon}`}>{icon}</span>)}</div><div className="dock-bar"><span>◉</span><span>◌</span><span>▣</span><span>♫</span></div></div>}<span className="phone-island" />{selectedId && <span className="selection-toast"><Check /> Editing {selectedLayer?.kind ?? "layer"}</span>}</div></div><span className="stage-caption stage-caption-bottom"><span></span> YOUR WALLPAPER, YOUR WAY</span><span className="stage-watermark">W / STUDIO</span></div>
            <div className="preview-controls"><div className="screen-tabs" role="group" aria-label="Phone screen preview"><Button type="button" variant="ghost" aria-pressed={activeMode === "lock"} className={`screen-tab ${activeMode === "lock" ? "active" : ""}`} onClick={() => setActiveMode("lock")}><Clock3 /> Lock screen</Button><Button type="button" variant="ghost" aria-pressed={activeMode === "home"} className={`screen-tab ${activeMode === "home" ? "active" : ""}`} onClick={() => setActiveMode("home")}><Layers2 /> Home screen</Button></div><div className="download-controls"><label htmlFor="export-size">SAVE AS</label><select id="export-size" className="export-select" value={exportSize} onChange={(event) => setExportSize(event.target.value as WallpaperSize)}><option value="hd">HD · 1080 × 1920</option><option value="4k">4K · 2160 × 3840</option></select><Button onClick={() => void downloadWallpaper()} disabled={isDownloading} className="download-button"><Download /> {isDownloading ? "Saving…" : "Save wallpaper"}</Button></div><p className="download-footnote"><Check /> Your image, saved in full-resolution PNG</p></div>
          </div>
        </div>
        <div className="studio-footer-note"><span>01 — SIMPLE THINGS, MADE BEAUTIFUL</span><span>A LITTLE MORE YOU <i>↗</i></span></div>
      </section>

      <footer className="site-footer"><a className="wordmark footer-wordmark" href="#top"><span className="wordmark-mark">W</span><span>wallify</span><span className="wordmark-dot">.</span></a><span>A small corner to make your screen feel like yours.</span><a href="#top">BACK TO THE TOP <ChevronLeft /></a></footer>
    </main>
  );
}