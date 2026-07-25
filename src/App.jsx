import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { StoreProvider } from './store';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import RigList from './components/RigList';
import GoodDeals from './components/GoodDeals';
import AutoRent from './components/AutoRent';
import MyRigs from './components/MyRigs';
import Rentals from './components/Rentals';
import Profit from './components/Profit';
import WorkerLog from './components/WorkerLog';
import Settings from './components/Settings';

export default function App() {
  return (
    <StoreProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/browse" element={<RigList />} />
          <Route path="/deals" element={<GoodDeals />} />
          <Route path="/auto-rent" element={<AutoRent />} />
          <Route path="/my-rigs" element={<MyRigs />} />
          <Route path="/rentals" element={<Rentals />} />
          <Route path="/profit" element={<Profit />} />
          <Route path="/logs" element={<WorkerLog />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </StoreProvider>
  );
}
