import React from "react";
import ReactDOM from "react-dom/client";
import ControlRoomApp from "./ControlRoomApp.js";
import "../styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ControlRoomApp />
  </React.StrictMode>,
);
