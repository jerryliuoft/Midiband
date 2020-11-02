import React, { useState, useEffect, useRef } from "react";
import "bootswatch/dist/slate/bootstrap.min.css"; // bootswatch theme
import MIDIFile from "./MIDIFile";

import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

const CustomSongModal = (props) => {
  const {
    setSong,
    audioContext,
    player,
    setMuteTracks,
    song,
    muteTracks,
    setSelectedTrack,
  } = props;
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const setTrack = (id) => {
    // TODO this function is copied everywhere, probably need a way to move them all use this somehow
    const muteTracksTmp = [...muteTracks];
    muteTracksTmp.fill(false); // need to unmute everything else
    muteTracksTmp[id] = true;
    setMuteTracks(muteTracksTmp);
    setSelectedTrack(song.tracks[id]);
  };

  return (
    <>
      <Button variant="primary" onClick={handleShow}>
        Options
      </Button>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>
            Upload your own midi file, try google midi to find them
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <UploadMidi
            setSong={setSong}
            audioContext={audioContext}
            player={player}
            setMuteTracks={setMuteTracks}
            setSelectedTrack={setSelectedTrack}
          />
          <InstrumentOptions
            setMuteTracks={setMuteTracks}
            song={song}
            muteTracks={muteTracks}
          />
          <AddATrack song={song} setTrack={setTrack} />
        </Modal.Body>
      </Modal>
    </>
  );
};

export default CustomSongModal;

// Takes Midi file and convert it to the format we can send it to the envelopes
export const ParseMidi = (midi, player, audioContext) => {
  for (let i = 0; i < midi.tracks.length; i++) {
    let nn = player.loader.findInstrument(midi.tracks[i].program);
    let info = player.loader.instrumentInfo(nn);
    midi.tracks[i].info = info; // this is mutating state, but its fine because i'm setting state at the end to a new variable, and midi is wiped
    midi.tracks[i].id = nn;
    player.loader.startLoad(audioContext, info.url, info.variable);
  }
  for (let i = 0; i < midi.beats.length; i++) {
    let nn = player.loader.findDrum(midi.beats[i].n); // n its the percussion type
    let info = player.loader.drumInfo(nn);
    midi.beats[i].info = info;
    midi.beats[i].id = nn;
    player.loader.startLoad(audioContext, info.url, info.variable);
  }

  // Create "beat sheet for the tracks"
  const timeGap = 0.1; //seconds
  for (let i = 0; i < midi.tracks.length; i += 1) {
    let sheet = new Array(Math.ceil(midi.duration / timeGap));
    sheet.fill(".");
    for (let j = 0; j < midi.tracks[i].notes.length; j += 1) {
      const when = midi.tracks[i].notes[j].when;
      sheet[Math.floor(when / timeGap)] = "|";
    }
    midi.tracks[i].sheet = sheet;
  }

  player.loader.waitLoad(function () {
    audioContext.resume(); // it gets paused sometimes
    console.log("Finished loading instruments");
  });
  audioContext.resume(); // on reload midi, ^ might not run cuz there's no more instrument to load

  // console.log(JSON.stringify(midi));
  return midi;
};

const UploadMidi = (props) => {
  const {
    player,
    audioContext,
    setSong,
    setMuteTracks,
    setSelectedTrack,
  } = props;

  const [currentMidi, setCurrentMidi] = useState(null); // this is original midi
  const fileSelectRef = useRef(null); // This is used to reset the file after uploading

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

    setSong(ParseMidi(currentMidi, player, audioContext));
    const muteTracks = new Array(currentMidi.tracks.length + 1); // last element for percussions
    muteTracks.fill(false);
    muteTracks[0] = true;
    setMuteTracks(muteTracks);
    setCurrentMidi(null);
    setSelectedTrack(currentMidi.tracks[0]);
    fileSelectRef.current.value = null; // clear the file so every upload is new
  }, [currentMidi, fileSelectRef, player, audioContext]);

  return (
    <div>
      <Button onClick={() => fileSelectRef.current.click()}>Upload midi</Button>
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
          <Modal.Title>
            Click on the instrument you would like to play
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>{instrumentButtons}</Modal.Body>
      </Modal>
    </div>
  );
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
    <div>
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
    </div>
  );
};
