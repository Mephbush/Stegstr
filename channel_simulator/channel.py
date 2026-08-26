"""
Channel simulator: replicates social-platform image processing (resize, JPEG re-encode,
strip metadata, sRGB) so steganography can be tested in an enclosed loop without
posting to WhatsApp/Telegram/Instagram/Facebook/Twitter.

Profiles: whatsapp, telegram, instagram, facebook, twitter.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from PIL import Image, ImageOps

ProfileName = Literal["whatsapp", "telegram", "instagram", "facebook", "twitter"]


@dataclass
class ChannelProfile:
    """Parameters for simulating a platform's image pipeline."""

    max_width: int
    jpeg_quality: int
    subsampling: int = 2  # 4:2:0 = 2 in Pillow
    resize_method: str = "LANCZOS"  # LANCZOS, BICUBIC, BILINEAR
    passes: int = 1  # Number of recompression passes (WhatsApp uses 2)


PROFILES: dict[ProfileName, ChannelProfile] = {
    "whatsapp": ChannelProfile(max_width=1600, jpeg_quality=55, passes=2),
    "telegram": ChannelProfile(max_width=1280, jpeg_quality=72, passes=1),
    "instagram": ChannelProfile(max_width=1080, jpeg_quality=72, passes=1),
    "facebook": ChannelProfile(max_width=2048, jpeg_quality=70, passes=1),
    "twitter": ChannelProfile(max_width=1200, jpeg_quality=85, passes=1),
}


def _resize_to_max_dim(img: Image.Image, max_width: int, method: str) -> Image.Image:
    w, h = img.size
    if w <= max_width:
        return img
    ratio = max_width / w
    new_w = max_width
    new_h = max(1, round(h * ratio))
    resample = getattr(Image.Resampling, method, Image.Resampling.LANCZOS)
    return img.resize((new_w, new_h), resample=resample)


def _encode_jpeg(img: Image.Image, quality: int, subsampling: int) -> bytes:
    buf = io.BytesIO()
    img.save(
        buf,
        format="JPEG",
        quality=quality,
        subsampling=subsampling,
        optimize=False,
    )
    return buf.getvalue()


def simulate(
    input_path: str | Path,
    profile_name: ProfileName,
    output_path: str | Path | None = None,
) -> bytes:
    """
    Run the channel simulator: load image, strip metadata, (optionally) convert to sRGB,
    resize to profile max dimension, re-encode as JPEG with profile quality and 4:2:0.

    Args:
        input_path: Path to input image (PNG or JPEG).
        profile_name: One of "whatsapp", "telegram", "instagram", "facebook", "twitter".
        output_path: If set, write JPEG here and also return bytes. If None, only return bytes.

    Returns:
        JPEG bytes (after resize + re-encode, with multi-pass if configured).
    """
    path = Path(input_path)
    if not path.exists():
        raise FileNotFoundError(f"Input image not found: {path}")

    profile = PROFILES.get(profile_name)
    if profile is None:
        raise ValueError(
            f"Unknown profile: {profile_name}. Use one of: {list(PROFILES.keys())}"
        )

    img = Image.open(path)
    img.load()

    # 1. Apply EXIF orientation then we won't re-embed EXIF (strip effect)
    img = ImageOps.exif_transpose(img)

    # 2. Convert to RGB if necessary (strip alpha, handle mode)
    if img.mode not in ("RGB", "L"):
        if img.mode == "RGBA":
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        else:
            img = img.convert("RGB")

    # 3. Resize to profile max dimension
    img = _resize_to_max_dim(img, profile.max_width, profile.resize_method)

    # 4. Encode as JPEG: quality, 4:2:0 subsampling (first pass)
    jpeg_bytes = _encode_jpeg(img, profile.jpeg_quality, profile.subsampling)

    # 5. Additional recompression passes (WhatsApp uses 2 passes)
    for _ in range(profile.passes - 1):
        img = Image.open(io.BytesIO(jpeg_bytes))
        img.load()
        jpeg_bytes = _encode_jpeg(img, profile.jpeg_quality, profile.subsampling)

    if output_path is not None:
        Path(output_path).write_bytes(jpeg_bytes)

    return jpeg_bytes
