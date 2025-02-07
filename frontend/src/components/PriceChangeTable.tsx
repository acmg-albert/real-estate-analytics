import React, { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Tooltip,
} from '@mui/material';

interface PriceChangeTableProps {
  type: 'increase' | 'decrease';
}

interface RegionChange {
  region: string;
  change: number;
  currentPrice: number;
  previousPrice: number;
}

const PriceChangeTable: React.FC<PriceChangeTableProps> = ({ type }) => {
  const [data, setData] = useState<RegionChange[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/zillow-data');
        const data = await response.json();
        
        if (!data.allHomes) {
          console.error('No data received from API');
          return;
        }

        console.log('Received data sample:', data.allHomes.substring(0, 200));
        const processedData = processData(data.allHomes);
        
        // Sort by change percentage
        const sortedData = processedData
          .filter(item => !isNaN(item.change)) // Filter out invalid changes
          .sort((a, b) => 
            type === 'increase' 
              ? b.change - a.change 
              : a.change - b.change
          );

        // Take top 10
        setData(sortedData.slice(0, 10));
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [type]);

  const processData = (csvData: string): RegionChange[] => {
    if (!csvData) {
      console.error('No CSV data provided');
      return [];
    }

    // Split CSV into lines, but handle quoted fields properly
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let inQuotes = false;
      let currentField = '';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        
        if (char === ',' && !inQuotes) {
          result.push(currentField.trim());
          currentField = '';
          continue;
        }
        
        currentField += char;
      }
      
      result.push(currentField.trim());
      return result;
    };

    try {
      // Split into lines and filter out empty lines
      const lines = csvData.split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length === 0) {
        console.error('No data lines found in CSV');
        return [];
      }

      // Parse headers
      const headers = parseCSVLine(lines[0]);
      console.log('Headers:', headers);
      
      // Find date columns (they should be in YYYY-MM-DD format)
      const dateColumns = headers.filter(header => 
        !['RegionID', 'RegionName', 'RegionType', 'StateName', 'SizeRank'].includes(header) &&
        /^\d{4}-\d{2}-\d{2}$/.test(header)
      ).sort();

      if (dateColumns.length === 0) {
        console.error('No date columns found in:', headers);
        return [];
      }

      // Get the last column (2024-11-30) and the same month last year (2023-11-30)
      const currentDate = dateColumns[dateColumns.length - 1];
      const [currentYear, currentMonth] = currentDate.split('-').map(Number);
      const yearAgoDate = dateColumns.find(date => {
        const [year, month] = date.split('-').map(Number);
        return month === currentMonth && year === currentYear - 1;
      });

      if (!yearAgoDate) {
        console.error('Could not find year-ago date for comparison');
        return [];
      }

      console.log('Processing data with dates:', {
        currentDate,
        yearAgoDate,
        currentDateIndex: headers.indexOf(currentDate),
        yearAgoDateIndex: headers.indexOf(yearAgoDate)
      });

      const results = lines.slice(1)
        .map(line => {
          const values = parseCSVLine(line);
          if (values.length !== headers.length) {
            console.warn('Skipping malformed line:', line);
            return null;
          }

          const regionNameIndex = headers.indexOf('RegionName');
          const currentPriceIndex = headers.indexOf(currentDate);
          const previousPriceIndex = headers.indexOf(yearAgoDate);

          if (regionNameIndex === -1 || currentPriceIndex === -1 || previousPriceIndex === -1) {
            console.warn('Required columns not found');
            return null;
          }

          const regionName = values[regionNameIndex];
          const currentPrice = Number(values[currentPriceIndex]);
          const previousPrice = Number(values[previousPriceIndex]);

          // Skip if either price is invalid or if it's the national average
          if (!currentPrice || !previousPrice || isNaN(currentPrice) || isNaN(previousPrice) || 
              regionName === 'United States') {
            return null;
          }

          const change = ((currentPrice - previousPrice) / previousPrice) * 100;

          // Skip if change is invalid or zero
          if (isNaN(change) || change === 0) {
            return null;
          }

          return {
            region: regionName,
            change,
            currentPrice,
            previousPrice,
          };
        })
        .filter((item): item is RegionChange => 
          item !== null && 
          !isNaN(item.change) && 
          item.currentPrice > 0 && 
          item.previousPrice > 0 &&
          Math.abs(item.change) > 0.01 // Filter out very small changes
        );

      console.log('Processed results:', results.length);
      return results;
    } catch (error) {
      console.error('Error processing CSV data:', error);
      return [];
    }
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: 'always',
    }).format(value / 100);
  };

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Region</TableCell>
            <TableCell align="right">YoY Change</TableCell>
            <TableCell align="right">Current Price</TableCell>
            <TableCell align="right">Previous Year</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.region}>
              <TableCell 
                component="th" 
                scope="row"
                sx={{
                  maxWidth: '200px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                <Tooltip title={row.region} placement="right">
                  <Box component="span" sx={{ cursor: 'help' }}>
                    {row.region}
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="right" sx={{
                color: row.change >= 0 ? 'success.main' : 'error.main',
                fontWeight: 'bold',
              }}>
                {formatPercentage(row.change)}
              </TableCell>
              <TableCell align="right">{formatPrice(row.currentPrice)}</TableCell>
              <TableCell align="right">{formatPrice(row.previousPrice)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PriceChangeTable; 