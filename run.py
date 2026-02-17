#!/usr/bin/env python3
import sys
import os
from dotenv import load_dotenv

# Load .env file BEFORE importing app
load_dotenv("/Users/kenya/Downloads/META-AI 2.0/.env")

sys.path.insert(0, "/Users/kenya/Downloads/META-AI 2.0")

if __name__ == "__main__":
    from app import app

    app.run(debug=False, host="0.0.0.0", port=5010)
