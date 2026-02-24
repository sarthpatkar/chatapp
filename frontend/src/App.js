import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import AiChat from "./pages/AiChat";
import Login from "./pages/Login";
import Register from "./pages/Register";

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

// Protected route wrapper
function PrivateRoute({ children }) {
  const user = getUser();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const user = getUser();

  return (
    <Router>
      <Routes>

        {/* Root redirect */}
        <Route
          path="/"
          element={
            user ? <Navigate to="/chat" replace /> : <Navigate to="/login" replace />
          }
        />

        {/* Auth pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected chat */}
        <Route
          path="/chat"
          element={
            <PrivateRoute>
              <AiChat />
            </PrivateRoute>
          }
        />

      </Routes>
    </Router>
  );
}