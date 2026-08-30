#!/usr/bin/env python3
"""Source of the locked ALORA marks is assets/alora-wordmark.svg + assets/alora-window.svg.

Rasterize those SVGs (cream #F4EDE4), flood-remove outer cream, trim, write:
  assets/alora-wordmark.png
  assets/alora-window.png
  assets/alora-favicon.png   (arch crop)
  assets/alora-apple-touch.png

The wordmark never changes: charcoal ALORA, coral sun on the first-A horizon.
The window is the Ixtapa rental view: arch, palm, two mountains, coral sun, key on the sill.
"""
print(__doc__)
