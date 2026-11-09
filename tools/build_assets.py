"""Build web-ready assets for Five Nights at Homka from the raw art.

Usage: python tools/build_assets.py <attachments_dir> <textures_dir> <textures2_dir> <vent_dir> <mell_dir>
Requires: pillow, numpy, opencv-python-headless, rembg (+ ffmpeg on PATH).
"""
import glob
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageOps

ATT, TEX1, TEX2, VENT, MELL = sys.argv[1:6]
OUT = os.path.join(os.path.dirname(__file__), "..", "fnah", "assets")
OUT = os.path.abspath(OUT)
for d in ["cams", "office", "ui", "chars", "fx", "menu", "door", "vent", "tablet", "box", "mell"]:
    os.makedirs(os.path.join(OUT, d), exist_ok=True)


def att(name):
    hits = glob.glob(os.path.join(ATT, "*", name))
    if not hits:
        raise FileNotFoundError(name)
    return hits[0]


def save_webp(im, rel, q=82):
    p = os.path.join(OUT, rel)
    im.save(p, "WEBP", quality=q, method=5)
    return p


def save_jpg(im, rel, q=82):
    p = os.path.join(OUT, rel)
    im.convert("RGB").save(p, "JPEG", quality=q, optimize=True, progressive=True)
    return p


def save_png(im, rel):
    im.save(os.path.join(OUT, rel), "PNG", optimize=True)


_session = None


def cutout(im):
    """Remove background with rembg, return RGBA cropped to content."""
    global _session
    from rembg import new_session, remove

    if _session is None:
        _session = new_session("u2net")
    res = remove(im.convert("RGB"), session=_session, post_process_mask=True)
    bbox = res.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox()
    return res.crop(bbox) if bbox else res


def fit_h(im, h):
    if im.height <= h:
        return im
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


# ---------- cameras (long 2500x1080) ----------
for n in range(1, 12):
    im = Image.open(os.path.join(TEX1, "длинные камеры", f"КАМ {n}.png")).convert("RGB")
    save_jpg(im, f"cams/cam{n}.jpg", 80)

# CAM 5: Zovyanchik is the hamster on top of the bakery display (dark wall behind -> clean inpaint)
cam5 = Image.open(os.path.join(TEX1, "длинные камеры", "КАМ 5.png")).convert("RGB")
box = (1520, 30, 1740, 220)
crop = cam5.crop(box)
zov = cutout(crop)
mask_full = Image.new("L", cam5.size, 0)
from rembg import remove as _rm  # noqa: E402

alpha = _rm(crop, session=_session, only_mask=True, post_process_mask=True)
alpha = alpha.point(lambda a: 255 if a > 40 else 0).filter(ImageFilter.MaxFilter(15))
mask_full.paste(alpha, box[:2])
arr = cv2.cvtColor(np.array(cam5), cv2.COLOR_RGB2BGR)
inp = cv2.inpaint(arr, np.array(mask_full), 9, cv2.INPAINT_TELEA)
save_jpg(Image.fromarray(cv2.cvtColor(inp, cv2.COLOR_BGR2RGB)), "cams/cam5_empty.jpg", 80)
save_webp(zov, "chars/zov.webp", 88)

# CAM 3: Lyudmila stands in the back window; build an "empty window" version
cam3 = Image.open(os.path.join(TEX1, "длинные камеры", "КАМ 3.png")).convert("RGB")
box3 = (1120, 0, 1420, 200)
c3 = cam3.crop(box3)
m3 = _rm(c3, session=_session, only_mask=True, post_process_mask=True)
m3 = m3.point(lambda a: 255 if a > 40 else 0).filter(ImageFilter.MaxFilter(21))
mf3 = Image.new("L", cam3.size, 0)
mf3.paste(m3, box3[:2])
a3 = cv2.cvtColor(np.array(cam3), cv2.COLOR_RGB2BGR)
i3 = cv2.inpaint(a3, np.array(mf3), 15, cv2.INPAINT_TELEA)
save_jpg(Image.fromarray(cv2.cvtColor(i3, cv2.COLOR_BGR2RGB)), "cams/cam3_empty.jpg", 80)

# ---------- office ----------
office = Image.open(att("вентиляция комната охранника.png")).convert("RGB")
save_jpg(office, "office/office.jpg", 85)
save_webp(Image.open(att("свет фнаф вент.png")).convert("RGB"), "vent/vent_light.webp", 90)
for i in range(1, 18):
    save_webp(Image.open(os.path.join(VENT, f"{i}.png")).convert("RGBA"), f"vent/shutter{i}.webp", 90)

# doors: right door frames, frame 10 is corrupt in the archive -> blend 9 and 11
dframes = {}
for i in range(1, 20):
    p = os.path.join(TEX2, "правая дверь", f"{i}.png")
    try:
        dframes[i] = Image.open(p).convert("RGBA")
        dframes[i].load()
    except Exception:
        dframes[i] = None
if dframes[10] is None:
    dframes[10] = Image.blend(dframes[9], dframes[11], 0.5)
for i, im in dframes.items():
    save_webp(im, f"door/r{i}.webp", 85)
    save_webp(ImageOps.mirror(im), f"door/l{i}.webp", 85)

# tablet + static
for i in range(1, 12):
    save_webp(Image.open(os.path.join(TEX2, "планшет анимация", f"{i}.png")).convert("RGBA"), f"tablet/t{i}.webp", 80)
for i in range(1, 10):
    save_webp(Image.open(os.path.join(TEX2, "помехи переход", f"{i}.png")).convert("RGBA"), f"fx/static{i}.webp", 70)

# HUD
for v in range(0, 101, 10):
    save_png(Image.open(att(f"{v}.png")).convert("RGBA"), f"ui/bat{v}.png")
for h in [12, 1, 2, 3, 4, 5, 6]:
    save_png(Image.open(os.path.join(TEX1, "время", f"{h}.png")).convert("RGBA"), f"ui/time{h}.png")
for i in range(1, 7):
    save_png(Image.open(os.path.join(TEX2, "расход энергии", f"{i}.png")).convert("RGBA"), f"ui/usage{i}.png")
for i in range(1, 10):
    save_png(Image.open(os.path.join(TEX2, "шкатулка", f"шк{i}.png")).convert("RGBA"), f"box/box{i}.png")
save_png(Image.open(att("камеры карта png.png")).convert("RGBA"), "ui/map.png")
for n in range(2, 12):
    save_png(Image.open(att(f"С{n}.png")).convert("RGBA"), f"ui/c{n}.png")
save_png(Image.open(att("С1.png")).convert("RGBA"), "ui/c1.png")

# menu
for i in range(1, 6):
    save_webp(Image.open(att(f"Homka menu {i}.png")).convert("RGBA"), f"menu/face{i}.webp", 85)
save_webp(Image.open(att("Five Nights at Homka text.png")).convert("RGBA"), "menu/title.webp", 90)
save_jpg(Image.open(att("gazeta homka.png")), "menu/gazeta.jpg", 82)

# ---------- characters ----------
def photo(name, h=1300):
    im = ImageOps.exif_transpose(Image.open(att(name))).convert("RGB")
    return fit_h(im, h)


homka = {
    "homka_walk": "IMG_20230804_234728_841.jpg",
    "homka_crawl": "IMG_20230804_234729_396.jpg",
    "homka_crouch": "IMG_20230804_234729_359.jpg",
    "homka_crawl2": "IMG_20230804_234729_687.jpg",
    "homka_door": "IMG_20230804_234730_000.jpg",
    "homka_scare": "IMG_20230804_234730_114.jpg",
    "homka_low": "IMG_20230804_234729_255.jpg",
}
for key, fn in homka.items():
    save_webp(fit_h(cutout(photo(fn)), 1100), f"chars/{key}.webp", 85)

lyud = cutout(photo("photo_2022-04-23_10-48-14.jpg"))
save_webp(fit_h(lyud, 1100), "chars/lyud_body.webp", 85)
lyf = cutout(photo("photo_2022-07-15_18-39-44.jpg"))
save_webp(lyf, "chars/lyud_face.webp", 88)

poster = Image.open(att("плакат хомка даня людмила.png")).convert("RGB")
bro = poster.crop((88, 50, 250, 457)).resize((162 * 3, 407 * 3), Image.LANCZOS)
save_webp(cutout(bro), "chars/brother.webp", 85)

# ---------- Mellstroy (green screen footage) ----------
def chroma(src, frames, rel_prefix, crop_y=(380, 1010)):
    for k, n in enumerate(frames):
        tmp = f"/tmp/_mf_{k}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1", tmp], check=True)
        im = np.array(Image.open(tmp).convert("RGB")).astype(np.int16)
        r, g, b = im[..., 0], im[..., 1], im[..., 2]
        green = (g - np.maximum(r, b))
        a = np.clip(255 - (green - 40) * 6, 0, 255).astype(np.uint8)
        # despill
        im[..., 1] = np.minimum(g, np.maximum(r, b) + 10)
        rgba = np.dstack([np.clip(im, 0, 255).astype(np.uint8), a])
        out = Image.fromarray(rgba, "RGBA").crop((0, crop_y[0], 720, crop_y[1]))
        out = out.crop(out.getchannel("A").point(lambda v: 255 if v > 60 else 0).getbbox())
        save_webp(out, f"{rel_prefix}{k}.webp", 85)


chroma(os.path.join(MELL, "v10.mp4"), list(range(120, 300, 8)), "mell/scare")
chroma(os.path.join(MELL, "v13.mp4"), [0, 60, 120], "mell/idle")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.8", "-t", "2.8", "-i", os.path.join(MELL, "v10.mp4"),
                "-vn", "-ac", "1", "-ar", "44100", "/tmp/_mell_voice.wav"], check=True)
print("assets ->", OUT)
