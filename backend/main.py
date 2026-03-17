from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from fast_flights import get_flights # Import fast-flights when ready to implement logic

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Flight API is running"}

@app.get("/api/flights")
def get_flight_info():
    # Placeholder for fast-flights implementation
    return {"flights": []}
