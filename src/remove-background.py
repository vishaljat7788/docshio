#!/usr/bin/env python3
"""Create a soft foreground alpha mask for a centered subject using OpenCV GrabCut."""
import sys

import cv2
import numpy as np


def main():
    source_path, output_path, iterations_arg = sys.argv[1:4]
    image = cv2.imread(source_path, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("The uploaded image could not be decoded.")

    height, width = image.shape[:2]
    if width < 64 or height < 64:
        raise ValueError("Use an image at least 64 pixels wide and tall.")

    # The crop is reduced before segmentation by the server to keep memory low.
    # Everything outside this inner rectangle is treated as definite background.
    margin_x = max(1, round(width * 0.012))
    margin_y = max(1, round(height * 0.012))
    rect = (margin_x, margin_y, width - 2 * margin_x, height - 2 * margin_y)
    mask = np.zeros((height, width), dtype=np.uint8)
    bg_model = np.zeros((1, 65), dtype=np.float64)
    fg_model = np.zeros((1, 65), dtype=np.float64)

    cv2.grabCut(
        image,
        mask,
        rect,
        bg_model,
        fg_model,
        max(1, min(8, int(iterations_arg))),
        cv2.GC_INIT_WITH_RECT,
    )

    foreground = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
    coverage = float(np.count_nonzero(foreground)) / float(width * height)
    if coverage < 0.01 or coverage > 0.98:
        raise ValueError("Could not find a clear foreground subject in this image.")
    alpha = np.where(foreground, 255, 0).astype(np.uint8)
    # A small blur softens the pixelated boundary and hair edges.
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0.8)
    if not cv2.imwrite(output_path, alpha):
        raise OSError("Could not write the foreground mask.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # Emit a short diagnostic for the server log.
        print(str(exc), file=sys.stderr)
        sys.exit(1)
