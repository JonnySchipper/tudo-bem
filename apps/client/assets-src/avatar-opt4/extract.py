#!/usr/bin/env python3
"""Slice the option-4 concept sheets into transparent, foot-aligned PNG frames.

The sheets are JPEG paintings on a flat cream field. White shirt stripes are
almost the same color as that field, so a plain chroma key punches them out.
This keeps a pixel when it is clearly not cream, and also when it sits in a
short vertical gap between two such pixels (the stripes, the eye whites).

Needs opencv-python and numpy. Not part of the game build.

    python3 assets-src/avatar-opt4/extract.py
"""
from __future__ import annotations

import cv2
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SRC = Path(__file__).resolve().parent
OUT = SRC / "frames"

# Sampled from the sheet corners.
BG = np.array([254.0, 240.0, 211.0], np.float32)
# On-screen character height. Every facing is scaled to this so front/side/back match.
TARGET_H = 168
CANVAS_W = 112
CANVAS_H = 184
FOOT_Y = 178  # sole line inside the canvas

# (file, row frame counts, names per row)
SHEETS = [
    ("idle-front.jpg", [4], ["idle-down"]),
    ("walk-front.jpg", [6], ["walk-down"]),
    ("idle-walk-side.jpg", [4, 6], ["idle-right", "walk-right"]),
    ("idle-walk-back.jpg", [4, 6], ["idle-up", "walk-up"]),
]


def bands(proj: np.ndarray, min_len: int, max_gap: int) -> list[list[int]]:
    on = proj > 8
    spans: list[list[int]] = []
    i = 0
    n = len(on)
    while i < n:
        if not on[i]:
            i += 1
            continue
        j = i
        while j < n and on[j]:
            j += 1
        if j - i >= min_len:
            spans.append([i, j])
        i = j
    merged: list[list[int]] = []
    for s in spans:
        if merged and s[0] - merged[-1][1] <= max_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return merged


def key_alpha(rgb: np.ndarray, thresh: float = 26, max_gap: int = 30) -> np.ndarray:
    dist = np.linalg.norm(rgb.astype(np.float32) - BG, axis=2)
    solid = dist > thresh
    fill = np.zeros_like(solid)
    h, w = solid.shape
    for x in range(w):
        idx = np.flatnonzero(solid[:, x])
        if len(idx) < 2:
            continue
        for a, b in zip(idx[:-1], idx[1:]):
            gap = int(b - a - 1)
            if 0 < gap <= max_gap:
                fill[a + 1 : b, x] = True
    mask = solid | fill
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    if n <= 1:
        return np.zeros((h, w), np.uint8)
    keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    mask = labels == keep
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel).astype(bool)
    alpha = np.where(mask, 255, 0).astype(np.uint8)
    # Peel a cream-colored outer fringe left by JPEG.
    for _ in range(2):
        eroded = cv2.erode(alpha, kernel)
        boundary = (alpha > 0) & (eroded == 0)
        alpha[boundary & (dist < 16)] = 0
    return alpha


def content_cells(rgb: np.ndarray, row_counts: list[int]) -> list[list[tuple[np.ndarray, np.ndarray]]]:
    dist = np.linalg.norm(rgb.astype(np.float32) - BG, axis=2)
    solid = dist > 26
    row_spans = bands(solid.sum(axis=1), min_len=80, max_gap=18)
    if len(row_spans) != len(row_counts):
        raise SystemExit(f"expected {len(row_counts)} rows, found {row_spans}")
    rows: list[list[tuple[np.ndarray, np.ndarray]]] = []
    h, w = solid.shape
    for (y0, y1), expect in zip(row_spans, row_counts):
        col_spans = bands(solid[y0:y1].sum(axis=0), min_len=40, max_gap=16)
        col_spans = [c for c in col_spans if c[1] - c[0] >= 50]
        if len(col_spans) != expect:
            raise SystemExit(f"expected {expect} frames in a row, found {col_spans}")
        frames = []
        for x0, x1 in col_spans:
            pad = 8
            Y0, Y1 = max(0, y0 - pad), min(h, y1 + pad)
            X0, X1 = max(0, x0 - pad), min(w, x1 + pad)
            crop = rgb[Y0:Y1, X0:X1]
            alpha = key_alpha(crop)
            frames.append((crop, alpha))
        rows.append(frames)
    return rows


def place(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        raise SystemExit("empty frame")
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    ch = y1 - y0 + 1
    scale = TARGET_H / ch
    crop = rgb[y0 : y1 + 1, x0 : x1 + 1]
    ca = alpha[y0 : y1 + 1, x0 : x1 + 1]
    nw = max(1, int(round(crop.shape[1] * scale)))
    nh = max(1, int(round(crop.shape[0] * scale)))
    resized = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_AREA)
    ra = cv2.resize(ca, (nw, nh), interpolation=cv2.INTER_AREA)
    # Foot center: centroid of the lowest slice of the sprite, so the body
    # stays put while the arms swing.
    foot_band = ra[int(nh * 0.82) :, :]
    weight = foot_band.astype(np.float32)
    if weight.sum() < 1:
        weight = ra.astype(np.float32)
    cols = np.arange(nw, dtype=np.float32)
    foot_x = float((weight.sum(axis=0) * cols).sum() / weight.sum())
    canvas = np.zeros((CANVAS_H, CANVAS_W, 4), np.uint8)
    left = int(round(CANVAS_W / 2 - foot_x))
    top = int(round(FOOT_Y - nh))
    # Clip to the canvas.
    src_x0 = max(0, -left)
    src_y0 = max(0, -top)
    dst_x0 = max(0, left)
    dst_y0 = max(0, top)
    src_x1 = min(nw, CANVAS_W - left)
    src_y1 = min(nh, CANVAS_H - top)
    if src_x1 <= src_x0 or src_y1 <= src_y0:
        raise SystemExit("frame fell outside the canvas")
    rgba = np.dstack([resized, ra])
    canvas[dst_y0 : dst_y0 + (src_y1 - src_y0), dst_x0 : dst_x0 + (src_x1 - src_x0)] = rgba[src_y0:src_y1, src_x0:src_x1]
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in OUT.glob("*.png"):
        name.unlink()
    count = 0
    for filename, counts, names in SHEETS:
        path = SRC / filename
        bgr = cv2.imread(str(path))
        if bgr is None:
            raise SystemExit(f"missing {path}")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        rows = content_cells(rgb, counts)
        for frames, anim in zip(rows, names):
            for i, (crop, alpha) in enumerate(frames):
                canvas = place(crop, alpha)
                out = OUT / f"{anim}-{i}.png"
                bgra = cv2.cvtColor(canvas[:, :, :3], cv2.COLOR_RGB2BGRA)
                bgra[:, :, 3] = canvas[:, :, 3]
                cv2.imwrite(str(out), bgra)
                count += 1
                print(out.relative_to(ROOT))
    print(f"{count} frames")


if __name__ == "__main__":
    main()
