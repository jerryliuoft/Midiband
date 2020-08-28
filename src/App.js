import React, { useState, useEffect, useRef } from "react";
import logo from "./logo.svg";
import "./App.css";
import MIDIFile from "./MIDIFile";
import WebAudioFontPlayer from "webaudiofont";

const App = () => {
  const [currentMidi, setCurrentMidi] = useState(null);
  const [playing, setPlaying] = useState(false); //tracks the id for current instance
  const fileSelectRef = useRef(null); // This is used to reset the file after uploading

  const [debugText, setDebug] = useState("nothing");

  const [audioContext, setAudioContext] = useState(null);
  const [player, setPlayer] = useState(null);
  const [input, setInput] = useState(null);
  const [instruments, setInstruments] = useState({}); // this will have the mappings program -> instrumentID info

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
    const song = currentMidi;
    const instruments = { tracks: {}, beats: {} };
    for (let i = 0; i < song.tracks.length; i++) {
      let nn = player.loader.findInstrument(song.tracks[i].program);
      let info = player.loader.instrumentInfo(nn);
      instruments.tracks[song.tracks[i].program] = {
        info: info,
        id: nn,
      };
      player.loader.startLoad(audioContext, info.url, info.variable);
    }
    for (let i = 0; i < song.beats.length; i++) {
      let nn = player.loader.findDrum(song.beats[i].n);
      let info = player.loader.drumInfo(nn);
      instruments.beats[song.beats[i].n] = {
        info: info,
        id: nn,
      };
      player.loader.startLoad(audioContext, info.url, info.variable);
    }
    player.loader.waitLoad(function () {
      console.log("Finished loading instruments");
    });

    setInstruments(instruments);
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
    console.log(song);
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
      let track = song.tracks[t];
      for (let i = 0; i < track.notes.length; i++) {
        // this can probably be optimized by poping already played notes so don't have to loop through them all the time, welp next time
        if (track.notes[i].when >= start && track.notes[i].when < end) {
          let when = songStart + track.notes[i].when;
          let duration = track.notes[i].duration;
          if (duration > 3) {
            duration = 3;
          }
          // let instr = track.info.variable;
          const instr = instruments.tracks[track.program].info.variable;
          let v = track.volume / 7;

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
      let beat = song.beats[b];
      for (let i = 0; i < beat.notes.length; i++) {
        if (beat.notes[i].when >= start && beat.notes[i].when < end) {
          let when = songStart + beat.notes[i].when;
          let duration = 1.5;
          // let instr = beat.info.variable;
          const instr = instruments.beats[beat.n].info.variable;

          let v = beat.volume / 2;
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
        <small style={{ fontSize: "14px" }}>{debugText}</small>
        <input
          type="file"
          onChange={selectFile}
          accept=".mid"
          ref={fileSelectRef}
        />
        <button onClick={() => play()}>Play</button>
      </header>
    </div>
  );
};

export default App;
