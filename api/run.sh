#!/bin/bash
source .venv/bin/activate
set -a
source .env.local
set +a
uvicorn main:app --reload --port 8000
