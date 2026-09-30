#!/usr/bin/env python3

import argparse
from pathlib import Path


REPLACEMENTS = {
    "marketrisk-api:latest": "marketrisk-api:{tag}",
    "marketrisk-frontend:latest": "marketrisk-frontend:{tag}",
    "marketrisk-spark-job:latest": "marketrisk-spark-job:{tag}",
}


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

    for old_suffix, new_suffix in REPLACEMENTS.items():
        old = f"image: {old_suffix}"
        new = f"image: {prefix}/{new_suffix.format(tag=tag)}"
        text = text.replace(old, new)

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

    return 0 if changed or True else 1


if __name__ == "__main__":
    raise SystemExit(main())
