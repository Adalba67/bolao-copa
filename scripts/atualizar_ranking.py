"""Recalculate general ranking from current data."""

from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.main import main  # noqa: E402


if __name__ == "__main__":
    main()
