import { Canvas } from "./canvas/Canvas";
import { Sidebar } from "./sidebar/Sidebar";

function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-canvas">
        <Canvas />
      </main>
    </div>
  );
}

export default App;
