#!/bin/bash

echo "Starting Fallout Flight Planner locally..."

# Start Backend
echo "Setting up backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python -m uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Start Frontend
echo "Setting up frontend..."
cd frontend
npm install
npm run dev &
FRONTEND_PID=$!
cd ..

echo "Both servers are running!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both servers."

# Wait for user input to kill processes
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
