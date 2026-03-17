import React, { useState } from 'react';
import './index.css';

interface FlightResult {
  origin: string;
  destination: string;
  price: string;
  airline: string;
}

function App() {
  const [origin, setOrigin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FlightResult | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (origin.length !== 3) {
      setError('Enter a valid 3-letter IATA code.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`http://localhost:8000/api/flights?origin=${origin.toUpperCase()}`);
      if (!res.ok) {
        throw new Error('No routes found or API error.');
      }
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Transmission failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 className="title">FALLOUT<br />FLIGHTLINK</h1>
      
      <form onSubmit={handleSearch} className="input-group">
        <label className="input-label">DEPARTURE SECTOR [IATA CODE]</label>
        <input 
          type="text" 
          className="airport-input"
          value={origin}
          onChange={(e) => setOrigin(e.target.value.substring(0, 3).toUpperCase())}
          placeholder="NYC"
          maxLength={3}
          disabled={loading}
        />
        <button type="submit" className="submit-btn" disabled={loading || origin.length < 3}>
          {loading ? 'Uplinking...' : 'Initiate Scan'}
        </button>
      </form>

      {error && (
        <div className="error">
          [!] {error}
        </div>
      )}

      {loading && (
        <div className="loader blink">
          SEARCHING GBA NODES...
        </div>
      )}

      {result && !loading && (
        <div className="result-card">
          <div className="route">
            <span>{result.origin}</span>
            <span className="arrow">→</span>
            <span>{result.destination}</span>
          </div>
          <div className="price">{result.price}</div>
          <div className="airline">CARRIER: {result.airline}</div>
        </div>
      )}
    </div>
  );
}

export default App;
