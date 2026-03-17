import React, { useState } from 'react';
import Select from 'react-select';
import { Plane, Search, AlertCircle, ArrowRight, PlaneTakeoff, Loader2 } from 'lucide-react';
import './index.css';

interface FlightResult {
  origin: string;
  destination: string;
  price: string;
  airline: string;
}

const MAJOR_CITIES = [
  { value: 'NYC', label: 'New York (NYC)' },
  { value: 'SFO', label: 'San Francisco (SFO)' },
  { value: 'LAX', label: 'Los Angeles (LAX)' },
  { value: 'CHI', label: 'Chicago (CHI)' },
  { value: 'BOS', label: 'Boston (BOS)' },
  { value: 'SEA', label: 'Seattle (SEA)' },
  { value: 'YVR', label: 'Vancouver (YVR)' },
  { value: 'LHR', label: 'London (LHR)' },
  { value: 'CDG', label: 'Paris (CDG)' },
  { value: 'TYO', label: 'Tokyo (TYO)' },
  { value: 'SIN', label: 'Singapore (SIN)' },
  { value: 'SYD', label: 'Sydney (SYD)' },
];

function App() {
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FlightResult | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCity) {
      setError('Please select an origin city.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`http://localhost:8000/api/flights?origin=${selectedCity.value}`);
      if (!res.ok) {
        throw new Error('No routes found for this origin.');
      }
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Transmission failed.');
    } finally {
      setLoading(false);
    }
  };

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      padding: '0.5rem',
      borderRadius: '12px',
      borderColor: state.isFocused ? 'var(--accent)' : 'var(--border)',
      boxShadow: state.isFocused ? '0 0 0 1px var(--accent)' : 'none',
      fontFamily: 'var(--font-sans)',
      fontSize: '1rem',
      cursor: 'pointer',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--accent)' : '#D1D5DB'
      }
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontFamily: 'var(--font-sans)',
      cursor: 'pointer',
      backgroundColor: state.isSelected 
        ? 'var(--accent)' 
        : state.isFocused 
          ? 'rgba(236, 55, 80, 0.05)' 
          : 'transparent',
      color: state.isSelected ? 'white' : 'var(--text-main)',
    }),
    menu: (base: any) => ({
      ...base,
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid var(--border)',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    })
  };

  return (
    <div className="app-wrapper">
      <header className="header">
        <span className="brand">Hack Club 2026</span>
        <h1 className="title">Fallout Flightlink</h1>
      </header>

      <main className="search-card">
        <form onSubmit={handleSearch} className="input-group">
          <label className="input-label">DEPARTING FROM</label>
          <div style={{ marginBottom: '1.5rem' }}>
            <Select
              options={MAJOR_CITIES}
              value={selectedCity}
              onChange={setSelectedCity}
              styles={selectStyles}
              placeholder="Search major tech hubs..."
              isSearchable
              isDisabled={loading}
              components={{ IndicatorSeparator: () => null }}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading || !selectedCity}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={18} className="spinner" />
                Scanning routes...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} />
                Find Cheapest Flight
              </span>
            )}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <PlaneTakeoff size={32} className="spinner" />
            <p style={{ fontWeight: 500 }}>Scanning prices to HKG, MFM, SZX & CAN...</p>
          </div>
        )}

        {result && !loading && (
          <div className="result-container">
            <div className="result-header">
              <span className="result-badge">Best Price Guarantee</span>
            </div>
            
            <div className="route-info">
              <span className="airport-code">{result.origin}</span>
              <Plane size={24} className="plane-icon" />
              <span className="airport-code">{result.destination}</span>
            </div>
            
            <div className="price-display">
              {result.price}
            </div>
            
            <div className="airline-info">
              Operated by {result.airline} • Round-Trip
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
