import { HashRouter as Router, Routes, Route } from "react-router-dom";
import WelcomeScreen from "./pages/screens/WelcomeScreen";
import SetupScreen from "./pages/screens/SetupScreen";
import SocialSignin from "./pages/screens/SocialSignin";
import Recovery from "./pages/screens/Recovery";
import HomeScreen from "./pages/screens/HomeScreen";
import ManageRoles from "./pages/screens/ManageRoles";
import ManageProfiles from "./pages/screens/ManageProfiles";
import ManagesubAccounts from "./pages/screens/ManagesubAccounts";
import DeveloperTools from "./pages/screens/DeveloperTools";
import ConnecteddApps from "./pages/screens/ConnecteddApps";
import SwigWallet from "./pages/screens/SwigWallet";
import ForgotPassword from "./pages/screens/ForgotPassword";
import History from "./pages/screens/History";
import PermissionsRequest from "./pages/screens/PermissionsRequest";
import TransactionRequest from "./pages/screens/TransactionRequest";
import WalletConnectionRequest from "./pages/screens/WalletConnectionRequest";
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SwigWallet />} />
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route path="/setup-wallet" element={<SetupScreen />} />
        <Route path="/social-signin" element={<SocialSignin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/recover-wallet" element={<Recovery />} />
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/manage-roles" element={<ManageRoles />} />
        <Route path="/manage-profiles" element={<ManageProfiles />} />
        <Route path="/manage-subaccounts" element={<ManagesubAccounts />} />
        <Route path="/developer-tools" element={<DeveloperTools />} />
        <Route path="/connected-dapps" element={<ConnecteddApps />} />
        <Route path="/history" element={<History />} />
        <Route path="/permissions-request" element={<PermissionsRequest />} />
        <Route path="/transaction-request" element={<TransactionRequest />} />
        <Route path="/connect-wallet" element={<WalletConnectionRequest />} />
      </Routes>
    </Router>
  );
};

export default App;
