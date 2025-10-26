import "./App.module.css";
import { Routes, Route } from "react-router-dom";
import { Header, Footer } from "./components/layout";
import Home from "./pages/Home";
import VaultBuilder from "./pages/VaultBuilder";
import Dashboard from "./pages/Dashboard";
import Debugger from "./pages/Debugger.tsx";

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/builder" element={<VaultBuilder />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/debug" element={<Debugger />} />
          <Route path="/debug/:contractName" element={<Debugger />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
