import base64
import os
import json
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from openai import OpenAI

app = FastAPI(title="MacroCam API")

allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://macrocam-five.vercel.app"
).split(",")

# allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class MacroResult(BaseModel):
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    foods: List[Dict[str, Any]] = Field(default_factory=list)
    notes: Optional[str] = None
    confidence: Optional[str] = None


SYSTEM_PROMPT = """
Analyze this meal photo and estimate:

calories
protein_g
carbs_g
fat_g

Return STRICT JSON format:

{
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "foods": [],
  "notes": "",
  "confidence": "low|medium|high"
}
"""


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)):

    contents = await image.read()

    base64_image = base64.b64encode(contents).decode("utf-8")

    try:

        response = client.responses.create(
            model="gpt-4.1-mini",
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": SYSTEM_PROMPT},
                        {
                            "type": "input_image",
                            "image_url": f"data:image/jpeg;base64,{base64_image}",
                        },
                    ],
                }
            ],
            text={"format": {"type": "json_object"}},
        )

        result = json.loads(response.output_text)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
