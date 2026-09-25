#!/usr/bin/env python3
"""Generate public/og/story/*.png, the link-preview cards a Facebook story is
built from (docs/SPEC-week16-clickable-story.md).

WHY THESE EXIST
A Facebook story that opens a link is made by sharing the link itself through
Facebook's own share page and picking "Your story" there. Facebook draws that
story from the page's Open Graph tags, so the og:image IS the story. The
generic public/og/default.png is a plain slate card; these are story cards in
the app's own palette, one per question the story sheet offers, plus one for
the "I got a confession" reaction story. The page picks one by ?q= (see
storyCardVariant in src/share-card.ts).

WHY PYTHON AND NOT next/og
Same reason as scripts/generate-default-og-image.py: satori shapes Arabic but
does not run the bidi algorithm, and Pillow built with libraqm does both. The
text on these cards is fixed (the questions are a constant list), so a one-off
generator is enough; nothing per-user is ever drawn into a public image.

SOURCE OF TRUTH
The questions are read out of the PROMPTS array in
app/_components/StoryCard.tsx, the list the story sheet shows, so the card a
person picks and the preview Facebook draws cannot disagree. A manifest of
what was drawn is written beside the images, and test/67 fails when it no
longer matches PROMPTS, which is the signal to run this again.

The colours are read from app/globals.css for the same reason the canvas in
StoryCard reads them from :root: a copied hex literal drifts.

Requires: Pillow with raqm (python3 -c "from PIL import features;
print(features.check('raqm'))" prints True). Run from anywhere:
  python3 scripts/generate-story-og-images.py
"""

import json
import os
import re

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
FONT_PATH = os.path.join(HERE, "fonts", "Tajawal-Bold.ttf")
STORY_CARD = os.path.join(ROOT, "app", "_components", "StoryCard.tsx")
GLOBALS_CSS = os.path.join(ROOT, "app", "globals.css")
OUT_DIR = os.path.join(ROOT, "public", "og", "story")

# Drawn at twice the size and scaled down: Pillow does not antialias shape
# edges, so supersampling is what keeps the pill and the mark smooth.
SCALE = 2
W, H = 1200, 630

REACTION_LABEL = "وصلني اعتراف بالسر"
REACTION_TEXT = "صارحني إنت كمان، وبدون ما اعرف مين إنت"
PROMPT_LABEL = "سؤال الستوري"
CTA = "اضغط وصارحني بالسر"
BRAND = "مصارحة"


def read_prompts():
    src = open(STORY_CARD, encoding="utf-8").read()
    m = re.search(r"const\s+PROMPTS\s*=\s*\[([\s\S]*?)\]", src)
    if not m:
        raise SystemExit("PROMPTS not found in StoryCard.tsx")
    return re.findall(r"'([^']+)'", m.group(1))


def read_tokens():
    css = open(GLOBALS_CSS, encoding="utf-8").read()
    marker = css.index("/* tokens/base.css")
    tokens = {}
    for name, value in re.findall(r"(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\b", css[:marker]):
        tokens.setdefault(name, value)
    return tokens


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def font(size):
    return ImageFont.truetype(FONT_PATH, size * SCALE, layout_engine=ImageFont.Layout.RAQM)


def wrap(draw, text, fnt, max_width):
    words = text.split(" ")
    lines, line = [], ""
    for word in words:
        candidate = f"{line} {word}" if line else word
        width = draw.textlength(candidate, font=fnt, direction="rtl")
        if width > max_width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def centred(draw, text, fnt, y, fill):
    box = draw.textbbox((0, 0), text, font=fnt, direction="rtl")
    x = (W * SCALE - (box[2] - box[0])) / 2 - box[0]
    draw.text((x, y - box[1]), text, font=fnt, fill=fill, direction="rtl")
    return box[3] - box[1]


def falloff(w, h, cx, cy, rx, ry, strength):
    """An 'L' mask on a 1/10 grid: strength*255 at (cx, cy), easing to 0 at
    the ellipse (rx, ry), all as fractions of the card; 0 beyond it."""
    gw, gh = w // 10, h // 10
    data = []
    for y in range(gh):
        for x in range(gw):
            dx = (x / (gw - 1) - cx) / rx
            dy = (y / (gh - 1) - cy) / ry
            d = min(1.0, (dx * dx + dy * dy) ** 0.5)
            ease = (1 - d) ** 2
            data.append(int(255 * strength * ease))
    mask = Image.new("L", (gw, gh))
    mask.putdata(data)
    return mask


def card(label, body, t):
    s = SCALE
    ground = hex_rgb(t["--ground"])
    surface = hex_rgb(t["--surface-2"])
    citron = hex_rgb(t["--citron-500"])
    on_accent = hex_rgb(t["--text-on-accent"])
    text1 = hex_rgb(t["--text-1"])

    img = Image.new("RGB", (W * s, H * s), ground)

    # A lifted centre, the way .veil lifts a screen off the ground, and a
    # citron glow falling from the top edge, as on the story canvas. Both
    # masks are computed explicitly on a small grid and scaled up with a
    # smooth filter: Pillow's own radial_gradient is a fixed 256px square
    # whose edges do not reach a clean 255, and pasting it left a hard seam.
    lift = falloff(W, H, cx=0.5, cy=0.5, rx=0.75, ry=0.9, strength=1.0)
    img = Image.composite(Image.new("RGB", img.size, surface), img, lift.resize(img.size, Image.BICUBIC))
    glow = falloff(W, H, cx=0.5, cy=0.0, rx=0.6, ry=0.75, strength=0.16)
    img = Image.composite(Image.new("RGB", img.size, citron), img, glow.resize(img.size, Image.BICUBIC))

    draw = ImageDraw.Draw(img)

    # The brand mark, top-leading (top-right in RTL), and the word beside it.
    mark = 76 * s
    mx, my = W * s - 64 * s - mark, 46 * s
    draw.rounded_rectangle((mx, my, mx + mark, my + mark), radius=22 * s, fill=citron)
    m_font = font(46)
    box = draw.textbbox((0, 0), "م", font=m_font, direction="rtl")
    draw.text(
        (mx + (mark - (box[2] - box[0])) / 2 - box[0], my + (mark - (box[3] - box[1])) / 2 - box[1]),
        "م",
        font=m_font,
        fill=on_accent,
        direction="rtl",
    )
    b_font = font(40)
    box = draw.textbbox((0, 0), BRAND, font=b_font, direction="rtl")
    draw.text(
        (mx - 22 * s - (box[2] - box[0]) - box[0], my + (mark - (box[3] - box[1])) / 2 - box[1]),
        BRAND,
        font=b_font,
        fill=text1,
        direction="rtl",
    )

    # Label, the question, and the call to action, centred as one block.
    l_font = font(34)
    q_font = font(60)
    q_lines = wrap(draw, body, q_font, (W - 160) * s)[:3]
    line_h = 84 * s
    block_h = 34 * s + 36 * s + line_h * len(q_lines)
    y = (H * s - block_h) / 2 + 26 * s

    centred(draw, label, l_font, y, citron)
    y += 34 * s + 36 * s
    for line in q_lines:
        centred(draw, line, q_font, y, text1)
        y += line_h

    c_font = font(34)
    box = draw.textbbox((0, 0), CTA, font=c_font, direction="rtl")
    pill_w = (box[2] - box[0]) + 96 * s
    pill_h = 74 * s
    px = (W * s - pill_w) / 2
    py = H * s - 56 * s - pill_h
    draw.rounded_rectangle((px, py, px + pill_w, py + pill_h), radius=pill_h // 2, fill=citron)
    draw.text(
        (px + (pill_w - (box[2] - box[0])) / 2 - box[0], py + (pill_h - (box[3] - box[1])) / 2 - box[1]),
        CTA,
        font=c_font,
        fill=on_accent,
        direction="rtl",
    )

    return img.resize((W, H), Image.LANCZOS)


def main():
    prompts = read_prompts()
    tokens = read_tokens()
    os.makedirs(OUT_DIR, exist_ok=True)

    manifest = {"source": "app/_components/StoryCard.tsx PROMPTS", "cards": {}}
    for i, prompt in enumerate(prompts):
        name = f"q{i}"
        card(PROMPT_LABEL, prompt, tokens).save(os.path.join(OUT_DIR, f"{name}.png"), optimize=True)
        manifest["cards"][name] = prompt
    card(REACTION_LABEL, REACTION_TEXT, tokens).save(os.path.join(OUT_DIR, "r.png"), optimize=True)
    manifest["cards"]["r"] = REACTION_TEXT

    with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"wrote {len(manifest['cards'])} cards to {os.path.relpath(OUT_DIR, ROOT)}")


if __name__ == "__main__":
    main()
