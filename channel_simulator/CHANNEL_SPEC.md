# Channel Specification

Exact parameters for each simulated platform profile. "Defeating the situation" means payload recovery (decode = original) after these transformations.

## Profile Parameters

| Profile           | max_width | JPEG quality | Chroma subsampling | Resize method | Aspect model |
|------------------|-----------|--------------|--------------------|---------------|--------------|
| whatsapp_standard| 800       | 65           | 4:2:0              | LANCZOS       | none         |
| whatsapp_hd      | 4096      | 65           | 4:2:0              | LANCZOS       | none         |
| instagram        | 1080      | 82           | 4:2:0              | LANCZOS       | 4:5–1.91:1   |
| facebook         | 2048      | 77           | 4:2:0              | LANCZOS       | none         |
| twitter          | 600       | 82           | 4:2:0              | LANCZOS       | none         |
| telegram_photo   | 1920      | 80           | 4:2:0              | LANCZOS       | none         |
| imessage         | 1280      | 80           | 4:2:0              | LANCZOS       | none         |

`whatsapp_standard` and `whatsapp_hd` are the two canonical WhatsApp photo models. The former legacy `whatsapp` name was removed because it duplicated the standard model. Sending as a file/document is a separate no-recompression transport and is intentionally not represented as a photo profile.

## Pipeline Order

1. **Strip EXIF / metadata** (orientation applied then discarded)
2. **Convert to RGB** if needed (sRGB assumed)
3. **Apply a modeled aspect-ratio crop** where the platform requires one
4. **Resize** to max_width (maintain aspect ratio) if image is wider
5. **Encode as JPEG** with quality and 4:2:0 subsampling

## Source

Defined in [channel.py](channel.py) `PROFILES` and applied by `simulate()`. These are conservative test models, not guarantees about proprietary platform behavior; field results should update them.
