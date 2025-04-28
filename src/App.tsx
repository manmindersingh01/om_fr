import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Landing from "./components/Landing";
import Room from "./components/Room";
import Home from "./components/Home";

const App = () => {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/room"
            element={
              <Room name="" localAudioTrack={null} localVideoTrack={null} />
            }
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
