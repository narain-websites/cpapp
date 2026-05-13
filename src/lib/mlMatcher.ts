// MobileNet matcher with cosine similarity
// Lazy loads tfjs + mobilenet on first use, caches model in IndexedDB.

import type * as tf from "@tensorflow/tfjs";
import type * as mobilenetType from "@tensorflow-models/mobilenet";
import { getDb } from "./db";

let _tf: typeof tf | null = null;
let _mobilenetMod: typeof mobilenetType | null = null;
let _model: mobilenetType.MobileNet | null = null;
let _loadingPromise: Promise<void> | null = null;
const MODEL_URL = "indexeddb://mobilenet-v2";

async function ensureLoaded(): Promise<void> {
  if (_model) return;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = (async () => {
    _tf = await import("@tensorflow/tfjs");
    _mobilenetMod = await import("@tensorflow-models/mobilenet");
    await _tf.ready();
    // Try cached
    try {
      const models = await _tf.io.listModels();
      if (models[MODEL_URL]) {
        _model = await _mobilenetMod.load({
          version: 2,
          alpha: 1.0,
          modelUrl: MODEL_URL,
        } as any);
      }
    } catch { /* fall through */ }
    if (!_model) {
      _model = await _mobilenetMod.load({ version: 2, alpha: 1.0 });
      // Save to IndexedDB for offline reuse
      try {
        const anyModel = (_model as any).model;
        if (anyModel?.save) await anyModel.save(MODEL_URL);
      } catch { /* ignore save errors */ }
    }
  })();
  return _loadingPromise;
}

export async function preloadModel() {
  try { await ensureLoaded(); } catch (e) { console.warn("[ml] preload failed", e); }
}

function float32ToBase64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

async function imageElementFromBase64(b64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = b64;
  });
}

export async function computeEmbeddingFromImage(b64: string): Promise<Float32Array> {
  await ensureLoaded();
  if (!_tf || !_model) throw new Error("model not loaded");
  const img = await imageElementFromBase64(b64);
  return _tf.tidy(() => {
    const t = _tf!.browser.fromPixels(img).resizeBilinear([224, 224]);
    const emb = _model!.infer(t, true) as tf.Tensor;
    const data = emb.dataSync() as Float32Array;
    return new Float32Array(data); // copy out
  });
}

export async function computeEmbeddingFromCanvas(canvas: HTMLCanvasElement): Promise<Float32Array> {
  await ensureLoaded();
  if (!_tf || !_model) throw new Error("model not loaded");
  return _tf.tidy(() => {
    const t = _tf!.browser.fromPixels(canvas).resizeBilinear([224, 224]);
    const emb = _model!.infer(t, true) as tf.Tensor;
    const data = emb.dataSync() as Float32Array;
    return new Float32Array(data);
  });
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function indexProduct(productId: number, imageBase64: string) {
  if (!imageBase64) return;
  try {
    const emb = await computeEmbeddingFromImage(imageBase64);
    await getDb().productEmbeddings.put({
      productId,
      embeddingBase64: float32ToBase64(emb),
    });
  } catch (e) {
    console.warn("[ml] indexProduct failed", e);
  }
}

export async function reindexAll(onProgress?: (done: number, total: number) => void) {
  const db = getDb();
  const products = await db.products.toArray();
  let done = 0;
  for (const p of products) {
    if (p.id && p.imageBase64) await indexProduct(p.id, p.imageBase64);
    done++;
    onProgress?.(done, products.length);
  }
}

export interface Match {
  productId: number;
  similarity: number;
}

export async function matchEmbedding(query: Float32Array): Promise<Match[]> {
  const all = await getDb().productEmbeddings.toArray();
  const matches: Match[] = [];
  for (const e of all) {
    const v = base64ToFloat32(e.embeddingBase64);
    const sim = cosineSimilarity(query, v);
    if (sim >= 0.65) matches.push({ productId: e.productId, similarity: sim });
  }
  matches.sort((a, b) => b.similarity - a.similarity);
  return matches.slice(0, 5);
}

export function isModelReady() { return !!_model; }
