import { setDefaultOptions } from "date-fns";
import { ko } from "date-fns/locale";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

setDefaultOptions({ locale: ko });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
