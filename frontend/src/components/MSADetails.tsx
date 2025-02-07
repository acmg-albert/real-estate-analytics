import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';

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

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await axios.get<MSADetailsData>(
                    `${API_URL}/api/v1/affordability/msa/${encodeURIComponent(regionName)}`
                );
                setData(response.data);
            } catch (e) {
                setError(e instanceof Error ? e.message : '获取数据时发生错误');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [regionName]);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box m={2}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    if (!data) {
        return (
            <Box m={2}>
                <Alert severity="warning">暂无数据</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom>
                {regionName} 房地产市场分析
            </Typography>
            {/* 这里可以添加更多的数据展示组件 */}
        </Box>
    );
};

export default MSADetails; 