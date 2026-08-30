#!/usr/bin/env python3
"""Rasterize the locked ALORA wordmark + window mascot (no huge cream margins)."""
import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter

CHARCOAL = (44, 44, 44, 255)
CORAL = (224, 122, 95, 255)
SAND_DEEP = (232, 220, 206, 255)
MOUNTAIN = (90, 86, 80, 255)
MOUNTAIN2 = (122, 114, 104, 255)
SKY_TOP = (255, 236, 220, 255)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets')
FONT = '/usr/share/fonts/truetype/noto/NotoSansDisplay-Bold.ttf'


def trim_alpha(im, pad=8):
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def save_scaled(im, path, max_w=None, max_h=None):
    w, h = im.size
    if max_w and w > max_w:
        h = max(1, int(h * max_w / w))
        w = max_w
    if max_h and h > max_h:
        w = max(1, int(w * max_h / h))
        h = max_h
    out = im.resize((w, h), Image.Resampling.LANCZOS)
    out.save(path, 'PNG', optimize=True)
    return out


def build_wordmark():
    font = ImageFont.truetype(FONT, 180)
    W, H = 1600, 340
    base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    letters = list('ALORA')
    x = 40
    a_box = None
    for i, ch in enumerate(letters):
        bbox = d.textbbox((x, 70), ch, font=font)
        d.text((x, 70), ch, font=font, fill=CHARCOAL)
        if i == 0:
            a_box = bbox
        x = bbox[2] + 22

    ax0, ay0, ax1, ay1 = a_box
    cx = (ax0 + ax1) // 2
    bar_y = ay0 + int((ay1 - ay0) * 0.62)
    r = 20
    sun = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sun).ellipse((cx - r, bar_y - 2 * r + 6, cx + r, bar_y + 6), fill=CORAL)
    clip = Image.new('L', (W, H), 0)
    ImageDraw.Draw(clip).rectangle((0, 0, W, bar_y + 2), fill=255)
    sun.putalpha(ImageChops.multiply(sun.split()[3], clip))
    base.alpha_composite(sun)
    return trim_alpha(base, pad=10)


def build_window():
    S = 512
    scene = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scene)
    for y in range(S):
        t = y / S
        col = (
            int(SKY_TOP[0] * (1 - t) + SAND_DEEP[0] * t),
            int(SKY_TOP[1] * (1 - t) + SAND_DEEP[1] * t),
            int(SKY_TOP[2] * (1 - t) + SAND_DEEP[2] * t),
            255,
        )
        sd.line([(0, y), (S, y)], fill=col)
    sd.ellipse((208, 112, 312, 216), fill=CORAL)
    sd.polygon([(36, 348), (188, 196), (336, 356)], fill=MOUNTAIN2)
    sd.polygon([(196, 364), (358, 184), (508, 376)], fill=MOUNTAIN)

    cx, cy = 126, 246
    sd.polygon([(116, 396), (136, 396), (130, 252), (122, 252)], fill=CHARCOAL)
    for ang, length in ((-75, 72), (-42, 88), (-8, 80), (22, 70), (52, 56), (-100, 52)):
        rad = math.radians(ang)
        x2 = cx + int(math.cos(rad) * length)
        y2 = cy + int(math.sin(rad) * length)
        ox = int(math.sin(rad) * 5)
        oy = int(-math.cos(rad) * 5)
        sd.polygon(
            [(cx - ox, cy - oy), (cx + ox, cy + oy), (x2 + ox // 2, y2 + oy // 2), (x2 - ox // 2, y2 - oy // 2)],
            fill=CHARCOAL,
        )

    mask = Image.new('L', (S, S), 0)
    md = ImageDraw.Draw(mask)
    md.rectangle((72, 200, S - 72, S - 80), fill=255)
    md.ellipse((72, 64, S - 72, 336), fill=255)

    clipped = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    clipped.paste(scene, (0, 0), mask)

    outer = Image.new('L', (S, S), 0)
    ImageDraw.Draw(outer).rectangle((54, 186, S - 54, S - 64), fill=255)
    ImageDraw.Draw(outer).ellipse((54, 46, S - 54, 354), fill=255)
    inner = Image.new('L', (S, S), 0)
    ImageDraw.Draw(inner).rectangle((78, 204, S - 78, S - 86), fill=255)
    ImageDraw.Draw(inner).ellipse((78, 70, S - 78, 330), fill=255)
    frame_m = ImageChops.subtract(outer, inner)
    clipped.paste(CHARCOAL, (0, 0), frame_m)

    d = ImageDraw.Draw(clipped)
    d.rectangle((S // 2 - 4, 80, S // 2 + 4, S - 90), fill=(44, 44, 44, 160))
    d.rectangle((84, 246, S - 84, 254), fill=(44, 44, 44, 160))
    d.rounded_rectangle((46, S - 94, S - 46, S - 58), radius=8, fill=CHARCOAL)
    d.rounded_rectangle((38, S - 70, S - 38, S - 46), radius=6, fill=(58, 56, 52, 255))

    kx, ky = 248, S - 80
    d.ellipse((kx, ky - 11, kx + 24, ky + 13), outline=CORAL, width=4)
    d.rectangle((kx + 21, ky - 2, kx + 56, ky + 4), fill=CHARCOAL)
    d.rectangle((kx + 42, ky + 2, kx + 47, ky + 14), fill=CHARCOAL)
    d.rectangle((kx + 50, ky + 2, kx + 54, ky + 11), fill=CHARCOAL)

    return trim_alpha(clipped, pad=4)


def main():
    os.makedirs(OUT, exist_ok=True)
    word = build_wordmark()
    save_scaled(word, os.path.join(OUT, 'alora-wordmark.png'), max_w=720)
    win = build_window()
    save_scaled(win, os.path.join(OUT, 'alora-window.png'), max_w=256)
    wb, hb = win.size
    arch = win.crop((int(wb * 0.10), int(hb * 0.00), int(wb * 0.90), int(hb * 0.72)))
    side = max(arch.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(arch, ((side - arch.size[0]) // 2, (side - arch.size[1]) // 2), arch)
    sq.filter(ImageFilter.SMOOTH)
    sq.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(OUT, 'alora-favicon.png'), 'PNG', optimize=True)
    sq.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(OUT, 'alora-apple-touch.png'), 'PNG', optimize=True)
    print('wrote', os.listdir(OUT), 'word', word.size, 'window', win.size)


if __name__ == '__main__':
    main()
