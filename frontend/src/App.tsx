import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Container, Box, Button } from '@mui/material';
import MedianPriceChart from './components/MedianPriceChart';
import PriceChangeTable from './components/PriceChangeTable';
import SupplyDemandSummary from './components/SupplyDemandSummary';
import SupplyDemandDetail from './components/SupplyDemandDetail';
import AffordabilitySummary from './components/AffordabilitySummary';
import AffordabilityDetail from './components/AffordabilityDetail';

const App: React.FC = () => {
  return (
    <Router>
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Real Estate Analytics
            </Typography>
            <Button color="inherit" component={Link} to="/">
              Price Trends
            </Button>
            <Button color="inherit" component={Link} to="/supply-demand">
              Supply-Demand
            </Button>
            <Button color="inherit" component={Link} to="/affordability">
              Affordability
            </Button>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <Routes>
            <Route path="/" element={
              <>
                <MedianPriceChart />
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h5" gutterBottom>
                    Largest Price Changes
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        Top Increases
                      </Typography>
                      <PriceChangeTable type="increase" />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        Top Decreases
                      </Typography>
                      <PriceChangeTable type="decrease" />
                    </Box>
                  </Box>
                </Box>
              </>
            } />
            <Route path="/supply-demand" element={<SupplyDemandSummary />} />
            <Route path="/supply-demand/:region" element={<SupplyDemandDetail />} />
            <Route path="/affordability" element={<AffordabilitySummary />} />
            <Route path="/affordability/:region" element={<AffordabilityDetail />} />
          </Routes>
        </Container>
      </Box>
    </Router>
  );
};

export default App;
