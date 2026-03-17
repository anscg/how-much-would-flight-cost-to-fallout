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
          // Because multiple browsers might find the exact same flight, prevent perfect duplicates
          const isDuplicate = prev.some(r => 
            r.actual_origin === data.actual_origin && 
            r.destination === data.destination &&
            r.airline === data.airline &&
            r.price === data.price
          );
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

  // Only display the top 10 cheapest flights globally
  const top10Results = results.slice(0, 10);

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

      {(results.length > 0 || loading) && (
        <div className="table-container">
          {top10Results.length > 0 && (
            <table className="flights-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Carrier</th>
                  <th style={{ textAlign: 'right' }}>Return Fare</th>
                </tr>
              </thead>
              <tbody>
                {top10Results.map((res, idx) => (
                  <tr key={`${res.actual_origin}-${res.destination}-${res.airline}-${idx}`}>
                    <td>
                      <div className="route-cell">
                        <div className="airport-pill">
                          <span className="airport-code">{res.actual_origin}</span>
                          <span className="airport-city">{res.origin_city.substring(0, 10)}{res.origin_city.length > 10 ? '...' : ''}</span>
                        </div>
                        
                        <Plane size={16} className="plane-icon" />
                        
                        <div className="airport-pill">
                          <span className="airport-code">{res.destination}</span>
                          <span className="airport-city">{DESTINATION_CITIES[res.destination] || res.destination}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="airline-cell">{res.airline}</span>
                    </td>
                    <td className="price-cell">
                      {res.price}
                      {idx === 0 && <span className="best-badge">Best</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {loading && (
            <div className="loading-indicator">
              <Loader2 size={18} className="spinner" />
              Scanning background threads...
            </div>
          )}
        </div>
      )}

      {results.length > 0 && !loading && (
        <div className="stream-disclaimer">
          Scan complete. Displaying the top {top10Results.length} cheapest routes found across {results.length} total options.
        </div>
      )}
    </div>
  );
}

export default App;
