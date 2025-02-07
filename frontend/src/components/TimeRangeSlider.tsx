import React from 'react';
import { Slider } from '@mui/material';
import { AffordabilityMetric } from '../types/affordability';

interface Props {
  data: AffordabilityMetric[];
  value: [string, string];
  onChange: (range: [string, string]) => void;
}

const TimeRangeSlider: React.FC<Props> = ({ data, value, onChange }) => {
  // 将日期转换为索引
  const getIndexFromDate = (date: string) => {
    return data.findIndex(d => d.month === date);
  };

  // 将索引转换为日期
  const getDateFromIndex = (index: number) => {
    return data[index]?.month || '';
  };

  // 当前值的索引
  const currentValue: [number, number] = [
    getIndexFromDate(value[0]),
    getIndexFromDate(value[1])
  ];

  // 处理滑块变化
  const handleChange = (_event: Event, newValue: number | number[]) => {
    const [start, end] = newValue as number[];
    onChange([getDateFromIndex(start), getDateFromIndex(end)]);
  };

  return (
    <div style={{
      margin: '20px 40px',
      padding: '0 10px'
    }}>
      <Slider
        value={currentValue}
        onChange={handleChange}
        min={0}
        max={data.length - 1}
        step={1}
        marks={[
          { value: 0, label: data[0]?.month || '' },
          { value: data.length - 1, label: data[data.length - 1]?.month || '' }
        ]}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => getDateFromIndex(value)}
      />
    </div>
  );
};

export default TimeRangeSlider; 