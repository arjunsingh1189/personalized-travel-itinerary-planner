from pydantic import BaseModel
from typing import List


class Activity(BaseModel):
    time: str
    title: str
    type: str
    description: str
    estimated_cost: float


class Day(BaseModel):
    day: int
    summary: str
    activities: List[Activity]


class Itinerary(BaseModel):
    days: List[Day]
    total_estimated_cost: float = 0


class TripRequest(BaseModel):
    destination: str
    start_date: str
    end_date: str
    budget: float
    travel_style: str
    group_size: int = 1
    interests: List[str] = []


class RegenerateRequest(BaseModel):
    destination: str
    budget: float
    travel_style: str
    group_size: int = 1
    interests: List[str] = []
    day: int
    total_days: int
    avoid: List[str] = []