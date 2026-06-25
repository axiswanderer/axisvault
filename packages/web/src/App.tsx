import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { useAutoLock } from "./hooks/useAutoLock";
import { SignupPage } from "./pages/SignupPage";
import { LoginPage } from "./pages/LoginPage";
import { LockScreen } from "./pages/LockScreen";
import { VaultPage } from "./pages/VaultPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ExportPage } from "./pages/ExportPage";
import { RequireUnlockedVault, RequireAuthenticated, RedirectIfAuthenticated } from "./components/RouteGuards";

function AutoLockMount() {
  useAutoLock();
  return null;
}

// Electron loads the app via file://, which has no server to resolve
// path-based routes like /vault on a refresh or deep link — HashRouter
// keeps all routing state in the URL fragment (#/vault), which file://
// handles natively. The web build keeps BrowserRouter for clean URLs.
// Both share the exact same <Routes> tree below. Decided at BUILD time
// (not via a runtime "is this Electron" check) so it's deterministic
// regardless of when/whether the preload bridge has attached.
const Router = import.meta.env.VITE_ROUTER_MODE === "hash" ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <AutoLockMount />
      <Routes>
        <Route
          path="/signup"
          element={
            <RedirectIfAuthenticated>
              <SignupPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/lock"
          element={
            <RequireAuthenticated>
              <LockScreen />
            </RequireAuthenticated>
          }
        />
        <Route
          path="/vault"
          element={
            <RequireUnlockedVault>
              <VaultPage />
            </RequireUnlockedVault>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireUnlockedVault>
              <SettingsPage />
            </RequireUnlockedVault>
          }
        />
        <Route
          path="/export"
          element={
            <RequireUnlockedVault>
              <ExportPage />
            </RequireUnlockedVault>
          }
        />
        <Route path="*" element={<RedirectIfAuthenticated><LoginPage /></RedirectIfAuthenticated>} />
      </Routes>
    </Router>
  );
}
