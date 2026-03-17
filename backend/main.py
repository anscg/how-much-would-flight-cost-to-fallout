from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json
import re
from math import radians, cos, sin, asin, sqrt
from contextlib import asynccontextmanager

from playwright.async_api import async_playwright
from fast_flights.filter import TFSData
from fast_flights.flights_impl import FlightData, Passengers

DESTINATIONS = ["HKG", "MFM", "SZX", "CAN"]
DEPART_DATE = "2026-07-01"
RETURN_DATE = "2026-07-07"

playwright_instance = None
browser = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global playwright_instance, browser
    playwright_instance = await async_playwright().start()
    # Launch browser globally to be reused across requests
    browser = await playwright_instance.chromium.launch(headless=True)
    yield
    if browser:
        await browser.close()
    if playwright_instance:
        await playwright_instance.stop()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Airports DB for nearby airport calculations
try:
    with open("airports.json", "r") as f:
        airports_raw = json.load(f)
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
    r = 3956
    return c * r

def get_nearby_airports(iata_code: str, max_miles: int = 100, max_results: int = 3):
    if iata_code not in IATA_DB:
        return [iata_code]
    
    origin_airport = IATA_DB[iata_code]
    lon1, lat1 = origin_airport['lon'], origin_airport['lat']
    
    nearby = []
    for code, data in IATA_DB.items():
        if len(code) == 3 and code.isalpha():
            dist = haversine(lon1, lat1, data['lon'], data['lat'])
            if dist <= max_miles:
                nearby.append((code, dist, data['city']))
                
    nearby.sort(key=lambda x: x[1])
    return [x[0] for x in nearby[:max_results]]

def parse_price(price_str):
    if not price_str: 
        return float('inf')
    clean = re.sub(r'[^\d.]', '', str(price_str))
    try:
        return float(clean) if clean else float('inf')
    except ValueError:
        return float('inf')

async def scrape_flight(context, origin: str, dest: str):
    # Use fast-flights purely to generate the Base64 Protobuf payload for the URL
    tfs = TFSData.from_interface(
        flight_data=[
            FlightData(date=DEPART_DATE, from_airport=origin, to_airport=dest),
            FlightData(date=RETURN_DATE, from_airport=dest, to_airport=origin)
        ],
        trip="round-trip",
        seat="economy",
        passengers=Passengers(adults=1, children=0, infants_in_seat=0, infants_on_lap=0)
    )
    url = f"https://www.google.com/travel/flights?tfs={tfs.as_b64().decode('utf-8')}&hl=en"
    
    page = await context.new_page()
    best_flight = None
    try:
        # Mask webdriver signature
        await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        await page.goto(url, wait_until="domcontentloaded")
        
        # 1. Switch to "Cheapest" tab if it exists to ensure we bypass Google's "Best" sorting
        try:
            tab = page.locator('div[role="tab"]', has_text="Cheapest")
            if await tab.count() > 0:
                await tab.first.click(timeout=3000)
                await page.wait_for_timeout(1000)
        except:
            pass # Tab not found, likely already viewing the only list
            
        # 2. WAIT FOR THE PROGRESS BAR! This solves the issue fast-flights had.
        try:
            progress = page.locator('[role="progressbar"]')
            # Wait up to 15 seconds for Google's background XHR flight fetching to finish
            await progress.wait_for(state="hidden", timeout=15000)
        except:
            # Fallback if progress bar is undetectable
            await page.wait_for_timeout(8000)
            
        # Extra 2 seconds for DOM to settle after progress bar finishes
        await page.wait_for_timeout(2000)
        
        # 3. Extract the lowest price directly from the DOM using robust heuristics
        flights = await page.evaluate('''() => {
            let results = [];
            document.querySelectorAll('li').forEach(li => {
                let text = li.innerText || '';
                // Heuristic: valid flight rows contain duration and a currency symbol
                if ((text.includes(' hr ') || text.includes(' min ')) && text.match(/[$£€₹¥]/)) {
                    let priceMatch = text.match(/[$£€₹¥]\\s*[\\d,]+/);
                    let price = priceMatch ? priceMatch[0] : null;
                    
                    let airlineEl = li.querySelector('.sSHqwe'); // Google Flights airline class
                    let airline = airlineEl ? airlineEl.innerText : text.split('\\n')[0];
                    
                    if (price) {
                        results.push({ price, airline });
                    }
                }
            });
            return results;
        }''')
        
        if flights:
            for f in flights:
                price_val = parse_price(f['price'])
                if best_flight is None or price_val < best_flight['price_val']:
                    best_flight = {
                        "actual_origin": origin,
                        "destination": dest,
                        "price": f['price'],
                        "price_val": price_val,
                        "airline": f['airline']
                    }
    except Exception as e:
        print(f"Error scraping {origin}->{dest}: {e}")
    finally:
        await page.close()
        
    return best_flight

@app.get("/api/flights")
async def get_cheapest_flight(origin: str = Query(..., min_length=3, max_length=3)):
    origin = origin.upper()
    
    origins_to_check = get_nearby_airports(origin, max_miles=100, max_results=3)
    if origin not in origins_to_check:
        origins_to_check.insert(0, origin)
        
    print(f"Scanning matrix: {origins_to_check} -> {DESTINATIONS}")
    
    # Create a new browser context (like an incognito window) for this request
    context = await browser.new_context()
    
    # Throttle concurrency so we don't open 12 tabs at once and crash Chromium/RAM
    sem = asyncio.Semaphore(6)
    
    async def fetch_with_sem(o, d):
        async with sem:
            return await scrape_flight(context, o, d)
            
    tasks = []
    for o in origins_to_check:
        for d in DESTINATIONS:
            tasks.append(fetch_with_sem(o, d))
            
    results = await asyncio.gather(*tasks)
    await context.close()
    
    valid_results = [r for r in results if r is not None]
    
    if not valid_results:
        raise HTTPException(status_code=404, detail="No flights found to the Greater Bay Area.")
    
    valid_results.sort(key=lambda x: x["price_val"])
    best = valid_results[0]
    
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
