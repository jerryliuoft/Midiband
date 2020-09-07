import React, { useState, useEffect, useRef } from "react";
import "bootswatch/dist/slate/bootstrap.min.css"; // bootswatch theme
import MIDIFile from "./MIDIFile";
import WebAudioFontPlayer from "webaudiofont";

import * as firebase from "firebase/app";
import "firebase/database";

import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import { useParams } from "react-router-dom";

const App = (props) => {
  const { roomid } = useParams();

  const [song, setSong] = useState(null); // this is currentMidi with instrument info added

  const [audioContext, setAudioContext] = useState(null);
  const [player, setPlayer] = useState(null);
  const [input, setInput] = useState(null);
  const [songTime, setSongTime] = useState(0);
  const [muteTracks, setMuteTracks] = useState([]); // muteTracks[id] true: not playing false: playing

  const [selectedTrack, setSelectedTrack] = useState(null); // the track that the user will play
  const [startPlaying, setStartPlaying] = useState(false);

  const setTrack = (id) => {
    const muteTracksTmp = [...muteTracks];
    muteTracksTmp.fill(false); // need to unmute everything else
    muteTracksTmp[id] = true;
    setMuteTracks(muteTracksTmp);
    setSelectedTrack(song.tracks[id]);
  };

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

  const stopPlaying = () => {
    setStartPlaying(false);
    setSongTime(0);
  };

  return (
    <div>
      <div
        style={{
          marginBottom: "0.5em",
          marginTop: "0.5em",
          display: "flex",
          justifyContent: "space-evenly",
        }}
      >
        <UploadMidi
          setSong={setSong}
          audioContext={audioContext}
          player={player}
          setMuteTracks={setMuteTracks}
          stopPlaying={stopPlaying}
          roomid={roomid}
        />
        <InstrumentOptions
          setMuteTracks={setMuteTracks}
          song={song}
          muteTracks={muteTracks}
        />
      </div>
      <br />
      <div style={{ textAlign: "center" }}>
        {roomid && <div>Room Id : {roomid}</div>}
        <div>{songTime}</div>
        {startPlaying && <Button onClick={stopPlaying}>Stop playing</Button>}
        <AddATrack song={song} setTrack={setTrack} />
        <PlaySong
          startPlaying={startPlaying}
          song={song}
          audioContext={audioContext}
          input={input}
          player={player}
          setSongTime={setSongTime}
          muteTracks={muteTracks}
        />
        <UserControl
          audioContext={audioContext}
          input={input}
          player={player}
          track={selectedTrack}
          songTime={songTime}
          setStartPlaying={setStartPlaying}
        />
      </div>
    </div>
  );
};

const UploadMidi = (props) => {
  const {
    player,
    audioContext,
    setSong,
    setMuteTracks,
    stopPlaying,
    roomid,
  } = props;

  const [currentMidi, setCurrentMidi] = useState(null); // this is original midi
  const fileSelectRef = useRef(null); // This is used to reset the file after uploading
  const [database, setDatabase] = useState(null);

  const initFirebase = () => {
    if (!roomid) {
      return;
    }
    const firebaseConfig = {
      apiKey: "AIzaSyA_W8Bj7I5H-MfMDRUh9r1gmPeAx08ujQI",
      authDomain: "midiband-eba3a.firebaseapp.com",
      databaseURL: "https://midiband-eba3a.firebaseio.com",
      projectId: "midiband-eba3a",
      storageBucket: "midiband-eba3a.appspot.com",
      messagingSenderId: "189588713562",
      appId: "1:189588713562:web:cf4434fa21acc453752863",
      measurementId: "G-0VKW0716HN",
    };
    firebase.initializeApp(firebaseConfig);
    const firebaseDatabase = firebase.database();
    setDatabase(firebaseDatabase);
    firebaseDatabase.ref(roomid + "/").on("value", (snapshot) => {
      if (snapshot.val()) {
        console.log({ snapshot: snapshot.val() });
        const midi = snapshot.val().midi;
        if (midi.beats) {
          // firebase removes empty array so we added it back in here
          setCurrentMidi(snapshot.val().midi);
        } else {
          setCurrentMidi({ ...snapshot.val().midi, beats: [] });
        }
      }
    });
  };
  useEffect(initFirebase, [roomid]);

  const shareSongWithEveryone = () => {
    if (!roomid || !currentMidi || !database) {
      return;
    }
    console.log({ currentMidi });
    database.ref(roomid + "/").set({ midi: currentMidi });
  };
  useEffect(shareSongWithEveryone, [roomid, currentMidi]);

  const selectFile = async (e) => {
    e.preventDefault();
    stopPlaying();
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
    audioContext.resume(); // on reload midi, ^ might not run cuz there's no more instrument to load

    setSong(currentMidi);
    const muteTracks = new Array(currentMidi.tracks.length + 1); // last element for percussions
    muteTracks.fill(false);
    setMuteTracks(muteTracks);
    console.log({ currentMidi });
    setCurrentMidi(null);
    fileSelectRef.current.value = null; // clear the file so every upload is new
  }, [currentMidi, fileSelectRef, player, audioContext]);

  return (
    <div>
      <Button onClick={() => fileSelectRef.current.click()}>
        Upload a new midi
      </Button>
      <input
        type="file"
        onChange={selectFile}
        accept=".mid"
        ref={fileSelectRef}
        style={{ display: "none" }}
      />
    </div>
  );
};

const UserControl = (props) => {
  const {
    audioContext,
    input,
    player,
    songTime,
    track,
    setStartPlaying,
  } = props;
  const [noteIdx, setNoteIdx] = useState(0);
  const [envelopes, setEnvelopes] = useState([]);
  const [tickDisplay, setTickDisplay] = useState("Press me to start");

  // update tick display when songTime changes
  useEffect(() => {
    if (!track || !track.sheet) {
      return;
    }
    // find tick and display it
    const tickIdx = Math.floor(songTime * 10);
    setTickDisplay("->" + track.sheet.slice(tickIdx, tickIdx + 30).join(""));
    // reset the note if song got reset
    if (songTime === 0) {
      setNoteIdx(0);
      setTickDisplay("Press me to start");
    }
  }, [songTime, track]);

  if (!audioContext || !player || !track) {
    return <p>Not ready</p>;
  }

  const playNote = (event) => {
    event.preventDefault();
    setStartPlaying(true);
    if (!track.info) {
      return;
    }

    if (songTime === 0 && track.notes[0].when > 0.5) {
      // When user first press play note, and the first note is not in the begining don't play the note
      return;
    }

    const instr = track.info.variable;
    const v = track.volume / 7;

    if (noteIdx >= track.notes.length - 1) {
      setNoteIdx(0);
    }

    let currentTime = track.notes[noteIdx].when;
    const envContainer = [];
    let curNoteIdx = noteIdx;
    // the while loops it to play chords if multiple notes are firing at the same time
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

  const fastForwardNoteIdxToPlayTime = () => {
    let nextNote = noteIdx;

    while (track.notes[nextNote].when < songTime) {
      nextNote += 1;
    }
    setNoteIdx(nextNote);
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
      <Button
        style={{
          width: "90%",
          height: "10em",
          marginLeft: "1em",
          marginRight: "1em",
          marginBottom: "1em",
        }}
        variant="outline-info"
        className={noselect}
        onMouseDown={playNote}
        onTouchStart={playNote}
        onMouseUp={stopNote}
        onTouchEnd={stopNote}
      >
        {tickDisplay}
      </Button>
      <Button onClick={() => fastForwardNoteIdxToPlayTime()}>
        Press me if you are out of sync
      </Button>
    </div>
  );
};

const PlaySong = (props) => {
  const [playing, setPlaying] = useState(false); //tracks the id for current instance
  const {
    song,
    audioContext,
    player,
    input,
    setSongTime,
    muteTracks,
    startPlaying,
  } = props;

  // song loop required variables
  const [currentSongTime, setCurrentSongTime] = useState(0);
  const [songStart, setSongStart] = useState(0);
  const [nextStepTime, setNextStepTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const stepDuration = 44 / 1000; // 44ms notes to play;

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

  // use props to trigger if we should play the song or not
  useEffect(() => {
    if (startPlaying) {
      play();
    } else {
      if (playing) {
        stopPlay();
      }
    }
  }, [startPlaying]);

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

      if (muteTracks[t]) {
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
            v / 5, // i'm dividing by 5 so that the instrument player is playing is louder
            track.notes[i].slides
          );
        }
      }
    }
    if (muteTracks[muteTracks.length - 1]) {
      // last element marks percussion, if true we don't do any percussions
      return;
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

  if (song === null) {
    return <p>no song selected</p>;
  }

  return <div></div>;
};

const InstrumentOptions = (props) => {
  const { setMuteTracks, song, muteTracks } = props;
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);
  let tracks = [];
  if (song) {
    tracks = song.tracks;
  }
  const instrumentButtons = tracks.map((ins, idx) => (
    <Button
      variant="outline-success"
      key={idx}
      active={!muteTracks[idx]}
      style={{ marginBottom: "0.5em", marginRight: "0.5em" }}
      onClick={() =>
        setMuteTracks(() => {
          const newState = [...muteTracks];
          newState[idx] = !muteTracks[idx];
          return newState;
        })
      }
    >
      {ins.info.title}
    </Button>
  ));
  return (
    <>
      <Button variant="primary" onClick={handleShow}>
        Track Options
      </Button>

      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Enable/disable playback</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Button
            variant="outline-warning"
            style={{ marginBottom: "0.5em", marginRight: "0.5em" }}
            onClick={() =>
              setMuteTracks(() => {
                const newState = [...muteTracks];
                newState.fill(true);
                return newState;
              })
            }
          >
            Mute all
          </Button>
          {instrumentButtons}
          <Button
            active={!muteTracks[muteTracks.length - 1]}
            style={{ marginBottom: "0.5em", marginRight: "0.5em" }}
            variant="outline-success"
            onClick={() =>
              setMuteTracks(() => {
                const newState = [...muteTracks];
                newState[muteTracks.length - 1] = !muteTracks[
                  muteTracks.length - 1
                ];
                return newState;
              })
            }
          >
            Percussions
          </Button>
        </Modal.Body>
      </Modal>
    </>
  );
};

const AddATrack = (props) => {
  const { song, setTrack } = props;
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);

  let tracks = [];
  if (song) {
    tracks = song.tracks;
  }
  const instrumentButtons = tracks.map((ins, idx) => (
    <Button
      variant="secondary"
      key={idx}
      style={{ marginBottom: "0.5em", marginRight: "0.5em" }}
      onClick={() => {
        setTrack(idx);
        handleClose();
      }}
    >
      {ins.info.title}
    </Button>
  ));

  if (!song) {
    return null;
  }
  return (
    <div>
      <Button onClick={() => setShow(true)} style={{ marginBottom: "1em" }}>
        Pick a track
      </Button>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Enable/disable playback</Modal.Title>
        </Modal.Header>
        <Modal.Body>{instrumentButtons}</Modal.Body>
      </Modal>
    </div>
  );
};

export default App;
