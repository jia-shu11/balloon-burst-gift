import { Route, Routes } from "react-router-dom";
import { GiverPage } from "./pages/GiverPage";
import { HomePage } from "./pages/HomePage";
import { ManagePage } from "./pages/ManagePage";
import { RecipientPage } from "./pages/RecipientPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/gift/:inviteToken" element={<GiverPage />} />
      <Route path="/manage/:manageToken" element={<ManagePage />} />
      <Route path="/r/:recipientToken" element={<RecipientPage />} />
    </Routes>
  );
}
