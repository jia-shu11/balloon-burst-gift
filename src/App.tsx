import { Link, Route, Routes } from "react-router-dom";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="page">
      <h1>{title}</h1>
      <p>Balloon Burst Gift is loading this space.</p>
      <Link to="/">返回首页</Link>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<PlaceholderPage title="Balloon Burst Gift" />} />
      <Route path="/gift/:inviteToken" element={<PlaceholderPage title="制作气球礼物" />} />
      <Route path="/manage/:manageToken" element={<PlaceholderPage title="管理礼物房间" />} />
      <Route path="/r/:recipientToken" element={<PlaceholderPage title="收礼现场" />} />
    </Routes>
  );
}
