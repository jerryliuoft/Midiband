import React, { useState, useEffect, useRef } from "react";
import logo from "./logo.svg";
import "./App.css";
import MIDIFile from "./MIDIFile";
import WebAudioFontPlayer from "webaudiofont";

const App = () => {
  const [currentMidi, setCurrentMidi] = useState(null); // this is original midi
  const [song, setSong] = useState(null); // this is currentMidi with instrument info added
  const fileSelectRef = useRef(null); // This is used to reset the file after uploading

  const [audioContext, setAudioContext] = useState(null);
  const [player, setPlayer] = useState(null);
  const [input, setInput] = useState(null);
  const [songTime, setSongTime] = useState(0);

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
    for (let i = 0; i < currentMidi.tracks.length; i++) {
      let nn = player.loader.findInstrument(currentMidi.tracks[i].program);
      let info = player.loader.instrumentInfo(nn);
      currentMidi.tracks[i].info = info; // this is mutating state, but its fine because i'm setting state at the end to a new variable, and currentmidi is wiped
      currentMidi.tracks[i].id = nn;
      player.loader.startLoad(audioContext, info.url, info.variable);
    }
    for (let i = 0; i < currentMidi.beats.length; i++) {
      let nn = player.loader.findDrum(currentMidi.beats[i].n); // n its the percussion type
      let info = player.loader.drumInfo(nn);
      currentMidi.beats[i].info = info;
      currentMidi.beats[i].id = nn;
      player.loader.startLoad(audioContext, info.url, info.variable);
    }

    // Create "beat sheet for the tracks"
    const timeGap = 0.1; //seconds
    for (let i = 0; i < currentMidi.tracks.length; i += 1) {
      let sheet = new Array(Math.ceil(currentMidi.duration / timeGap));
      sheet.fill(".");
      for (let j = 0; j < currentMidi.tracks[i].notes.length; j += 1) {
        const when = currentMidi.tracks[i].notes[j].when;
        sheet[Math.floor(when / timeGap)] = "|";
      }
      currentMidi.tracks[i].sheet = sheet;
    }

    player.loader.waitLoad(function () {
      audioContext.resume(); // it gets paused sometimes
      console.log("Finished loading instruments");
    });

    setSong(currentMidi);
    console.log({ currentMidi });
    setCurrentMidi(null);
    fileSelectRef.current.value = null; // clear the file so every upload is new
  }, [currentMidi, fileSelectRef, player, audioContext]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <input
          type="file"
          onChange={selectFile}
          accept=".mid"
          ref={fileSelectRef}
        />
        <br />
        {songTime}
        <PlaySong
          song={song}
          audioContext={audioContext}
          input={input}
          player={player}
          setSongTime={setSongTime}
        />
        <UserControl
          audioContext={audioContext}
          input={input}
          player={player}
          song={song}
          songTime={songTime}
        />
      </header>
    </div>
  );
};

const UserControl = (props) => {
  const { audioContext, input, song, player, songTime } = props;
  const [track, setTrack] = useState({});
  const [noteIdx, setNoteIdx] = useState(0);
  const [envelopes, setEnvelopes] = useState([]);
  const [tickDisplay, setTickDisplay] = useState("");

  // update tick display when songTime changes
  useEffect(() => {
    if (!song || !track.sheet) {
      return;
    }
    // find tick and display it
    const tickIdx = Math.floor(songTime * 10);
    setTickDisplay(track.sheet.slice(tickIdx, tickIdx + 30).join(""));
  }, [song, songTime, track]);

  if (!audioContext || !player || song === null) {
    return <p>Not ready</p>;
  }

  const instButtons = () => {
    return song.tracks.map((ins, idx) => (
      <button key={idx} onClick={() => setTrack(ins)}>
        {ins.info.title}
      </button>
    ));
  };

  const playNote = (event) => {
    event.preventDefault();

    const instr = track.info.variable;
    const v = track.volume / 7;

    if (noteIdx >= track.notes.length - 1) {
      setNoteIdx(0);
    }

    let currentTime = track.notes[noteIdx].when;
    const envContainer = [];
    let curNoteIdx = noteIdx;
    while (currentTime === track.notes[curNoteIdx].when) {
      const envelope = player.queueWaveTable(
        audioContext,
        input,
        window[instr], // window contains all the zone information for the instruments, seems to be configs to make it sound better, it is populated during loading
        0,
        track.notes[curNoteIdx].pitch,
        999,
        v,
        track.notes[curNoteIdx].slides
      );
      envContainer.push(envelope);
      curNoteIdx += 1;
    }
    setEnvelopes(envContainer);
    setNoteIdx(curNoteIdx);
  };

  const stopNote = (event) => {
    event.preventDefault();
    if (envelopes.length > 0) {
      envelopes.forEach((env) => env.cancel());
      setEnvelopes([]);
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
    <div>
      <br></br>
      {instButtons()}
      <br></br>
      {tickDisplay}
      <br></br>
      <button
        style={{ width: "30em", height: "10em" }}
        className={noselect}
        onMouseDown={playNote}
        onTouchStart={playNote}
        onMouseUp={stopNote}
        onTouchEnd={stopNote}
      >
        next note
      </button>
      <button onClick={() => setNoteIdx(0)}>reset note idx</button>
    </div>
  );
};

const PlaySong = (props) => {
  const [playing, setPlaying] = useState(false); //tracks the id for current instance
  const { song, audioContext, player, input, setSongTime } = props;
  const [muteTrack, setMuteTrack] = useState([]);

  // song loop required variables
  const [currentSongTime, setCurrentSongTime] = useState(0);
  const [songStart, setSongStart] = useState(0);
  const [nextStepTime, setNextStepTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const stepDuration = 44 / 1000; // 44ms notes to play;

  const initMuteTracks = () => {
    if (song === null) {
      setMuteTrack([]);
      return;
    }

    setMuteTrack(new Array(song.tracks.length));
  };
  useEffect(initMuteTracks, [song]);

  const stopPlay = () => {
    clearInterval(playing);
    player.cancelQueue(audioContext); // this stops anything that's already playing
    setPlaying(false);
    setSongStart(0);
  };

  const play = () => {
    if (song === null) {
      console.log("not ready");
      return;
    }
    if (playing) {
      stopPlay();
    }
    console.log("Playing");

    setSongStart(audioContext.currentTime);
    setCurrentSongTime(0);
    setNextStepTime(audioContext.currentTime);
    setCurrentTime(audioContext.currentTime);
    const playingId = setInterval(() => {
      setCurrentTime(audioContext.currentTime);
    }, 44);
    setPlaying(playingId);
  };

  const songLoop = () => {
    if (songStart === 0) {
      return; // play hasn't been pressed yet
    }

    if (currentTime >= songStart + song.duration) {
      stopPlay();
      return;
    }
    if (currentTime > nextStepTime - stepDuration) {
      sendNotes(
        song,
        songStart,
        currentSongTime,
        currentSongTime + stepDuration,
        player
      );
      setCurrentSongTime((prev) => prev + stepDuration);
      setNextStepTime((prev) => prev + stepDuration);
    }
    setSongTime(currentSongTime.toFixed(2));
  };
  useEffect(songLoop, [
    song,
    songStart,
    nextStepTime,
    currentSongTime,
    currentTime,
  ]);

  // Helper to play the note at certain time frame, we can't load all of the notes at once because it won't play either memory issue or w/e
  // so work around is to just play them one time frame at a time.
  const sendNotes = (song, songStart, start, end, player) => {
    for (let t = 0; t < song.tracks.length; t++) {
      const track = song.tracks[t];

      if (muteTrack[t]) {
        continue;
      }

      for (let i = 0; i < track.notes.length; i++) {
        // this can probably be optimized by poping already played notes so don't have to loop through them all the time, welp next time
        if (track.notes[i].when >= start && track.notes[i].when < end) {
          const when = songStart + track.notes[i].when;
          let duration = track.notes[i].duration;
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

  const instrumentOptions = () => {
    const instrumentButtons = song.tracks.map((ins, idx) => (
      <button
        key={idx}
        onClick={() =>
          setMuteTrack(() => {
            const newState = [...muteTrack];
            newState[idx] = !muteTrack[idx];
            return newState;
          })
        }
      >
        {ins.info.title} {muteTrack[idx] ? "muted" : "active"}
      </button>
    ));
    return instrumentButtons;
  };

  if (song === null) {
    return <p>no song selected</p>;
  }

  return (
    <div>
      {instrumentOptions()}
      <br />
      <button onClick={() => play()}>Play</button>
      <button onClick={() => stopPlay()}>Stop</button>
    </div>
  );
};

export default App;
