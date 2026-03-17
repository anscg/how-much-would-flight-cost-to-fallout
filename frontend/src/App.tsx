import React, { useState, useMemo } from 'react';
import Select from 'react-select';
import { Plane, Search, AlertCircle, PlaneTakeoff, Loader2, Sparkles } from 'lucide-react';
import airportsData from './airports.json';
import './index.css';

interface FlightResult {
  requested_origin: string;
  actual_origin: string;
  origin_city: string;
  destination: string;
  price: string;
  airline: string;
  scanned_airports: string[];
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

  const options = useMemo(() => {
    if (!searchQuery) {
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
      setError(err.message || 'Transmission failed. Ensure backend is running.');
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
                Wait ~20s for cheapest...
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
            <p style={{ fontWeight: 500, margin: 0 }}>Bypassing Google's initial load...</p>
            <p style={{ fontSize: '0.875rem', marginTop: '-0.5rem', textAlign: 'center' }}>
              We wait for all background network requests to finish so we don't miss the true cheapest price.
            </p>
          </div>
        )}

        {result && !loading && (
          <div className="result-container">
            <div className="result-header">
              <span className="result-badge">Absolute Lowest Price</span>
            </div>

            {result.actual_origin !== result.requested_origin && (
               <div style={{ 
                 display: 'flex', 
                 alignItems: 'center', 
                 gap: '6px', 
                 background: 'rgba(236,55,80,0.05)', 
                 color: 'var(--accent)', 
                 padding: '0.5rem 1rem', 
                 borderRadius: '8px',
                 fontSize: '0.875rem',
                 fontWeight: 600,
                 marginBottom: '1.5rem'
               }}>
                 <Sparkles size={16} />
                 Saved money flying from nearby {result.actual_origin} instead of {result.requested_origin}!
               </div>
            )}
            
            <div className="route-info">
              {/* ORIGIN */}
              <div className="airport-display">
                <span className="city-name">{result.origin_city}</span>
                <span className="iata-code">{result.actual_origin}</span>
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

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', width: '100%' }}>
              Deep Scanned Origins: {result.scanned_airports.join(', ')} <br/>
              Destinations: HKG, MFM, SZX, CAN
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
