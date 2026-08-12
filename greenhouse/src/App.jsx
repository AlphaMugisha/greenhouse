import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Errors from "./pages/Errors";

// Client-side routing: moving between the dashboard, the history and
// the error log never reloads the page or drops the realtime channels.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/history" element={<History />} />
      <Route path="/errors" element={<Errors />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
