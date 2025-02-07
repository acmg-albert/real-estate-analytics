import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Grid } from '@mui/material';
import MedianPriceChart from '../components/MedianPriceChart';
import PriceChangeTable from '../components/PriceChangeTable';

const Home: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          US Real Estate Market Analysis
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <MedianPriceChart />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Top 10 Markets with Highest Price Increase (YoY)
            </Typography>
            <PriceChangeTable type="increase" />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Top 10 Markets with Highest Price Decrease (YoY)
            </Typography>
            <PriceChangeTable type="decrease" />
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default Home; 