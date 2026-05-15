"""Project settings loaded from environment variables."""

from pathlib import Path
from dotenv import load_dotenv
import os


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "src" / "data"

load_dotenv(ROOT_DIR / ".env")

SPREADSHEET_ID = os.getenv("SPREADSHEET_ID", "")
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "")
USE_GOOGLE_SHEETS = os.getenv("USE_GOOGLE_SHEETS", "false").lower() == "true"
FOOTBALL_API_BASE_URL = os.getenv("FOOTBALL_API_BASE_URL", "")
FOOTBALL_API_KEY = os.getenv("FOOTBALL_API_KEY", "")
