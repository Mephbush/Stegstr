#!/usr/bin/env python3
"""
QIM steganography CLI for Stegstr app integration.
Usage:
  encode: python qim_cli.py encode <cover_path> <output_path> <payload_base64> [platform]
  decode: python qim_cli.py decode <image_path>
  capacity: python qim_cli.py capacity <cover_path> [platform]
          (prints base64 payload or capacity to stdout, errors to stderr, exit 0 on success)
"""

from __future__ import annotations

import base64
import sys
import zlib
from pathlib import Path

# Ensure channel_simulator is on path
_SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPT_DIR))


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in ("encode", "decode", "capacity"):
        print("Usage: qim_cli.py encode <cover> <output> <payload_b64> [platform]", file=sys.stderr)
        print("       qim_cli.py decode <image_path>", file=sys.stderr)
        print("       qim_cli.py capacity <cover_path> [platform]", file=sys.stderr)
        return 1

    cmd = sys.argv[1]
    if cmd == "capacity":
        if len(sys.argv) not in (3, 4):
            print("Usage: qim_cli.py capacity <cover_path> [platform]", file=sys.stderr)
            return 1
        cover_path = Path(sys.argv[2])
        if not cover_path.exists():
            print(f"Cover not found: {cover_path}", file=sys.stderr)
            return 1
        try:
            from dct_variants import AC_INDICES, QIM_DEFAULT_WIDTH, QIM_PLATFORM_WIDTHS, QIM_REPEAT, QIM_RS_NSYM, _crop_qim_platform
            from PIL import Image
            platform = sys.argv[3] if len(sys.argv) == 4 else ""
            max_width = QIM_PLATFORM_WIDTHS.get(platform, QIM_DEFAULT_WIDTH)
            with Image.open(cover_path) as image:
                image = _crop_qim_platform(image.convert("RGB"), platform)
                width, height = image.size
            if max_width > 0 and width > max_width:
                height = max(1, round(height * max_width / width))
                width = max_width
            width = (width // 8) * 8
            height = (height // 8) * 8
            total_coeffs = (width // 8) * (height // 8) * len(AC_INDICES)
            available_bytes = (total_coeffs // QIM_REPEAT) // 8
            overhead = 2 + QIM_RS_NSYM + 7 + 4
            print(max(0, available_bytes - overhead))
            return 0
        except Exception as e:
            print(f"Capacity failed: {e}", file=sys.stderr)
            return 1

    try:
        from dct_variants import encode_dct_qim, decode_dct_qim
    except ImportError as e:
        print(f"QIM requires: pip install jpeglib reedsolo numpy", file=sys.stderr)
        print(f"Error: {e}", file=sys.stderr)
        return 1

    if cmd == "encode":
        if len(sys.argv) not in (5, 6):
            print("Usage: qim_cli.py encode <cover_path> <output_path> <payload_base64> [platform]", file=sys.stderr)
            return 1
        cover_path = Path(sys.argv[2])
        output_path = Path(sys.argv[3])
        payload_b64 = sys.argv[4]
        platform = sys.argv[5] if len(sys.argv) == 6 else ""
        if not cover_path.exists():
            print(f"Cover not found: {cover_path}", file=sys.stderr)
            return 1
        try:
            payload = base64.standard_b64decode(payload_b64)
        except Exception as e:
            print(f"Invalid base64 payload: {e}", file=sys.stderr)
            return 1
        try:
            stego_bytes = encode_dct_qim(cover_path, zlib.compress(payload), platform=platform)
        except Exception as e:
            print(f"Encode failed: {e}", file=sys.stderr)
            return 1
        output_path.write_bytes(stego_bytes)
        return 0

    if cmd == "decode":
        if len(sys.argv) != 3:
            print("Usage: qim_cli.py decode <image_path>", file=sys.stderr)
            return 1
        image_path = Path(sys.argv[2])
        print(f"[qim_cli] decode: {image_path} (exists={image_path.exists()})", file=sys.stderr)
        if not image_path.exists():
            print(f"Image not found: {image_path}", file=sys.stderr)
            return 1
        jpeg_bytes = image_path.read_bytes()
        print(f"[qim_cli] read {len(jpeg_bytes)} bytes, decoding...", file=sys.stderr)
        payload = decode_dct_qim(jpeg_bytes)
        print(f"[qim_cli] decode_dct_qim returned: {len(payload) if payload else 0} bytes", file=sys.stderr)
        if payload is None:
            print("No QIM payload found", file=sys.stderr)
            return 1
        try:
            payload = zlib.decompress(payload)
        except zlib.error:
            pass
        print(base64.standard_b64encode(payload).decode(), end="")
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
