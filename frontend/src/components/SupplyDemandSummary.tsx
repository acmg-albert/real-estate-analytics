import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

interface MarketData {
  region: string;
  current: number;
  prePandemic: number;
  changePercentage?: number;  // 对于active listings
  pendingChange?: number;     // 对于pending listings
  ratioChange?: number;       // 对于ratio
}

interface MarketBalanceResponse {
  active: {
    top: MarketData[];
    bottom: MarketData[];
  };
  pending: {
    top: MarketData[];
    bottom: MarketData[];
  };
  ratio: {
    top: MarketData[];
    bottom: MarketData[];
  };
}

const SupplyDemandSummary: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MarketBalanceResponse | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Starting to fetch market balance data...');
        console.log('Using API URL:', API_URL);
        const response = await fetch(`${API_URL}/api/market-balance`);
        console.log('API response status:', response.status);
        console.log('API response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log('Successfully fetched market balance data');
        
        if (!responseData || typeof responseData !== 'object') {
          console.error('Invalid data format:', responseData);
          throw new Error('Invalid data format');
        }

        setData(responseData);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getColumns = (type: 'active' | 'pending' | 'ratio'): GridColDef[] => [
    {
      field: 'region',
      headerName: 'Region',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <div
          style={{ cursor: 'pointer', color: '#1976d2' }}
          onClick={() => navigate(`/supply-demand/${encodeURIComponent(String(params.value))}`)}
        >
          {params.value}
        </div>
      )
    },
    {
      field: 'current',
      headerName: type === 'ratio' ? 'Current Ratio' : 'Current Count',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => {
        const value = params.value as number;
        if (value == null || isNaN(value)) return '';
        return type === 'ratio' 
          ? value.toFixed(4)
          : value.toLocaleString();
      }
    },
    {
      field: 'prePandemic',
      headerName: type === 'ratio' ? 'Pre-Pandemic Ratio' : 'Pre-Pandemic Count',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => {
        const value = params.value as number;
        if (value == null || isNaN(value)) return '';
        return type === 'ratio'
          ? value.toFixed(4)
          : value.toLocaleString();
      }
    },
    {
      field: 'changePercentage',
      headerName: 'Change vs Pre-Pandemic (%)',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as MarketData;
        const value = type === 'active' ? row.changePercentage 
                    : type === 'pending' ? row.pendingChange 
                    : row.ratioChange;
        if (value == null || isNaN(value)) return '';
        return (
          <div style={{ 
            color: value > 0 ? '#2e7d32' : '#d32f2f',
            fontWeight: 'bold'
          }}>
            {`${value.toFixed(2)}%`}
          </div>
        );
      }
    }
  ];

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
        <Alert severity="warning">No data available</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Supply-Demand Balance Analysis
      </Typography>
      
      <Typography variant="body1" paragraph>
        This analysis compares the current supply and demand metrics with their pre-pandemic levels (2016-2019). 
        Click on any metropolitan area to view detailed supply-demand trends.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => navigate('/supply-demand/United States')}
          sx={{ mr: 2 }}
        >
          View Detailed Analysis
        </Button>
      </Box>
      
      {/* Active Listings Section */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Top 10 Markets with Largest Active Listings Changes
      </Typography>
      <Box sx={{ height: '400px', width: '100%', mb: 4 }}>
        <DataGrid
          rows={data.active.top.map((market, index) => ({ id: index, ...market }))}
          columns={getColumns('active')}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 }
            }
          }}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          autoHeight={false}
        />
      </Box>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Bottom 10 Markets with Largest Active Listings Changes
      </Typography>
      <Box sx={{ height: '400px', width: '100%', mb: 4 }}>
        <DataGrid
          rows={data.active.bottom.map((market, index) => ({ id: index, ...market }))}
          columns={getColumns('active')}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 }
            }
          }}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          autoHeight={false}
        />
      </Box>

      {/* Pending Listings Section */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Top 10 Markets with Largest Pending Listings Changes
      </Typography>
      <Box sx={{ height: '400px', width: '100%', mb: 4 }}>
        <DataGrid
          rows={data.pending.top.map((market, index) => ({ id: index, ...market }))}
          columns={getColumns('pending')}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 }
            }
          }}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          autoHeight={false}
        />
      </Box>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Bottom 10 Markets with Largest Pending Listings Changes
      </Typography>
      <Box sx={{ height: '400px', width: '100%', mb: 4 }}>
        <DataGrid
          rows={data.pending.bottom.map((market, index) => ({ id: index, ...market }))}
          columns={getColumns('pending')}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 }
            }
          }}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          autoHeight={false}
        />
      </Box>

      {/* Ratio Section */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Top 10 Markets with Largest Pending/Active Ratio Changes
      </Typography>
      <Box sx={{ height: '400px', width: '100%', mb: 4 }}>
        <DataGrid
          rows={data.ratio.top.map((market, index) => ({ id: index, ...market }))}
          columns={getColumns('ratio')}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 }
            }
          }}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          autoHeight={false}
        />
      </Box>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Bottom 10 Markets with Largest Pending/Active Ratio Changes
      </Typography>
      <Box sx={{ height: '400px', width: '100%', mb: 4 }}>
        <DataGrid
          rows={data.ratio.bottom.map((market, index) => ({ id: index, ...market }))}
          columns={getColumns('ratio')}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 }
            }
          }}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          autoHeight={false}
        />
      </Box>
    </Box>
  );
};

export default SupplyDemandSummary;