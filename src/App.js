import React, { useState, useEffect, useRef } from "react";
import logo from "./logo.svg";
import "./App.css";
import MIDIFile from "./MIDIFile";
import WebAudioFontPlayer from "webaudiofont";

const App = () => {
  const [currentMidi, setCurrentMidi] = useState(null);
  const [playing, setPlaying] = useState(false); //tracks the id for current instance
  const fileSelectRef = useRef(null); // This is used to reset the file after uploading

  const [audioContext, setAudioContext] = useState(null);
  const [player, setPlayer] = useState(null);
  const [input, setInput] = useState(null);

  const [userTrack, setUserTrack] = useState(null);
  const [initialized, setInitialized] = useState(false);

  const initAudio = () => {
    const AudioContextFunc = window.AudioContext || window.webkitAudioContext;
    const newContext = new AudioContextFunc();
    const newPlayer = new WebAudioFontPlayer();
    const reverberator = newPlayer.createReverberator(newContext);
    reverberator.output.connect(newContext.destination);
    const newInput = reverberator.input;

    setAudioContext(newContext);
    setPlayer(newPlayer);
    setInput(newInput);
  };
  useEffect(initAudio, []);

  const selectFile = async (e) => {
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = async (e) => {
      const midi = new MIDIFile(e.target.result);
      setCurrentMidi(await midi.parseSong());
    };
    reader.readAsArrayBuffer(e.target.files[0]);
  };

  // Loads the instruments and reset the uploader
  useEffect(() => {
    if (currentMidi === null || !fileSelectRef) {
      return;
    }
    setInitialized(false);
    const song = currentMidi;
    for (let i = 0; i < song.tracks.length; i++) {
      let nn = player.loader.findInstrument(song.tracks[i].program);
      let info = player.loader.instrumentInfo(nn);
      song.tracks[i].info = info; // this is mutating state, but its nested so doesn't trigger rerendering and its bit easier this way
      song.tracks[i].id = nn;
      player.loader.startLoad(audioContext, info.url, info.variable);
    }
    for (let i = 0; i < song.beats.length; i++) {
      let nn = player.loader.findDrum(song.beats[i].n); // n its the percussion type
      let info = player.loader.drumInfo(nn);
      song.beats[i].info = info;
      song.beats[i].id = nn;
      player.loader.startLoad(audioContext, info.url, info.variable);
    }
    player.loader.waitLoad(function () {
      console.log("Finished loading instruments");
      setInitialized(true);
    });

    fileSelectRef.current.value = null; // clear the file so every upload is new
  }, [currentMidi, fileSelectRef, player, audioContext]);

  const stopPlay = () => {
    clearInterval(playing);
    player.cancelQueue(audioContext); // this stops anything that's already playing
    setPlaying(false);
  };

  const play = () => {
    if (currentMidi === null) {
      console.log("not ready");
      return;
    }
    stopPlay();
    const song = currentMidi;
    const songStart = audioContext.currentTime;
    const stepDuration = 44 / 1000; // 44ms notes to play;

    let currentTime = songStart;
    let currentSongTime = 0;
    let nextStepTime = songStart;

    const playingId = setInterval(() => {
      if (currentTime > nextStepTime - stepDuration) {
        sendNotes(
          song,
          songStart,
          currentSongTime,
          currentSongTime + stepDuration,
          player
        );
        currentSongTime += stepDuration;
        nextStepTime += stepDuration;
      }
      currentTime = audioContext.currentTime;

      if (currentTime > songStart + song.duration) {
        stopPlay();
      }
    }, 22);
    setPlaying(playingId);
  };

  // Helper to play the note at certain time frame, we can't load all of the notes at once because it won't play either memory issue or w/e
  // so work around is to just play them one time frame at a time.
  const sendNotes = (song, songStart, start, end, player) => {
    for (let t = 0; t < song.tracks.length; t++) {
      const track = song.tracks[t];
      for (let i = 0; i < track.notes.length; i++) {
        // this can probably be optimized by poping already played notes so don't have to loop through them all the time, welp next time
        if (track.notes[i].when >= start && track.notes[i].when < end) {
          const when = songStart + track.notes[i].when;
          const duration = track.notes[i].duration;
          if (duration > 3) {
            duration = 3;
          }
          const instr = track.info.variable;
          const v = track.volume / 7;

          player.queueWaveTable(
            audioContext,
            input,
            window[instr], // window contains all the zone information for the instruments, seems to be configs to make it sound better, it is populated during loading
            when,
            track.notes[i].pitch,
            duration,
            v,
            track.notes[i].slides
          );
        }
      }
    }
    // same as above but for beats
    for (let b = 0; b < song.beats.length; b++) {
      const beat = song.beats[b];
      for (let i = 0; i < beat.notes.length; i++) {
        if (beat.notes[i].when >= start && beat.notes[i].when < end) {
          const when = songStart + beat.notes[i].when;
          const duration = 1.5;
          const instr = beat.info.variable;
          const v = beat.volume / 2;
          player.queueWaveTable(
            audioContext,
            input,
            window[instr],
            when,
            beat.n,
            duration,
            v
          );
        }
      }
    }
  };

  return (
    <div className="App">
      {console.log(currentMidi)}
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <input
          type="file"
          onChange={selectFile}
          accept=".mid"
          ref={fileSelectRef}
        />
        <button onClick={() => play()}>Play</button>
        {initialized && (
          <>
            {console.log({ initialized })}
            <Instruments song={currentMidi} setUserTrack={setUserTrack} />
            <UserControl
              audioContext={audioContext}
              input={input}
              player={player}
              track={userTrack}
            />
          </>
        )}
      </header>
    </div>
  );
};

const Instruments = (props) => {
  const { song, setUserTrack } = props;
  if (!song || !song.tracks[0].info) {
    return null;
  }

  const { tracks, beats } = song;

  const instrumentButtons = tracks.map((ins) => (
    <button key={ins.id} onClick={() => setUserTrack(ins)}>
      {ins.info.title}
    </button>
  ));

  const percussionButtons = beats.map((ins) => (
    <button key={ins.id}>{ins.info.title}</button>
  ));

  return (
    <div>
      <h2>Instruments</h2>
      {instrumentButtons}
      <h2>Percussions</h2>
      {percussionButtons}
    </div>
  );
};

const UserControl = (props) => {
  const { audioContext, input, track, player } = props;

  if (!track || !audioContext || !player) {
    return <p>Not ready</p>;
  }

  console.log({ track });

  const instr = track.info.variable;
  const v = track.volume / 7;

  let noteIdx = 0;
  let envelope = null;
  const playNote = (event) => {
    event.preventDefault();
    if (noteIdx > track.notes.length) {
      noteIdx = 0;
    }
    envelope = player.queueWaveTable(
      audioContext,
      input,
      window[instr], // window contains all the zone information for the instruments, seems to be configs to make it sound better, it is populated during loading
      0,
      track.notes[noteIdx].pitch,
      999,
      v,
      track.notes[noteIdx].slides
    );
    noteIdx += 1;
  };

  const stopNote = (event) => {
    event.preventDefault();
    if (envelope) {
      envelope.cancel();
      envelope = null;
    }
  };

  const noselect = {
    "-webkit-touch-callout": "none" /* iOS Safari */,
    "-webkit-user-select": "none" /* Safari */,
    "-khtml-user-select": "none" /* Konqueror HTML */,
    "-moz-user-select": "none" /* Old versions of Firefox */,
    "-ms-user-select": "none" /* Internet Explorer/Edge */,
    "user-select":
      "none" /* Non-prefixed version, currently
                                    supported by Chrome, Edge, Opera and Firefox */,
  };
  return (
    <button
      style={{ width: "30em" }}
      className={noselect}
      onMouseDown={playNote}
      onTouchStart={playNote}
      onMouseUp={stopNote}
      onTouchEnd={stopNote}
    >
      next note
    </button>
  );
};

export default App;
