#!/usr/bin/env python3

import argparse
from pathlib import Path
import re


IMAGE_NAMES = ("marketrisk-api", "marketrisk-frontend", "marketrisk-spark-job")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update local image tags to GHCR digests or SHA values.")
    parser.add_argument("--tag", required=True, help="Image tag to write, usually the Git SHA.")
    parser.add_argument("--prefix", required=True, help="GHCR namespace prefix such as ghcr.io/your-user")
    parser.add_argument(
        "--files",
        nargs="+",
        required=True,
        help="Manifest files to update.",
    )
    return parser.parse_args()


def update_file(path: Path, tag: str, prefix: str) -> bool:
    text = path.read_text()
    original = text

    for image_name in IMAGE_NAMES:
        pattern = re.compile(
            rf"(?m)^(\s*image:\s*)(?:{re.escape(image_name)}|"
            rf"{re.escape(prefix)}/{re.escape(image_name)})(?::[^\s]+)?\s*$"
        )
        text = pattern.sub(rf"\g<1>{prefix}/{image_name}:{tag}", text)

    if text == original:
        return False

    path.write_text(text)
    return True


def main() -> int:
    args = parse_args()
    changed = False

    for file_name in args.files:
        path = Path(file_name)
        if not path.exists():
            raise FileNotFoundError(f"Manifest file not found: {path}")

        if update_file(path, args.tag, args.prefix):
            print(f"Updated {path}")
            changed = True
        else:
            print(f"No change for {path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
