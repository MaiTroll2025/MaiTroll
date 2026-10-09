import React from 'react';
import {Navigate} from 'react-router-dom';

const Cashouts = () => {
  // Redirect to the new cashout request page
  return <Navigate to="/cashout-request" replace />;
};

export default Cashouts;
