import React, { useState, useMemo } from 'react';
import Select from 'react-select';
import { Plane, Search, AlertCircle, PlaneTakeoff, Loader2 } from 'lucide-react';
import airportsData from './airports.json';
import './index.css';

interface FlightResult {
  origin: string;
  destination: string;
  price: string;
  airline: string;
}

const DESTINATION_CITIES: Record<string, string> = {
  'HKG': 'Hong Kong',
  'MFM': 'Macau',
  'SZX': 'Shenzhen',
  'CAN': 'Guangzhou'
};

function App() {
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FlightResult | null>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Performance optimization for dropdown
  const options = useMemo(() => {
    if (!searchQuery) {
      // Default major hubs if they haven't typed yet
      return airportsData.filter((a: any) => ['JFK', 'SFO', 'LHR', 'HND', 'SYD'].includes(a.value));
    }
    const lower = searchQuery.toLowerCase();
    return airportsData
      .filter((a: any) => a.searchStr.includes(lower))
      .slice(0, 50);
  }, [searchQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCity) {
      setError('Please select an origin city/airport.');
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
              options={options}
              value={selectedCity}
              onChange={setSelectedCity}
              onInputChange={(val) => setSearchQuery(val)}
              filterOption={null}
              styles={selectStyles}
              placeholder="Type any city or airport code..."
              isSearchable
              isDisabled={loading}
              components={{ IndicatorSeparator: () => null }}
              noOptionsMessage={() => searchQuery ? "No airports found" : "Type to search..."}
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
              {/* ORIGIN */}
              <div className="airport-display">
                <span className="city-name">{selectedCity?.city || result.origin}</span>
                <span className="iata-code">{result.origin}</span>
              </div>
              
              {/* FLIGHT PATH */}
              <div className="flight-path">
                <Plane size={24} style={{ color: 'var(--text-muted)' }} />
              </div>

              {/* DESTINATION */}
              <div className="airport-display">
                <span className="city-name">{DESTINATION_CITIES[result.destination] || result.destination}</span>
                <span className="iata-code">{result.destination}</span>
              </div>
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
