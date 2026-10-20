"""Settings from environment variables. No credentials are read here; AWS calls use the default credential chain."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

DEFAULT_MODE = "mock"
DEFAULT_REGION = "us-west-2"
DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@dataclass(frozen=True)
class Settings:
    # mock (default, no AWS), bedrock, or a future provider such as sap.
    mode: str
    # Required for model-backed modes. There is deliberately no default model id.
    model_id: str | None
    region: str
    data_dir: Path

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> Settings:
        return cls(
            mode=env.get("AGENT_MODE", DEFAULT_MODE).strip().lower() or DEFAULT_MODE,
            model_id=env.get("AGENT_MODEL_ID", "").strip() or None,
            region=env.get("AWS_REGION", "").strip() or DEFAULT_REGION,
            data_dir=Path(env["AGENT_DATA_DIR"]) if env.get("AGENT_DATA_DIR") else DEFAULT_DATA_DIR,
        )
