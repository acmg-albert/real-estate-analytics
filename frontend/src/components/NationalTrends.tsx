import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';

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
        setLoading(true);
        const response = await fetch(`${API_URL}/api/affordability/national-trends`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        setData(jsonData);
      } catch (e) {
        setError(e instanceof Error ? e.message : '获取数据时发生错误');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
        全国房地产市场趋势
      </Typography>
      {/* 这里可以添加数据可视化组件 */}
    </Box>
  );
};

export default NationalTrends; 