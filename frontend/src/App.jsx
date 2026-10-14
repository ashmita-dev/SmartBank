import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import { LoadingState } from "./components/ui";
import Login from "./pages/Login";

// Pages are code-split so the customer portal does not download the
// charting library used only by the analyst dashboard.
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminTransactions = lazy(() => import("./pages/AdminTransactions"));
const AdminAlerts = lazy(() => import("./pages/AdminAlerts"));
const AdminAnalysts = lazy(() => import("./pages/AdminAnalysts"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const UserAccounts = lazy(() => import("./pages/UserAccounts"));
const UserTransactions = lazy(() => import("./pages/UserTransactions"));
const UserTransfer = lazy(() => import("./pages/UserTransfer"));
const UserSettings = lazy(() => import("./pages/UserSettings"));

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
      <AuthProvider>
        <Suspense fallback={<LoadingState text="Loading…" />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute allowedRole="admin" />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/transactions" element={<AdminTransactions />} />
              <Route path="/admin/alerts" element={<AdminAlerts />} />
              <Route path="/admin/analysts" element={<AdminAnalysts />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRole="user" />}>
            <Route element={<AppLayout />}>
              <Route path="/user" element={<UserDashboard />} />
              <Route path="/user/accounts" element={<UserAccounts />} />
              <Route path="/user/transactions" element={<UserTransactions />} />
              <Route path="/user/transfer" element={<UserTransfer />} />
              <Route path="/user/settings" element={<UserSettings />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;