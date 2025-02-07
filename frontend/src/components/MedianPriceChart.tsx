import React, { useState, useEffect } from 'react';
import { Box, Paper, FormControl, Slider, Autocomplete, TextField } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { API_URL } from '../config';

interface PriceData {
  date: string;
  allHomes: number | null;
  sfrOnly: number | null;
  region?: string;
}

interface RawData {
  [key: string]: string;
}

const processData = (allHomesData: string, sfrOnlyData: string): PriceData[] => {
  if (!allHomesData || !sfrOnlyData) {
    console.error('Missing data input');
    return [];
  }

  // Parse CSV data with proper handling of quoted fields
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
    const parseCSV = (csv: string): RawData[] => {
      const lines = csv.split('\n').filter(line => line.trim().length > 0);
      if (lines.length === 0) {
        console.error('No data lines found in CSV');
        return [];
      }

      const headers = parseCSVLine(lines[0]);
      console.log('Headers:', headers);
      
      return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        if (values.length !== headers.length) {
          console.warn('Skipping malformed line:', line);
          return null;
        }

        const rowData: RawData = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index];
        });
        return rowData;
      }).filter((row): row is RawData => row !== null);
    };

    const allHomesRows = parseCSV(allHomesData);
    const sfrOnlyRows = parseCSV(sfrOnlyData);

    if (allHomesRows.length === 0 || sfrOnlyRows.length === 0) {
      console.error('No valid data rows found');
      return [];
    }

    // Get all date columns (excluding metadata columns)
    const dateColumns = Object.keys(allHomesRows[0]).filter(key => 
      !['RegionID', 'RegionName', 'RegionType', 'StateName', 'SizeRank'].includes(key) &&
      /^\d{4}-\d{2}-\d{2}$/.test(key)
    ).sort();

    if (dateColumns.length === 0) {
      console.error('No date columns found in:', Object.keys(allHomesRows[0]));
      return [];
    }

    console.log('Available date columns:', dateColumns);

    // 创建一个映射来存储每个地区的数据
    const regionData: { [key: string]: PriceData[] } = {};

    // 处理每个地区的数据
    allHomesRows.forEach((row, index) => {
      const region = row['RegionName'];
      if (!region || !sfrOnlyRows[index]) return;

      if (!regionData[region]) {
        regionData[region] = [];
      }

      dateColumns.forEach(date => {
        const allHomesValue = Number(row[date]);
        const sfrValue = Number(sfrOnlyRows[index][date]);

        if (!isNaN(allHomesValue) && !isNaN(sfrValue) && allHomesValue > 0 && sfrValue > 0) {
          regionData[region].push({
            date,
            allHomes: allHomesValue,
            sfrOnly: sfrValue,
            region
          });
        }
      });
    });

    // 将所有地区的数据合并到一个数组中
    const processedData: PriceData[] = Object.values(regionData).flat();
    console.log('Processed data sample:', processedData.slice(0, 5));
    
    return processedData;
  } catch (error) {
    console.error('Error processing CSV data:', error);
    return [];
  }
};

const MedianPriceChart: React.FC = () => {
  const [data, setData] = useState<PriceData[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('United States');
  const [regions, setRegions] = useState<string[]>(['United States']);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const [allDates, setAllDates] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/zillow-data`);
        const data = await response.json();

        if (!data.allHomes || !data.sfrOnly) {
          console.error('No data received');
          return;
        }

        console.log('Received data samples:', {
          allHomes: data.allHomes.substring(0, 200),
          sfrOnly: data.sfrOnly.substring(0, 200)
        });

        const processedData = processData(data.allHomes, data.sfrOnly);
        setData(processedData);

        // Extract unique dates and regions
        const dates = Array.from(new Set(processedData.map(d => d.date))).sort();
        setAllDates(dates);
        
        // Filter out undefined regions and ensure all regions are strings
        const uniqueRegions = Array.from(new Set(processedData.map(d => d.region)))
          .filter((region): region is string => typeof region === 'string' && region.length > 0)
          .sort();
        setRegions(uniqueRegions);

        // Set initial region to United States if available
        if (uniqueRegions.includes('United States')) {
          setSelectedRegion('United States');
        } else if (uniqueRegions.length > 0) {
          setSelectedRegion(uniqueRegions[0]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleRegionChange = (_event: React.SyntheticEvent, newValue: string | null) => {
    if (newValue) {
      setSelectedRegion(newValue);
    }
  };

  const handleTimeRangeChange = (_event: Event, newValue: number | number[]) => {
    setTimeRange(newValue as [number, number]);
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // 修改过滤数据的逻辑
  const filteredData = React.useMemo(() => {
    if (!selectedRegion || !allDates.length) return [];
    
    const regionData = data.filter(d => d.region === selectedRegion);
    const sortedData = regionData.sort((a, b) => a.date.localeCompare(b.date));
    
    const startIndex = Math.floor((timeRange[0] / 100) * (allDates.length - 1));
    const endIndex = Math.floor((timeRange[1] / 100) * (allDates.length - 1));
    
    return sortedData.slice(startIndex, endIndex + 1);
  }, [data, selectedRegion, timeRange, allDates]);

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth>
          <Autocomplete
            value={selectedRegion}
            onChange={handleRegionChange}
            options={regions}
            renderInput={(params) => (
              <TextField {...params} label="Region" placeholder="Search or select a region" />
            )}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <Box 
                  component="li" 
                  key={key} 
                  {...otherProps}
                  sx={{ 
                    whiteSpace: 'normal',
                    wordWrap: 'break-word'
                  }}
                >
                  {option}
                </Box>
              );
            }}
            disableClearable
            ListboxProps={{
              style: { maxHeight: 300 }
            }}
          />
        </FormControl>
      </Box>

      <Box sx={{ position: 'relative', height: 450 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredData}
            margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date"
              interval="preserveStartEnd"
              minTickGap={50}
              height={40}
            />
            <YAxis tickFormatter={formatPrice} />
            <Tooltip 
              formatter={formatPrice}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="allHomes"
              stroke="#8884d8"
              name="All Homes"
              connectNulls
              strokeWidth={3}
            />
            <Line
              type="monotone"
              dataKey="sfrOnly"
              stroke="#82ca9d"
              name="SFR Only"
              connectNulls
              strokeWidth={3}
            />
          </LineChart>
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
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => {
              const dateIndex = Math.floor((value / 100) * (allDates.length - 1));
              return allDates[dateIndex] || '';
            }}
            sx={{
              '& .MuiSlider-thumb': {
                height: 20,
                width: 20,
              },
              '& .MuiSlider-rail': {
                height: 8,
              },
              '& .MuiSlider-track': {
                height: 8,
              },
            }}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default MedianPriceChart; 