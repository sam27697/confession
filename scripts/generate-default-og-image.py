#!/usr/bin/env python3
"""Generate public/og/default.png — the static, generic Open Graph card
(week-6 share-card spec §4.1).

Not run at build time or at runtime; it is a one-off/dev-time generator, run
by hand when the brand image needs to change, and its output (the PNG) is
what actually ships. Python + Pillow are not app dependencies and are not
part of the Docker image.

WHY THIS IS PYTHON AND NOT next/og's ImageResponse (satori):
satori (the engine behind next/og, used for the per-link card attempt in
this same slice) shapes Arabic letters correctly but does not run the
bidi (bidirectional text) algorithm — mixed-direction and even pure-RTL
multi-word text comes out in the wrong visual order. See
docs/SPEC-week6-share-card.md §4.3 for the measured evidence. Pillow, built
with libraqm (HarfBuzz + FriBidi + FreeType), does real bidi + shaping, so
it is used here instead. This is the "acceptable, tractable" fix for a
FIXED string described in §4.3 — it is not a fix for the per-link route,
which still falls back to this same static image (§4.2).

Requires: Pillow built with raqm support (`python3 -c "from PIL import
features; print(features.check('raqm'))"` must print True).
"""

import os

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (15, 23, 42)  # #0f172a
TITLE_COLOR = (255, 255, 255)
SUB_COLOR = (148, 163, 184)  # #94a3b8

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(HERE, "fonts", "Tajawal-Bold.ttf")
OUT_PATH = os.path.join(HERE, "..", "public", "og", "default.png")

TITLE = "مصارحة"
SUBTITLE = "خلي الناس تصارحك بصراحة، وهي متخفية"


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    title_font = ImageFont.truetype(FONT_PATH, 120, layout_engine=ImageFont.Layout.RAQM)
    sub_font = ImageFont.truetype(FONT_PATH, 40, layout_engine=ImageFont.Layout.RAQM)

    def measure(text, font):
        return draw.textbbox((0, 0), text, font=font, direction="rtl")

    def centered(text, font, y, color):
        bbox = measure(text, font)
        w = bbox[2] - bbox[0]
        x = (W - w) / 2 - bbox[0]
        draw.text((x, y), text, font=font, fill=color, direction="rtl")

    title_bbox = measure(TITLE, title_font)
    title_h = title_bbox[3] - title_bbox[1]
    sub_bbox = measure(SUBTITLE, sub_font)
    sub_h = sub_bbox[3] - sub_bbox[1]

    gap = 32
    total_h = title_h + gap + sub_h
    start_y = (H - total_h) / 2

    centered(TITLE, title_font, start_y - title_bbox[1], TITLE_COLOR)
    centered(SUBTITLE, sub_font, start_y + title_h + gap - sub_bbox[1], SUB_COLOR)

    img.save(OUT_PATH)
    print(f"wrote {OUT_PATH} {img.size}")


if __name__ == "__main__":
    main()
