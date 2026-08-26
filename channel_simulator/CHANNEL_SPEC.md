# Channel Specification

Exact parameters for each simulated platform profile. "Defeating the situation" means payload recovery (decode = original) after these transformations.

## Profile Parameters

| Profile    | max_width | JPEG quality | Recompression passes | Chroma subsampling | Resize method |
|-----------|-----------|--------------|----------------------|--------------------|---------------|
| whatsapp  | 1600      | 55           | 2                    | 4:2:0              | LANCZOS       |
| telegram  | 1280      | 72           | 1                    | 4:2:0              | LANCZOS       |
| instagram | 1080      | 72           | 1                    | 4:2:0              | LANCZOS       |
| facebook  | 2048      | 70           | 1                    | 4:2:0              | LANCZOS       |
| twitter   | 1200      | 85           | 1                    | 4:2:0              | LANCZOS       |

WhatsApp is the most aggressive channel: double-pass recompression at quality 55.

## Pipeline Order

1. **Strip EXIF / metadata** (orientation applied then discarded)
2. **Convert to RGB** if needed (sRGB assumed)
3. **Resize** to max_width (maintain aspect ratio) if image is wider
4. **Encode as JPEG** with quality and 4:2:0 subsampling
5. For multi-pass profiles (WhatsApp): decode and re-encode at the same quality for each additional pass

## Source

Defined in [channel.py](channel.py) `PROFILES` and applied by `simulate()`.
