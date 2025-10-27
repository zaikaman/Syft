import "./App.module.css";
import { Routes, Route, useLocation } from "react-router-dom";
import { Header, Footer } from "./components/layout";
import Home from "./pages/Home";
import VaultBuilder from "./pages/VaultBuilder";
import Dashboard from "./pages/Dashboard";
import VaultDetail from "./pages/VaultDetail";

function App() {
  const location = useLocation();
  const isBuilderPage = location.pathname === '/builder';

  return (
    <div className="flex flex-col min-h-screen bg-app">
      {!isBuilderPage && <Header />}
      <main className={`flex-1 ${!isBuilderPage ? 'pt-16' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/builder" element={<VaultBuilder />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vaults/:vaultId" element={<VaultDetail />} />
        </Routes>
      </main>
      {!isBuilderPage && <Footer />}
    </div>
  );
}

export default App;
