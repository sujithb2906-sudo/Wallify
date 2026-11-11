export type WallpaperSize = "hd" | "4k";

export const wallpaperSizes = {
  hd: { width: 1080, height: 1920, label: "1080 × 1920" },
  "4k": { width: 2160, height: 3840, label: "2160 × 3840" },
} as const;

export type WallpaperLayer = {
  id: string;
  kind: "text" | "sticker" | "shape" | "image";
  x: number;
  y: number;
  scale: number;
  color: string;
  text?: string;
  font?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
  source?: string;
  shape?: "circle" | "star";
};

export type WallpaperScene = {
  background: { kind: "image"; source: string } | { kind: "gradient"; from: string; to: string };
  layers: WallpaperLayer[];
};

export type HistoryState<T> = { past: T[]; present: T; future: T[] };

export function recordWallpaperChange<T>(
  state: HistoryState<T>,
  next: T,
  limit = 50,
): HistoryState<T> {
  return {
    past: [...state.past, state.present].slice(-limit),
    present: next,
    future: [],
  };
}

export function undoWallpaperChange<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  if (previous === undefined) return state;
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redoWallpaperChange<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  if (next === undefined) return state;
  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  };
}

export function imageElementBounds(layer: WallpaperLayer) {
  if (layer.kind === "text") {
    const lines = (layer.text ?? "").split("\n");
    const fontSize = layer.fontSize ?? 34;
    const width = Math.max(...lines.map((line) => line.length), 1) * fontSize * 0.64;
    return { width: width * layer.scale, height: lines.length * fontSize * 1.25 * layer.scale };
  }
  const side = (layer.kind === "image" ? 188 : layer.kind === "sticker" ? 62 : 84) * layer.scale;
  return { width: side, height: side };
}

export function wallpaperHitTest(
  layers: WallpaperLayer[],
  point: { x: number; y: number },
) {
  return [...layers].reverse().find((layer) => {
    const bounds = imageElementBounds(layer);
    return Math.abs(layer.x - point.x) <= bounds.width / 2 && Math.abs(layer.y - point.y) <= bounds.height / 2;
  }) ?? null;
}