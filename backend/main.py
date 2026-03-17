from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fast_flights import FlightData, Passengers, get_flights
from pydantic import BaseModel
from typing import List, Optional
import concurrent.futures

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DESTINATIONS = ["HKG", "MFM", "SZX", "CAN"]
DEPART_DATE = "2026-07-01"
RETURN_DATE = "2026-07-07"

class FlightResponse(BaseModel):
    origin: str
    destination: str
    price: str
    airline: str
    link: Optional[str] = None

def fetch_flight(origin: str, dest: str):
    try:
        result = get_flights(
            flight_data=[
                FlightData(date=DEPART_DATE, from_airport=origin, to_airport=dest),
                FlightData(date=RETURN_DATE, from_airport=dest, to_airport=origin)
            ],
            trip="round-trip",
            seat="economy",
            passengers=Passengers(adults=1, children=0, infants_in_seat=0, infants_on_lap=0),
            fetch_mode="fallback",
        )
        if result and getattr(result, 'flights', None) and len(result.flights) > 0:
            cheapest = result.flights[0]
            price = getattr(cheapest, 'price', 'Unknown')
            airline = getattr(cheapest, 'name', 'Unknown Airline')
            
            # fast-flights price is usually an int or string like "$500"
            price_val = float(''.join(c for c in str(price) if c.isdigit() or c == '.')) if any(c.isdigit() for c in str(price)) else float('inf')
            
            return {
                "destination": dest,
                "price": str(price),
                "price_val": price_val,
                "airline": airline
            }
    except Exception as e:
        print(f"Error fetching {origin}->{dest}: {e}")
    return None

@app.get("/api/flights")
def get_cheapest_flight(origin: str = Query(..., min_length=3, max_length=3)):
    origin = origin.upper()
    best_flight = None
    
    # Fetch in parallel for speed
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(fetch_flight, origin, dest) for dest in DESTINATIONS]
        results = [f.result() for f in concurrent.futures.as_completed(futures) if f.result() is not None]
    
    if not results:
        raise HTTPException(status_code=404, detail="No flights found to the Greater Bay Area.")
    
    # Sort by extracted numeric price
    results.sort(key=lambda x: x["price_val"])
    best = results[0]
    
    return {
        "origin": origin,
        "destination": best["destination"],
        "price": best["price"],
        "airline": best["airline"]
    }
