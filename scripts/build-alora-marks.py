#!/usr/bin/env python3
"""Draw the original ALORA window (6-frond palm) and write PNG assets.

Wordmark files are locked and are never rewritten here.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')

CHARCOAL = (44, 44, 44, 255)
CORAL = (224, 122, 95, 255)
CREAM = (244, 237, 228, 255)
TAN = (196, 168, 130, 255)
SCALE = 4  # render SVG viewBox 220x268 at 4x, then downscale


def S(n):
    return int(round(n * SCALE))


def cubic_points(p0, p1, p2, p3, steps=28):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        pts.append((S(x), S(y)))
    return pts


def quad_points(p0, p1, p2, steps=24):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
        y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
        pts.append((S(x), S(y)))
    return pts


def stroke_poly(d, pts, width, color):
    d.line(pts, fill=color, width=width, joint='curve')
    r = max(1, width // 2)
    d.ellipse((pts[0][0] - r, pts[0][1] - r, pts[0][0] + r, pts[0][1] + r), fill=color)
    d.ellipse((pts[-1][0] - r, pts[-1][1] - r, pts[-1][0] + r, pts[-1][1] + r), fill=color)


def arch_mask(size):
    """Interior of the original thin arch (SVG path M28 214 V96 A82 82 0 0 1 192 96 V214 Z)."""
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    # body
    d.rectangle((S(28), S(96), S(192), S(214)), fill=255)
    # semicircle cap: ellipse centered 110,96 r=82
    d.ellipse((S(28), S(14), S(192), S(178)), fill=255)
    return m


def build_window():
    W, H = S(220), S(268)
    scene = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scene)
    # cream fill + landscape, then clip to arch
    sd.rectangle((0, 0, W, H), fill=CREAM)
    sd.ellipse((S(148 - 24), S(78 - 24), S(148 + 24), S(78 + 24)), fill=CORAL)
    sd.polygon([(S(88), S(214)), (S(158), S(92)), (S(210), S(214))], fill=CHARCOAL)
    sd.polygon([(S(18), S(214)), (S(86), S(128)), (S(168), S(214))], fill=TAN)

    # trunk + 6 drooping fronds
    tw = max(3, S(3.4))
    fw = max(3, S(2.8))
    stroke_poly(sd, quad_points((58, 210), (64, 172), (70, 128)), tw, CHARCOAL)
    fronds = [
        ((70, 128), (54, 122), (42, 128), (36, 142)),
        ((70, 128), (52, 112), (40, 110), (34, 122)),
        ((70, 126), (60, 104), (50, 98), (44, 112)),
        ((70, 126), (80, 102), (92, 98), (100, 112)),
        ((70, 128), (86, 116), (100, 118), (110, 130)),
        ((70, 128), (84, 130), (96, 140), (102, 152)),
    ]
    for a, b, c, e in fronds:
        stroke_poly(sd, cubic_points(a, b, c, e), fw, CHARCOAL)

    mask = arch_mask((W, H))
    clipped = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    clipped.paste(scene, (0, 0), mask)

    d = ImageDraw.Draw(clipped)
    # thin arch stroke
    frame_w = max(4, S(5))
    # sides
    d.line([(S(28), S(96)), (S(28), S(214))], fill=CHARCOAL, width=frame_w)
    d.line([(S(192), S(96)), (S(192), S(214))], fill=CHARCOAL, width=frame_w)
    # top semicircle
    bbox = (S(28), S(14), S(192), S(178))
    d.arc(bbox, start=180, end=360, fill=CHARCOAL, width=frame_w)

    # thick sill
    d.rounded_rectangle((S(16), S(210), S(204), S(226)), radius=S(2), fill=CHARCOAL)

    # skeleton key (cream stroke on sill)
    kx, ky = 88, 212
    kw = max(2, S(2.2))
    d.ellipse((S(kx + 10 - 5.5), S(ky + 6 - 5.5), S(kx + 10 + 5.5), S(ky + 6 + 5.5)), outline=CREAM, width=kw)
    d.line([(S(kx + 15.5), S(ky + 6)), (S(kx + 36), S(ky + 6))], fill=CREAM, width=kw)
    d.line([(S(kx + 30), S(ky + 6)), (S(kx + 30), S(ky + 12))], fill=CREAM, width=kw)
    d.line([(S(kx + 35), S(ky + 6)), (S(kx + 35), S(ky + 10))], fill=CREAM, width=kw)
    return clipped


def trim_alpha(im, pad=6):
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def save_png(im, path, max_w=None):
    if max_w and im.width > max_w:
        h = max(1, int(round(im.height * max_w / im.width)))
        im = im.resize((max_w, h), Image.Resampling.LANCZOS)
    im.save(path, 'PNG', optimize=True)
    return im


def main():
    win = trim_alpha(build_window(), pad=S(2))
    save_png(win, os.path.join(ASSETS, 'alora-window.png'), max_w=256)
    wb, hb = win.size
    arch = win.crop((int(wb * 0.06), 0, int(wb * 0.94), int(hb * 0.78)))
    side = max(arch.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(arch, ((side - arch.size[0]) // 2, (side - arch.size[1]) // 2), arch)
    sq = sq.filter(ImageFilter.SMOOTH)
    save_png(sq.resize((64, 64), Image.Resampling.LANCZOS), os.path.join(ASSETS, 'alora-favicon.png'))
    save_png(sq.resize((180, 180), Image.Resampling.LANCZOS), os.path.join(ASSETS, 'alora-apple-touch.png'))
    print('wrote window', Image.open(os.path.join(ASSETS, 'alora-window.png')).size)


if __name__ == '__main__':
    main()
