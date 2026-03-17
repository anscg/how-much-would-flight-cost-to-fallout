import React, { useState, useMemo, useRef, useEffect } from 'react';
import Select from 'react-select';
import { Plane, Search, AlertCircle, Loader2 } from 'lucide-react';
import airportsData from './airports.json';
import './index.css';

interface FlightResult {
  requested_origin: string;
  actual_origin: string;
  origin_city: string;
  destination: string;
  price: string;
  price_val: number;
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
  const [results, setResults] = useState<FlightResult[]>([]);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup EventSource on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const options = useMemo(() => {
    if (!searchQuery) {
      return airportsData.filter((a: any) => ['JFK', 'SFO', 'LHR', 'HND', 'SYD'].includes(a.value));
    }
    const lower = searchQuery.toLowerCase();
    return airportsData
      .filter((a: any) => a.searchStr.includes(lower))
      .slice(0, 50);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCity) {
      setError('Please select an origin city/airport.');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setLoading(true);
    setResults([]);
    setError('');

    const source = new EventSource(`http://localhost:8000/api/flights/stream?origin=${selectedCity.value}`);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.done) {
        setLoading(false);
        source.close();
      } else {
        setResults((prev) => {
          // Check for duplicate routes (sometimes background streams can be messy)
          const isDuplicate = prev.some(r => r.actual_origin === data.actual_origin && r.destination === data.destination);
          if (isDuplicate) return prev;

          const newResults = [...prev, data];
          // Always sort by cheapest
          return newResults.sort((a, b) => a.price_val - b.price_val);
        });
      }
    };

    source.onerror = (err) => {
      source.close();
      setLoading(false);
      // Only show error if we got literally nothing back before it failed
      if (results.length === 0) {
        setError('Connection interrupted or unable to find flights.');
      }
    };
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
        <form onSubmit={handleSearch} className="input-group" style={{ marginBottom: 0 }}>
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
                Searching matrix...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} />
                Find Best Routes
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
      </main>

      <div className="results-list">
        {results.map((res, idx) => (
          <div key={`${res.actual_origin}-${res.destination}`} className={`flight-row ${idx === 0 ? 'cheapest' : ''}`}>
            
            <div className="flight-route">
              <div className="route-node">
                <span className="node-code">{res.actual_origin}</span>
                <span className="node-city">{res.origin_city.substring(0, 12)}{res.origin_city.length > 12 ? '...' : ''}</span>
              </div>
              
              <div className="route-divider">
                <Plane size={18} />
              </div>

              <div className="route-node">
                <span className="node-code">{res.destination}</span>
                <span className="node-city">{DESTINATION_CITIES[res.destination] || res.destination}</span>
              </div>
            </div>

            <div className="flight-meta">
              {idx === 0 && <span className="badge-cheapest">Best Price</span>}
              <span className="flight-price">{res.price}</span>
              <span className="flight-airline">{res.airline}</span>
            </div>
            
          </div>
        ))}

        {loading && (
          <div className="loading-indicator">
            <Loader2 size={24} className="spinner" />
            Scanning background threads...
          </div>
        )}

        {results.length > 0 && !loading && (
          <div className="stream-disclaimer">
            Scan complete. Displaying all valid nearby routes.
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
