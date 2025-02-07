import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Autocomplete,
  TextField,
  Button,
  Slider
} from '@mui/material';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
  current: number;
  historical: number;
  percentChange: number;
}

interface MetricsData {
  active_listing_count: MetricData[];
  pending_listing_count: MetricData[];
  pending_ratio: MetricData[];
  median_days_on_market: MetricData[];
  price_reduced_count: MetricData[];
}

const SupplyDemandDetail: React.FC = () => {
  const { region } = useParams<{ region: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [granularity, setGranularity] = useState('metro');
  const [availableRegions, setAvailableRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState(region || '');

  const granularityOptions = [
    { value: 'national', label: 'National' },
    { value: 'state', label: 'State' },
    { value: 'metro', label: 'Metropolitan Area' },
    { value: 'county', label: 'County' },
    { value: 'zip', label: 'ZIP Code' }
  ];

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await fetch(`${API_URL}/api/regions?granularity=${granularity}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAvailableRegions(data);
      } catch (err) {
        console.error('Error fetching regions:', err);
      }
    };

    fetchRegions();
  }, [granularity]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedRegion) return;
      
      setLoading(true);
      try {
        const response = await fetch(
          `${API_URL}/api/metrics/${granularity}/${encodeURIComponent(selectedRegion)}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setMetricsData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [granularity, selectedRegion]);

  const renderMetricChart = (
    title: string,
    data: MetricData[],
    yAxisLabel: string,
    percentageFormat: boolean = false
  ) => {
    if (!data || data.length === 0) return null;

    return (
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis
              yAxisId="left"
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
              tickFormatter={(value) => percentageFormat ? `${value}%` : value.toLocaleString()}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              label={{ value: 'Change %', angle: 90, position: 'insideRight' }}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'Change %') return `${value.toFixed(2)}%`;
                return percentageFormat ? `${value.toFixed(2)}%` : value.toLocaleString();
              }}
            />
            <Legend />
            <Bar
              yAxisId="right"
              dataKey="percentChange"
              fill="#ffc658"
              name="Change %"
              opacity={0.5}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="current"
              stroke="#8884d8"
              name="Current"
              dot={false}
              strokeWidth={3}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="historical"
              stroke="#82ca9d"
              name="Pre-Pandemic Average"
              dot={false}
              strokeWidth={3}
            />
          </ComposedChart>
        </ResponsiveContainer>
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
        <Typography variant="h4">Supply-Demand Analysis</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => navigate('/supply-demand')}
        >
          Back to Summary
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <Autocomplete
          value={granularityOptions.find(opt => opt.value === granularity) || null}
          onChange={(_, newValue) => {
            if (newValue) {
              setGranularity(newValue.value);
              setSelectedRegion('');
            }
          }}
          options={granularityOptions}
          getOptionLabel={(option) => option.label}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Geographic Level"
              variant="outlined"
              sx={{ minWidth: 200 }}
            />
          )}
          sx={{ minWidth: 200 }}
        />

        <Autocomplete
          value={availableRegions.find(r => r.name === selectedRegion) || null}
          onChange={(_, newValue) => {
            if (newValue && typeof newValue !== 'string') {
              setSelectedRegion(newValue.name);
            }
          }}
          options={availableRegions}
          getOptionLabel={(option) => {
            if (typeof option === 'string') return option;
            return option.name;
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Region"
              variant="outlined"
              sx={{ minWidth: 300 }}
            />
          )}
          sx={{ minWidth: 300 }}
          freeSolo
          filterOptions={(options, { inputValue }) => {
            const inputValueLower = inputValue.toLowerCase();
            return options.filter(option => 
              option.name.toLowerCase().includes(inputValueLower)
            );
          }}
        />
      </Box>

      {metricsData && (
        <Paper elevation={3} sx={{ p: 3 }}>
          {renderMetricChart(
            'Active Listings',
            metricsData.active_listing_count,
            'Number of Listings'
          )}
          
          {renderMetricChart(
            'Pending Listings',
            metricsData.pending_listing_count,
            'Number of Listings'
          )}
          
          {renderMetricChart(
            'Supply-Demand Ratio (Pending/Active)',
            metricsData.pending_ratio,
            'Ratio',
            true
          )}
          
          {renderMetricChart(
            'Median Days on Market',
            metricsData.median_days_on_market,
            'Days'
          )}
          
          {renderMetricChart(
            'Price Reduced Listings',
            metricsData.price_reduced_count,
            'Number of Listings'
          )}
          
          <Box sx={{ mt: 4 }}>
            <Typography variant="body2" color="textSecondary">
              * Current data shows the trailing 12 months metrics
            </Typography>
            <Typography variant="body2" color="textSecondary">
              * Pre-pandemic average is calculated using monthly data from 2016-2019
            </Typography>
            <Typography variant="body2" color="textSecondary">
              * Change % shows the percentage difference between current and pre-pandemic levels
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default SupplyDemandDetail; 