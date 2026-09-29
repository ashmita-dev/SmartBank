import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTransactions from "./pages/AdminTransactions";
import AdminAlerts from "./pages/AdminAlerts";
import AdminAnalysts from "./pages/AdminAnalysts";
import AdminSettings from "./pages/AdminSettings";
import UserDashboard from "./pages/UserDashboard";
import UserAccounts from "./pages/UserAccounts";
import UserTransactions from "./pages/UserTransactions";
import UserTransfer from "./pages/UserTransfer";
import UserSettings from "./pages/UserSettings";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute allowedRole="admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/transactions" element={<AdminTransactions />} />
            <Route path="/admin/alerts" element={<AdminAlerts />} />
            <Route path="/admin/analysts" element={<AdminAnalysts />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>

          <Route element={<ProtectedRoute allowedRole="user" />}>
            <Route path="/user" element={<UserDashboard />} />
            <Route path="/user/accounts" element={<UserAccounts />} />
            <Route path="/user/transactions" element={<UserTransactions />} />
            <Route path="/user/transfer" element={<UserTransfer />} />
            <Route path="/user/settings" element={<UserSettings />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;