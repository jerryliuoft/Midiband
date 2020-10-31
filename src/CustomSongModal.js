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
    stopPlaying,
    song,
    muteTracks,
    setTrack,
  } = props;
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
      <Button variant="primary" onClick={handleShow}>
        Options
      </Button>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>
            Upload your own midi file, try google midi to find them{" "}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <UploadMidi
            setSong={setSong}
            audioContext={audioContext}
            player={player}
            setMuteTracks={setMuteTracks}
            stopPlaying={stopPlaying}
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

const UploadMidi = (props) => {
  const { player, audioContext, setSong, setMuteTracks, stopPlaying } = props;

  const [currentMidi, setCurrentMidi] = useState(null); // this is original midi
  const fileSelectRef = useRef(null); // This is used to reset the file after uploading

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
