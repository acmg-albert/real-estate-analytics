import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface MSADetailsProps {
  regionName: string;
}

interface MSADetailsData {
  dates: string[];
  homeowner: number[];
  renter: number[];
  gaps: number[];
  chartData: any[];
}

const MSADetails: React.FC<MSADetailsProps> = ({ regionName }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<MSADetailsData | null>(null);
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await axios.get<MSADetailsData>(
                    `${API_URL}/api/v1/affordability/msa/${encodeURIComponent(regionName)}`
                );
                setData(response.data);
                setChartData(response.data.chartData);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [regionName]);

    return (
        <div>
            {/* Render your component content here */}
        </div>
    );
};

export default MSADetails; 