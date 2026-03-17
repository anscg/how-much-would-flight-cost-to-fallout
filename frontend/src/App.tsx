import React, { useState, useMemo, useRef, useEffect } from "react";
import Select from "react-select";
import { AlertCircle, Loader2 } from "lucide-react";
import airportsData from "./airports.json";
import "./index.css";

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
  HKG: "Hong Kong",
  MFM: "Macau",
  SZX: "Shenzhen",
  CAN: "Guangzhou",
};

const FRAME = {
  tl: "https://fallout.hackclub.com/border/top_left.webp",
  t: "https://fallout.hackclub.com/border/top.webp",
  tr: "https://fallout.hackclub.com/border/top_right.webp",
  l: "https://fallout.hackclub.com/border/left.webp",
  r: "https://fallout.hackclub.com/border/right.webp",
  bl: "https://fallout.hackclub.com/border/bottom_left.webp",
  b: "https://fallout.hackclub.com/border/bottom.webp",
  br: "https://fallout.hackclub.com/border/bottom_right.webp",
};

function App() {
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FlightResult[]>([]);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
      return airportsData.filter((a: any) =>
        ["JFK", "SFO", "LHR", "HND", "SYD"].includes(a.value),
      );
    }
    const lower = searchQuery.toLowerCase();
    return airportsData
      .filter((a: any) => a.searchStr.includes(lower))
      .slice(0, 50);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCity) {
      setError("Please select an origin city/airport.");
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setLoading(true);
    setResults([]);
    setError("");

    const source = new EventSource(
      `http://localhost:8000/api/flights/stream?origin=${selectedCity.value}`,
    );
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.done) {
        setLoading(false);
        source.close();
      } else {
        setResults((prev) => {
          // Because multiple browsers might find the exact same flight, prevent perfect duplicates
          const isDuplicate = prev.some(
            (r) =>
              r.actual_origin === data.actual_origin &&
              r.destination === data.destination &&
              r.airline === data.airline &&
              r.price === data.price,
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
        setError("Connection interrupted or unable to find flights.");
      }
    };
  };

  const selectStyles = {
    container: (base: any) => ({
      ...base,
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      flex: 1,
    }),
    control: (base: any, state: any) => ({
      ...base,
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      height: "58px", // Explicitly match button height (padding 1rem * 2 + font 1.3rem + 4px border)
      minHeight: "58px",
      borderRadius: "1px",
      backgroundColor: "#fff",
      borderColor: "#4b4b4b",
      borderWidth: "2px",
      borderStyle: "solid",
      boxShadow: "none",
      fontFamily: "var(--font-sans)",
      fontSize: "1rem",
      cursor: "pointer",
      color: "#000",
      transition: "all 0.2s ease-out",
      "&:hover": {
        borderColor: "#4b4b4b",
      },
    }),
    valueContainer: (base: any) => ({
      ...base,
      padding: "0 1rem",
      minWidth: 0,
      overflow: "hidden",
      color: "#000",
    }),
    singleValue: (base: any) => ({
      ...base,
      maxWidth: "100%",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      color: "#000",
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontFamily: "var(--font-sans)",
      cursor: "pointer",
      backgroundColor: state.isSelected
        ? "#c99470"
        : state.isFocused
          ? "#f5e6d3"
          : "#edd1b0",
      color: "#4b4b4b",
      padding: "0.75rem 1rem",
      transition: "all 0.2s ease-out",
      "&:active": {
        backgroundColor: "#c99470",
      },
    }),
    menu: (base: any) => ({
      ...base,
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      borderRadius: "1px",
      overflow: "hidden",
      border: "2px solid #4b4b4b",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
      backgroundColor: "#edd1b0",
      marginTop: "4px",
    }),
  };

  // Only display the top 10 cheapest flights globally
  const top10Results = results.slice(0, 10);
  const hasResults = results.length > 0 || loading;

  return (
    <div className={`app-wrapper ${hasResults ? "has-results" : "centered"}`}>
      <header className="header">
        <h1 className="title">How much would my flight cost for</h1>
        <img
          src="https://cdn.hackclub.com/019cfd24-3dba-7e64-b34f-29d6bde57569/fallout-black.svg"
          alt="Fallout Logo"
          className="fallout-logo"
          style={{ width: "390px", marginTop: "12px" }}
        />
      </header>

      <main className="controls-wrap">
        <form onSubmit={handleSearch} className="controls-row">
          <div className="controls-select">
            <Select
              options={options}
              value={selectedCity}
              onChange={setSelectedCity}
              onInputChange={(val) => setSearchQuery(val)}
              filterOption={null}
              styles={selectStyles}
              placeholder="Select origin city or airport..."
              isSearchable
              isDisabled={loading}
              components={{ IndicatorSeparator: () => null }}
              noOptionsMessage={() =>
                searchQuery ? "No airports found" : "Type to search..."
              }
            />
          </div>

          <button
            type="submit"
            className="submit-btn inline"
            disabled={loading || !selectedCity}
          >
            {loading ? <span>SEARCHING...</span> : <span>SEARCH</span>}
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
        <div
          className="table-container"
          style={{
            position: "relative",
            background: "transparent",
            border: "none",
            borderRadius: 0,
            boxShadow: "none",
            overflow: "visible",
            marginTop: "50px",
            marginBottom: "60px",
            padding: 0,
          }}
        >
          {/* 9-slice Frame */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {/* Corners */}
            <img
              src={FRAME.tl}
              alt=""
              style={{
                position: "absolute",
                top: -24,
                left: -24,
                width: 64,
                height: 64,
              }}
            />
            <img
              src={FRAME.tr}
              alt=""
              style={{
                position: "absolute",
                top: -24,
                right: -24,
                width: 64,
                height: 64,
              }}
            />
            <img
              src={FRAME.bl}
              alt=""
              style={{
                position: "absolute",
                bottom: -24,
                left: -24,
                width: 64,
                height: 64,
              }}
            />
            <img
              src={FRAME.br}
              alt=""
              style={{
                position: "absolute",
                bottom: -24,
                right: -24,
                width: 64,
                height: 64,
              }}
            />

            {/* Edges */}
            <div
              style={{
                position: "absolute",
                top: -24,
                left: 40,
                right: 40,
                height: 64,
                backgroundImage: `url(${FRAME.t})`,
                backgroundSize: "100% 100%",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -24,
                left: 40,
                right: 40,
                height: 64,
                backgroundImage: `url(${FRAME.b})`,
                backgroundSize: "100% 100%",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 40,
                bottom: 40,
                left: -24,
                width: 64,
                backgroundImage: `url(${FRAME.l})`,
                backgroundSize: "100% 100%",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 40,
                bottom: 40,
                right: -24,
                width: 64,
                backgroundImage: `url(${FRAME.r})`,
                backgroundSize: "100% 100%",
              }}
            />
          </div>

          <div
            style={{
              background: "#fff",
              position: "relative",
              zIndex: 5,
              margin: "-5px",
              transform: "translateY(-6px)",
            }}
          >
            {top10Results.length > 0 && (
              <table className="flights-table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Carrier</th>
                    <th style={{ textAlign: "right" }}>Round Trip</th>
                  </tr>
                </thead>
                <tbody>
                  {top10Results.map((res, idx) => (
                    <tr
                      key={`${res.actual_origin}-${res.destination}-${res.airline}-${idx}`}
                    >
                      <td>
                        <div className="route-cell">
                          <div className="airport-pill">
                            <span className="airport-code">
                              {res.actual_origin}
                            </span>
                            <span className="airport-city">
                              {res.origin_city.substring(0, 10)}
                              {res.origin_city.length > 10 ? "..." : ""}
                            </span>
                          </div>

                          <span style={{ opacity: 0.5 }}> & </span>

                          <div className="airport-pill">
                            <span className="airport-code">
                              {res.destination}
                            </span>
                            <span className="airport-city">
                              {DESTINATION_CITIES[res.destination] ||
                                res.destination}
                            </span>
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
                Scanning for flights...
              </div>
            )}
          </div>
        </div>
      )}

      {results.length > 0 && !loading && (
        <div className="stream-disclaimer">
          Displaying the top {top10Results.length} cheapest routes found across{" "}
          {results.length} total options.
        </div>
      )}
    </div>
  );
}

export default App;
