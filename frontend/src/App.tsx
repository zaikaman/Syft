import "./App.module.css";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { LandingHeader, Footer } from "./components/layout";
import Home from "./pages/Home";
import VaultBuilder from "./pages/VaultBuilder";
import Dashboard from "./pages/Dashboard";
import VaultDetail from "./pages/VaultDetail";
import AppLayout from "./layouts/AppLayout";

// Redirect component for vault details
const VaultRedirect = () => {
  const { vaultId } = useParams();
  return <Navigate to={`/app/vaults/${vaultId}`} replace />;
};

function App() {
  return (
    <Routes>
      {/* Landing Page Route */}
      <Route
        path="/"
        element={
          <div className="flex flex-col min-h-screen bg-app">
            <LandingHeader />
            <main className="flex-1 pt-16">
              <Home />
            </main>
            <Footer />
          </div>
        }
      />

      {/* Redirects for old routes */}
      <Route path="/builder" element={<Navigate to="/app/builder" replace />} />
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/vaults/:vaultId" element={<VaultRedirect />} />

      {/* App Routes with Sidebar Layout */}
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="builder" element={<VaultBuilder />} />
        <Route path="vaults/:vaultId" element={<VaultDetail />} />
      </Route>
    </Routes>
  );
}

export default App;
