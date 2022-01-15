import { ApolloClient, ApolloProvider, InMemoryCache } from "@apollo/client";
import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { App as Slide2App } from "../slide-2-querying-on-the-frontend/components/App";
import { App as Slide3App } from "../slide-3-type-safety/components/App";
import { defaultTheme, GlobalStyles } from "./theme/theme";

const client = new ApolloClient({
  uri: "http://localhost:4000/graphql",
  cache: new InMemoryCache(),
});

ReactDOM.render(
  <ApolloProvider client={client}>
    <BrowserRouter>
      <ThemeProvider theme={defaultTheme}>
        <GlobalStyles />
        <Routes>
          <Route element={<Slide2App />} path="/slide-2" />
          <Route element={<Slide3App />} path="/slide-3" />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  </ApolloProvider>,
  document.getElementById("root"),
);
