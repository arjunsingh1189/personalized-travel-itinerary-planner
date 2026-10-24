import json, os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from .schemas import TripRequest, Itinerary, RegenerateRequest, Day

load_dotenv()

app = FastAPI()

origins = ["http://localhost:5173"]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

PROMPT = """You are an expert travel planner.
Create a day-wise itinerary as STRICT JSON matching this schema:
{{"days":[{{"day":1,"summary":"","activities":[{{"time":"","title":"","type":"attraction|food|stay|transport","description":"","estimated_cost":0}}]}}]}}

Destination: {destination}
Dates: {start_date} to {end_date}
Budget: {budget} INR total, group size {group_size}
Style: {travel_style}
Interests: {interests}

Rules: create exactly one entry in "days" for every day of the trip. Group nearby places on the same day, include meals, stay within budget, count hotel cost only once per night, keep each description under 15 words, no text outside JSON."""

DAY_PROMPT = """You are an expert travel planner.
Create ONE day of a trip as STRICT JSON:
{{"day":{day},"summary":"","activities":[{{"time":"","title":"","type":"attraction|food|stay|transport","description":"","estimated_cost":0}}]}}

Destination: {destination}
This is day {day} of {total_days}.
Total trip budget: {budget} INR, group size {group_size}
Style: {travel_style}
Interests: {interests}
Do NOT repeat these already planned places: {avoid}

Rules: include meals, make a fresh different plan, keep each description under 15 words, no text outside JSON."""


@app.get("/")
def home():
    return {"status": "running"}


@app.post("/generate", response_model=Itinerary)
def generate(req: TripRequest):
    data = req.model_dump()
    data["interests"] = ", ".join(req.interests)
    prompt = PROMPT.format(**data)

    last_error = None
    for attempt in range(3):
        try:
            res = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_completion_tokens=8000,
            )
            itinerary = Itinerary(**json.loads(res.choices[0].message.content))
            itinerary.total_estimated_cost = sum(
                a.estimated_cost for d in itinerary.days for a in d.activities
            )
            return itinerary
        except Exception as e:
            last_error = e
            print(f"Attempt {attempt + 1} failed: {e}")

    raise HTTPException(status_code=500, detail=f"AI error: {last_error}")


@app.post("/regenerate-day", response_model=Day)
def regenerate_day(req: RegenerateRequest):
    data = req.model_dump()
    data["interests"] = ", ".join(req.interests)
    data["avoid"] = ", ".join(req.avoid) or "none"
    prompt = DAY_PROMPT.format(**data)

    last_error = None
    for attempt in range(3):
        try:
            res = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.8,
                max_completion_tokens=4000,
            )
            day = Day(**json.loads(res.choices[0].message.content))
            day.day = req.day
            return day
        except Exception as e:
            last_error = e
            print(f"Regen attempt {attempt + 1} failed: {e}")

    raise HTTPException(status_code=500, detail=f"AI error: {last_error}")