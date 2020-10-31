import React from "react";
import "bootswatch/dist/slate/bootstrap.min.css"; // bootswatch theme
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";

import Player from "./Player";
import Home from "./Home";

const App = (props) => {
  return (
    <div>
      <Router>
        <Link to="/">
          <h1
            style={{
              textAlign: "center",
              paddingTop: "2em",
              marginBottom: "1em",
            }}
          >
            Midiband
          </h1>
        </Link>
        <Switch>
          <Route exact path="/">
            <Home />
          </Route>
          <Route path="/solo">
            <Player />
          </Route>
          <Route path="/room/:roomid">
            <Player />
          </Route>
        </Switch>
      </Router>
    </div>
  );
};

export default App;
