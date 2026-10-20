"""HTTP entry point following the AgentCore Runtime HTTP contract: POST /invocations, GET /ping, port 8080.

Run locally: python -m quality_agent.app   (AGENT_MODE defaults to mock)
"""

from __future__ import annotations

import logging
import os
from typing import Any

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from .config import Settings
from .corpus import Corpus
from .engines import Engine, create_engine
from .service import RequestError, propose_root_cause

logger = logging.getLogger("quality_agent")


def create_app(settings: Settings | None = None, engine: Engine | None = None) -> BedrockAgentCoreApp:
    settings = settings or Settings.from_env()
    corpus = Corpus.load(settings.data_dir)
    retriever = corpus.keyword_retriever()
    engine = engine or create_engine(settings)
    # Only non-secret settings are logged.
    logger.info("quality agent: mode=%s model_id=%s region=%s corpus=%d", engine.mode, engine.model_id, settings.region, len(corpus.ncrs))

    app = BedrockAgentCoreApp()

    @app.entrypoint
    def invoke(payload: Any) -> dict[str, Any]:
        try:
            return propose_root_cause(payload, engine, corpus, retriever)
        except RequestError as e:
            return {"status": "error", "error": str(e)}

    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    create_app().run(port=int(os.environ.get("PORT", "8080")))
