import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

interface AffordabilityData {
  region: string;
  homeownerAffordability: number | null;
  renterAffordability: number | null;
  affordabilityGap: number | null;
}

interface AffordabilityResponse {
  leastAffordable: AffordabilityData[];
  mostAffordable: AffordabilityData[];
}

const AffordabilitySummary: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AffordabilityResponse | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching affordability data...');
        const response = await fetch(`${API_URL}/api/affordability-summary`);
        console.log('API response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error:', errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log('Received data:', responseData);
        
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

  const columns: GridColDef[] = [
    {
      field: 'region',
      headerName: 'Metropolitan Area',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <div
          style={{ cursor: 'pointer', color: '#1976d2' }}
          onClick={() => navigate(`/affordability/${encodeURIComponent(String(params.value))}`)}
        >
          {params.value}
        </div>
      )
    },
    {
      field: 'homeownerAffordability',
      headerName: 'Homeowner Affordability (%)',
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams) => {
        const value = params.value as number | null;
        if (value === null || isNaN(value)) return '';
        return `${(value * 100).toFixed(2)}%`;
      }
    },
    {
      field: 'renterAffordability',
      headerName: 'Renter Affordability (%)',
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams) => {
        const value = params.value as number | null;
        if (value === null || isNaN(value)) return '';
        return `${(value * 100).toFixed(2)}%`;
      }
    },
    {
      field: 'affordabilityGap',
      headerName: 'Affordability Gap (%)',
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams) => {
        const value = params.value as number | null;
        if (value === null || isNaN(value)) return '';
        const formattedValue = `${(value * 100).toFixed(2)}%`;
        return (
          <div style={{ 
            color: value > 0 ? '#d32f2f' : '#2e7d32',
            fontWeight: 'bold'
          }}>
            {formattedValue}
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
        Housing Affordability Analysis
      </Typography>
      
      <Typography variant="body1" paragraph>
        This analysis compares homeowner and renter affordability across metropolitan areas. 
        Homeowner affordability is calculated as the monthly mortgage payment (20% down payment) as a percentage of household income. 
        Renter affordability is calculated as the monthly rent payment as a percentage of household income.
        Click on any metropolitan area to view detailed affordability trends.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => navigate('/affordability/United States')}
          sx={{ mr: 2 }}
        >
          View National Trends
        </Button>
      </Box>
      
      {/* Least Affordable Markets */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Top 10 Least Affordable Housing Markets
      </Typography>
      <Box sx={{ height: '400px', width: '100%', mb: 4 }}>
        <DataGrid
          rows={data.leastAffordable.map((market, index) => ({ id: index, ...market }))}
          columns={columns}
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

      {/* Most Affordable Markets */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Top 10 Most Affordable Housing Markets
      </Typography>
      <Box sx={{ height: '400px', width: '100%', mb: 4 }}>
        <DataGrid
          rows={data.mostAffordable.map((market, index) => ({ id: index, ...market }))}
          columns={columns}
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

export default AffordabilitySummary; 