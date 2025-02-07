import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

interface NationalTrendsData {
  dates: string[];
  homeowner: number[];
  renter: number[];
  gap: number[];
}

const NationalTrends: React.FC = () => {
  const [data, setData] = useState<NationalTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/affordability/national-trends`);
        const data = await response.json();
        setData(data);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      {/* Render your component content here */}
    </div>
  );
};

export default NationalTrends; 