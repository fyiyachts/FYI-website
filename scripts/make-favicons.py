"""Regenerate the favicons in public/ from the FYI logo.

Not part of the build — the generated files are committed. Run this only when
the logo artwork changes:

    pip install pillow && python scripts/make-favicons.py

Source artwork is the same logo the header renders (components/layout/FYILogo.tsx):
white line art on transparency, so every icon is composited onto the brand navy
(#0f2740, matching <meta name="theme-color">). A transparent favicon would
disappear into a white tab strip, and iOS flattens alpha to black regardless.

Two crops, because one mark cannot serve every size:

  - the "FYI" letters for tab-sized icons. The full crest has a hairline frame
    and a nine-ray wake; below about 32px both alias into grey mush, and the
    letters inside it end up two pixels tall.
  - the full crest for the 180px home-screen icon, which has the pixels for it.

After running, bump the ?v= on the icon links in index.html — browsers and
Google's index both cache favicons hard, and without a new URL the old one can
persist for weeks.
"""

from PIL import Image

# Reads the vendored mark rather than fetching it. The GCS URL this used to pull
# from now answers 403 (its Google Cloud project lost its billing account), so
# this script could no longer be re-run at all; public/brand/fyi-logo-2024.png is
# that same 900x367 source, verified to regenerate the committed favicons
# pixel-for-pixel, and the crop boxes below still index into it unchanged.
LOGO_PATH = "public/brand/fyi-logo-2024.png"
NAVY = (15, 39, 64, 255)

# Crop boxes into the 900x367 source, found by inspection.
# The glyphs only. Including the rule above them costs a third of the height at
# 16px and lands as a heavy grey bar over letters that then can't be read.
LETTERS_BOX = (46, 66, 206, 150)
CREST_BOX = (0, 42, 255, 317)      # frame + "FYI" + ship + wake


def tile(mark, size, pad):
    """Center `mark` on a navy square, rendered at 1024px and downsampled once."""
    mark = mark.crop(mark.getbbox())
    inner = 1024 * (1 - 2 * pad)
    scale = min(inner / mark.width, inner / mark.height)
    mark = mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (1024, 1024), NAVY)
    canvas.alpha_composite(mark, ((1024 - mark.width) // 2, (1024 - mark.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    source = Image.open(LOGO_PATH).convert("RGBA")
    letters = source.crop(LETTERS_BOX)
    crest = source.crop(CREST_BOX)

    # One .ico carrying 16/32/48 lets each browser pick its own tab size.
    tile(letters, 256, 0.08).save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    tile(letters, 96, 0.08).save("public/favicon-96.png")
    # iOS composites onto black if the icon has alpha, so flatten to RGB.
    tile(crest, 180, 0.06).convert("RGB").save("public/apple-touch-icon.png")
    print("wrote public/favicon.ico, public/favicon-96.png, public/apple-touch-icon.png")


if __name__ == "__main__":
    main()
