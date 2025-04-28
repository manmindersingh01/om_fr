import React, { useState } from "react";
import { Link } from "react-router-dom";

const Home = () => {
  const [name, setName] = useState("");

  return (
    <div className="home-container">
      <h1>Welcome to Video Chat</h1>
      <div className="home-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="name-input"
        />
        <Link
          to={`/room?name=${encodeURIComponent(name)}`}
          className={`room-link ${!name.trim() ? "disabled" : ""}`}
        >
          Join Room
        </Link>
      </div>
    </div>
  );
};
export default Home;
