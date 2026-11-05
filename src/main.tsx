import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PublicListingPage from "./PublicListingPage";
import "./styles.css";

const propertyId = new URLSearchParams(window.location.search).get("property");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {propertyId === null ? <App /> : <PublicListingPage propertyId={propertyId} />}
  </React.StrictMode>,
);
