#!/usr/bin/env python3
"""Translate extracted text with the locally installed Argos model."""
import re
import sys
from pathlib import Path

import argostranslate.translate


def chunks(text, max_words=110):
    for paragraph in re.split(r"\n\s*\n", text):
        words = paragraph.split()
        for start in range(0, len(words), max_words):
            piece = " ".join(words[start : start + max_words])
            if piece:
                yield piece


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: argos_translate.py input.txt output.txt")
    source = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
    result = "\n\n".join(
        argostranslate.translate.translate(part, "en", "hi") for part in chunks(source)
    )
    Path(sys.argv[2]).write_text(result, encoding="utf-8")


if __name__ == "__main__":
    main()
