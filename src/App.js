import React from "react";
import "bootswatch/dist/slate/bootstrap.min.css"; // bootswatch theme

import Player from "./Player";

const App = () => {
  return (
    <div>
      <h1
        style={{
          textAlign: "center",
          paddingTop: "2em",
          marginBottom: "1em",
        }}
      >
        Midiband
      </h1>
      <Player />
    </div>
  );
};

export default App;
