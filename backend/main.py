from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fast_flights import FlightData, Passengers, get_flights
from pydantic import BaseModel
from typing import Optional
import concurrent.futures
import re
import json
from math import radians, cos, sin, asin, sqrt

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

# Load Airports DB for nearby airport calculations
try:
    with open("airports.json", "r") as f:
        airports_raw = json.load(f)
        # Map by IATA code for quick lookup
        IATA_DB = {v['iata'].upper(): v for v in airports_raw.values() if v.get('iata')}
except FileNotFoundError:
    print("Warning: airports.json not found. Nearby airport scanning will be disabled.")
    IATA_DB = {}

def haversine(lon1, lat1, lon2, lat2):
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a)) 
    r = 3956 # Radius of earth in miles
    return c * r

def get_nearby_airports(iata_code: str, max_miles: int = 100, max_results: int = 3):
    if iata_code not in IATA_DB:
        return [iata_code]
    
    origin_airport = IATA_DB[iata_code]
    lon1, lat1 = origin_airport['lon'], origin_airport['lat']
    
    nearby = []
    for code, data in IATA_DB.items():
        # Only consider valid IATA codes (length 3, letters only)
        if len(code) == 3 and code.isalpha():
            dist = haversine(lon1, lat1, data['lon'], data['lat'])
            if dist <= max_miles:
                nearby.append((code, dist, data['city']))
                
    # Sort by distance
    nearby.sort(key=lambda x: x[1])
    
    # Return just the top X airport codes
    return [x[0] for x in nearby[:max_results]]

def parse_price(price_str):
    if not price_str: 
        return float('inf')
    clean = re.sub(r'[^\d.]', '', str(price_str))
    try:
        return float(clean) if clean else float('inf')
    except ValueError:
        return float('inf')

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
            best_flight = None
            
            for flight in result.flights:
                price_str = getattr(flight, 'price', None)
                price_val = parse_price(price_str)
                
                if best_flight is None or price_val < best_flight["price_val"]:
                    best_flight = {
                        "actual_origin": origin,
                        "destination": dest,
                        "price": str(price_str) if price_str else "Unknown",
                        "price_val": price_val,
                        "airline": getattr(flight, 'name', 'Unknown Airline')
                    }
            return best_flight
            
    except Exception as e:
        print(f"Error fetching {origin}->{dest}: {e}")
    return None

@app.get("/api/flights")
def get_cheapest_flight(origin: str = Query(..., min_length=3, max_length=3)):
    origin = origin.upper()
    
    # Smart routing: find nearby airports to origin
    origins_to_check = get_nearby_airports(origin, max_miles=100, max_results=3)
    # Ensure the original requested code is always included just in case
    if origin not in origins_to_check:
        origins_to_check.insert(0, origin)
        
    print(f"Scanning matrix: {origins_to_check} -> {DESTINATIONS}")
    
    results = []
    # Up to 3 origins * 4 destinations = 12 concurrent threads
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        futures = []
        for o in origins_to_check:
            for d in DESTINATIONS:
                futures.append(executor.submit(fetch_flight, o, d))
                
        for f in concurrent.futures.as_completed(futures):
            res = f.result()
            if res is not None:
                results.append(res)
    
    if not results:
        raise HTTPException(status_code=404, detail="No flights found to the Greater Bay Area.")
    
    results.sort(key=lambda x: x["price_val"])
    best = results[0]
    
    # Append the city names from our DB if possible for better UI
    origin_city = IATA_DB.get(best["actual_origin"], {}).get("city", best["actual_origin"])
    
    return {
        "requested_origin": origin,
        "actual_origin": best["actual_origin"],
        "origin_city": origin_city,
        "destination": best["destination"],
        "price": best["price"],
        "airline": best["airline"],
        "scanned_airports": origins_to_check
    }
