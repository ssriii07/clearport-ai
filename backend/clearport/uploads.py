"""Private upload validation and storage for the local demo."""
import os
from pathlib import Path
from .database import BACKEND_DIR

MAX_BYTES = 6 * 1024 * 1024
SUPPORTED_MIMES = {'application/pdf', 'image/png', 'image/jpeg'}


def file_mime(data: bytes) -> str | None:
    if data.startswith(b'%PDF-'):
        return 'application/pdf'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    return None


def private_root() -> Path:
    root = Path(os.getenv('UPLOADS_DIR', str(BACKEND_DIR / 'private_uploads'))).resolve()
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    return root
