import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Autocomplete,
  TextField,
  Button,
  Paper,
  Slider
} from '@mui/material';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Line
} from 'recharts';

interface Region {
  id: string;
  name: string;
}

interface MetricData {
  month: string;
  homeownerAffordability: number | null;
  renterAffordability: number | null;
  affordabilityGap: number | null;
  gapTrend: number | null;
  totalPayment: number | null;
  mortgagePayment: number | null;
  paymentGap: number | null;
  affordablePrice: number | null;
  medianPrice: number | null;
  priceGap: number | null;
  priceTrend: number | null;
}

const AffordabilityDetail: React.FC = () => {
  const { region } = useParams<{ region: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MetricData[]>([]);
  const [availableRegions, setAvailableRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState(region || '');
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);

  // 计算可用的日期范围
  const dateRange = useMemo(() => {
    if (!data.length) return { min: '', max: '', dates: [] };
    const dates = data.map(d => d.month).sort();
    return {
      min: dates[0],
      max: dates[dates.length - 1],
      dates
    };
  }, [data]);

  // 根据滑块值获取对应的日期
  const getDateFromSliderValue = useCallback((value: number) => {
    if (!data.length) return '';
    const index = Math.round((value / 100) * (data.length - 1));
    return data[index]?.month || '';
  }, [data]);

  // 处理滑块变化
  const handleTimeRangeChange = (_event: Event, newValue: number | number[]) => {
    setTimeRange(newValue as [number, number]);
  };

  // 过滤数据
  const getFilteredData = useCallback(() => {
    if (!data.length) return [];
    const startDate = getDateFromSliderValue(timeRange[0]);
    const endDate = getDateFromSliderValue(timeRange[1]);
    return data.filter(d => d.month >= startDate && d.month <= endDate);
  }, [data, timeRange, getDateFromSliderValue]);

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await fetch(`${API_URL}/api/affordability-regions`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAvailableRegions(data);
      } catch (err) {
        console.error('Error fetching regions:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch regions');
      }
    };

    fetchRegions();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedRegion) return;
      
      setLoading(true);
      try {
        const response = await fetch(
          `${API_URL}/api/affordability-metrics/${encodeURIComponent(selectedRegion)}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseData = await response.json();
        setData(responseData);
        setError(null);
        // 重置时间范围到全部数据
        setTimeRange([0, 100]);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedRegion]);

  const formatPercentage = (value: number | null) => {
    if (value == null) return '';
    return `${value.toFixed(2)}%`;
  };

  const formatCurrency = (value: number | null) => {
    if (value == null) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const customTooltipFormatter = (value: number, name: string) => {
    if (name === 'Gap') return formatPercentage(value);
    return formatPercentage(value);
  };

  const customCurrencyFormatter = (value: number) => {
    return formatCurrency(value);
  };

  const renderAffordabilityChart = () => {
    if (!data.length) return null;

    const filteredData = getFilteredData();

    return (
      <Box sx={{ mt: 4, position: 'relative' }}>
        <Typography variant="h6" gutterBottom>
          Homeowner vs. Renter Affordability
        </Typography>
        <Box sx={{ width: '100%', height: 500, position: 'relative', mb: 4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={filteredData}
              margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
              height={400}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                height={36}
                tickMargin={20}
              />
              <YAxis
                yAxisId="left"
                label={{ value: 'Affordability (%)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Gap (%)', angle: 90, position: 'insideRight' }}
              />
              <RechartsTooltip 
                formatter={customTooltipFormatter}
              />
              <RechartsLegend 
                verticalAlign="top"
                height={36}
              />
              <Bar
                yAxisId="right"
                dataKey="affordabilityGap"
                fill="#ffc658"
                name="Gap"
                opacity={0.5}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="homeownerAffordability"
                stroke="#8884d8"
                name="Homeowner"
                dot={false}
                strokeWidth={3}
                connectNulls
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="renterAffordability"
                stroke="#82ca9d"
                name="Renter"
                dot={false}
                strokeWidth={3}
                connectNulls
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="gapTrend"
                stroke="#ff7300"
                name="Gap Trend"
                dot={false}
                strokeWidth={2}
                strokeDasharray="5 5"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
          <Box 
            sx={{ 
              position: 'absolute', 
              bottom: 0,
              left: 20, 
              right: 30, 
              height: 40,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Slider
              value={timeRange}
              onChange={handleTimeRangeChange}
              min={0}
              max={100}
              step={100 / (data.length - 1)}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => getDateFromSliderValue(value)}
              marks={[
                { value: 0, label: dateRange.min },
                { value: 100, label: dateRange.max }
              ]}
            />
          </Box>
        </Box>
      </Box>
    );
  };

  const renderPaymentChart = () => {
    if (!data.length) return null;

    const filteredData = getFilteredData();

    return (
      <Box sx={{ mt: 4, position: 'relative' }}>
        <Typography variant="h6" gutterBottom>
          Monthly Payment Analysis
        </Typography>
        <Box sx={{ width: '100%', height: 450, position: 'relative', mb: 4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={filteredData}
              margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                height={36}
                tickMargin={20}
              />
              <YAxis
                yAxisId="left"
                label={{ value: 'Payment ($)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Gap ($)', angle: 90, position: 'insideRight' }}
              />
              <RechartsTooltip 
                formatter={customCurrencyFormatter}
              />
              <RechartsLegend 
                verticalAlign="top"
                height={36}
              />
              <Bar
                yAxisId="right"
                dataKey="paymentGap"
                fill="#ffc658"
                name="Payment Gap"
                opacity={0.5}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalPayment"
                stroke="#8884d8"
                name="Total Payment"
                dot={false}
                strokeWidth={3}
                connectNulls
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="mortgagePayment"
                stroke="#82ca9d"
                name="Mortgage Payment"
                dot={false}
                strokeWidth={3}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
          <Box 
            sx={{ 
              position: 'absolute', 
              bottom: 0, 
              left: 20, 
              right: 30, 
              height: 40,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Slider
              value={timeRange}
              onChange={handleTimeRangeChange}
              min={0}
              max={100}
              step={100 / (data.length - 1)}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => getDateFromSliderValue(value)}
              marks={[
                { value: 0, label: dateRange.min },
                { value: 100, label: dateRange.max }
              ]}
            />
          </Box>
        </Box>
      </Box>
    );
  };

  const renderPriceChart = () => {
    if (!data.length) return null;

    const filteredData = getFilteredData();

    return (
      <Box sx={{ mt: 4, position: 'relative' }}>
        <Typography variant="h6" gutterBottom>
          Price Affordability Analysis
        </Typography>
        <Box sx={{ width: '100%', height: 450, position: 'relative', mb: 4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={filteredData}
              margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                height={36}
                tickMargin={20}
              />
              <YAxis
                yAxisId="left"
                label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Gap ($)', angle: 90, position: 'insideRight' }}
              />
              <RechartsTooltip 
                formatter={customCurrencyFormatter}
              />
              <RechartsLegend 
                verticalAlign="top"
                height={36}
              />
              <Bar
                yAxisId="right"
                dataKey="priceGap"
                fill="#ffc658"
                name="Price Gap"
                opacity={0.5}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="affordablePrice"
                stroke="#8884d8"
                name="Affordable Price"
                dot={false}
                strokeWidth={3}
                connectNulls
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="medianPrice"
                stroke="#82ca9d"
                name="Median Price"
                dot={false}
                strokeWidth={3}
                connectNulls
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="priceTrend"
                stroke="#ff7300"
                name="Gap Trend"
                dot={false}
                strokeWidth={2}
                strokeDasharray="5 5"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
          <Box 
            sx={{ 
              position: 'absolute', 
              bottom: 0, 
              left: 20, 
              right: 30, 
              height: 40,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Slider
              value={timeRange}
              onChange={handleTimeRangeChange}
              min={0}
              max={100}
              step={100 / (data.length - 1)}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => getDateFromSliderValue(value)}
              marks={[
                { value: 0, label: dateRange.min },
                { value: 100, label: dateRange.max }
              ]}
            />
          </Box>
        </Box>
      </Box>
    );
  };

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

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Affordability Analysis</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => navigate('/affordability')}
        >
          Back to Summary
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <Autocomplete
          value={availableRegions.find(r => r.name === selectedRegion) || null}
          onChange={(_, newValue) => {
            if (newValue) {
              setSelectedRegion(newValue.name);
            }
          }}
          options={availableRegions}
          getOptionLabel={(option) => option.name}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Metropolitan Area"
              variant="outlined"
              sx={{ minWidth: 300 }}
            />
          )}
          sx={{ minWidth: 300 }}
        />
      </Box>

      {data.length > 0 && (
        <Paper elevation={3} sx={{ p: 3 }}>
          {renderAffordabilityChart()}
          {renderPaymentChart()}
          {renderPriceChart()}
          
          <Box sx={{ mt: 4 }}>
            <Typography variant="body2" color="textSecondary">
              * Homeowner affordability is calculated as the monthly mortgage payment (20% down payment) as a percentage of household income
            </Typography>
            <Typography variant="body2" color="textSecondary">
              * Renter affordability is calculated as the monthly rent payment as a percentage of household income
            </Typography>
            <Typography variant="body2" color="textSecondary">
              * Gap trend lines are calculated using trailing 6-month data
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default AffordabilityDetail; 