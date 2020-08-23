import React, { useState, useEffect, useRef } from "react";
import logo from "./logo.svg";
import "./App.css";
import MIDISounds from "midi-sounds-react";
import MIDIFile from "./MIDIFile";

const App = () => {
  const [currentMidi, setCurrentMidi] = useState(null);
  const fileSelectRef = useRef(null); // This is used to reset the file after uploading
  const midiSoundRef = useRef(null); // This is the component that make the sound

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
    if (!midiSoundRef || currentMidi === null || !fileSelectRef) {
      return;
    }
    const song = currentMidi;
    const player = midiSoundRef.current;

    for (let i = 0; i < song.tracks.length; i++) {
      player.cacheInstrument(song.tracks[i].program);
    }
    for (let i = 0; i < song.beats.length; i++) {
      player.cacheDrum(song.beats[i].n);
    }

    fileSelectRef.current.value = null; // clear the file so every upload is new
  }, [currentMidi, midiSoundRef, fileSelectRef]);

  const play = () => {
    if (currentMidi === null) {
      midiSoundRef.current.playChordNow(3, [60], 3);
      return;
    }
    const player = midiSoundRef.current;
    const song = currentMidi;
    const songStart = player.contextTime();
    const stepDuration = 44 / 1000; // 44ms notes to play;

    let currentTime = player.contextTime();
    let currentSongTime = 0;
    let nextStepTime = currentTime;
    while (currentTime < songStart + song.duration) {
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
      currentTime = player.contextTime();
    }
  };

  // Helper to play the note at certain time frame, we can't load all of the notes at once because it won't play either memory issue or w/e
  // so work around is to just play them one time frame at a time.
  const sendNotes = (song, songStart, start, end, player) => {
    for (let t = 0; t < song.tracks.length; t++) {
      let track = song.tracks[t];
      for (let i = 0; i < track.notes.length; i++) {
        // this can probably be optimized by poping already played notes so don't have to loop through them all the time, welp next time
        if (track.notes[i].when >= start && track.notes[i].when < end) {
          let when = songStart + track.notes[i].when;
          let duration = track.notes[i].duration;
          if (duration > 3) {
            duration = 3;
          }
          let instr = track.program;
          player.playChordAt(when, instr, [track.notes[i].pitch], duration);
        }
      }
    }
    // same as above but for beats
    for (let b = 0; b < song.beats.length; b++) {
      let beat = song.beats[b];
      for (let i = 0; i < beat.notes.length; i++) {
        if (beat.notes[i].when >= start && beat.notes[i].when < end) {
          let when = songStart + beat.notes[i].when;
          let instr = beat.n;
          console.log({ when, instr });
          player.playDrumsAt(when, [instr]);
        }
      }
    }
  };

  return (
    <div className="App">
      {console.log(currentMidi)}
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <small style={{ fontSize: "14px" }}>Hi</small>
        <input
          type="file"
          onChange={selectFile}
          accept=".mid"
          ref={fileSelectRef}
        />
        <button onClick={() => play()}>Play</button>
        <MIDISounds
          ref={midiSoundRef}
          appElementName="root"
          instruments={[3]}
        />
      </header>
    </div>
  );
};

export default App;
