import React, { useState, useEffect } from "react";
import "bootswatch/dist/slate/bootstrap.min.css"; // bootswatch theme
import WebAudioFontPlayer from "webaudiofont";

import Button from "react-bootstrap/Button";
import Image from "react-bootstrap/Image";
import CustomSongModal from "./CustomSongModal";
import { ParseMidi } from "./CustomSongModal";

import sampleSong from "./midis/bluejam";

const App = () => {
  const [song, setSong] = useState(null); // this is currentMidi with instrument info added

  const [audioContext, setAudioContext] = useState(null);
  const [player, setPlayer] = useState(null);
  const [input, setInput] = useState(null);
  const [songTime, setSongTime] = useState(0);
  const [muteTracks, setMuteTracks] = useState([]); // muteTracks[id] true: not playing false: playing

  const [selectedTrack, setSelectedTrack] = useState(null); // the track that the user will play
  const [startPlaying, setStartPlaying] = useState(false);

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

  // This will load the sample musics, I know this is disgusting hardcoded, but I don't know how to make it better
  const initSampleSongs = () => {
    if (!audioContext || !player) {
      return;
    }
    setSong(ParseMidi(sampleSong, player, audioContext));
    const userTrackId = 0; // hard coding this
    const muteTracks = new Array(sampleSong.tracks.length + 1); // last element for percussions
    muteTracks.fill(false);
    muteTracks[userTrackId] = true;
    setMuteTracks(muteTracks);
    setSelectedTrack(sampleSong.tracks[userTrackId]);
  };
  useEffect(initSampleSongs, [audioContext, player]);

  return (
    <div>
      <div style={{ textAlign: "center" }}>
        <div>
          <CustomSongModal
            setSong={setSong}
            audioContext={audioContext}
            player={player}
            setMuteTracks={setMuteTracks}
            song={song}
            muteTracks={muteTracks}
            setSelectedTrack={setSelectedTrack}
          />
        </div>
        <br />
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
      return;
    }

    let currentTime = track.notes[noteIdx].when;
    const envContainer = [];
    let curNoteIdx = noteIdx;
    // the while loops it to play chords if multiple notes are firing at the same time
    while (
      track.notes[curNoteIdx] &&
      currentTime === track.notes[curNoteIdx].when
    ) {
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
      <div
        style={{
          width: "100%",
          height: "50em",
          marginBottom: "1em",
        }}
        className={noselect}
        onMouseDown={playNote}
        onTouchStart={playNote}
        onMouseUp={stopNote}
        onTouchEnd={stopNote}
      >
        <div>
          <Image
            fluid
            src="https://media1.tenor.com/images/4fbdf5a686e9c241e8f56d06c8902241/tenor.gif?itemid=17529094"
          />
          <h4 style={{ marginTop: "1em" }}>Press anywhere</h4>
          <h6 style={{ marginTop: "1em" }}>
            and keep on pressing to chill with the beats
          </h6>
        </div>
      </div>
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

  // const stopPlay = () => {
  //   if (songStart === 0 && !playing) {
  //     return;
  //   }

  //   clearInterval(playing);
  //   player.cancelQueue(audioContext); // this stops anything that's already playing
  //   setPlaying(false);
  //   setSongStart(0);
  // };
  // useEffect(stopPlay, [
  //   playing,
  //   player,
  //   setPlaying,
  //   setSongStart,
  //   audioContext,
  //   songStart,
  // ]);

  // use props to trigger if we should play the song or not
  useEffect(() => {
    const play = () => {
      if (song === null || !audioContext) {
        console.log("not ready");
        return;
      }
      console.log("Playing");

      setSongStart(audioContext.currentTime + 0.001);
      setCurrentSongTime(0);
      setNextStepTime(audioContext.currentTime);
      setCurrentTime(audioContext.currentTime);
      const playingId = setInterval(() => {
        setCurrentTime(audioContext.currentTime);
      }, 44);
      setPlaying(playingId);
    };

    if (startPlaying) {
      play();
    }
  }, [startPlaying, audioContext, song]);

  const songLoop = () => {
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
              v,
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

    if (songStart === 0) {
      return; // play hasn't been pressed yet
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
      if (currentSongTime > song.duration) {
        const nextCurrentSongTime = currentSongTime - song.duration;
        setCurrentSongTime(nextCurrentSongTime);
        sendNotes(song, songStart, 0, nextCurrentSongTime, player);
        const nextSongStart = songStart + song.duration;
        setSongStart(nextSongStart);
      }
    }
    setSongTime(currentSongTime.toFixed(2));
  };
  useEffect(songLoop, [
    audioContext,
    input,
    muteTracks,
    song,
    songStart,
    nextStepTime,
    currentSongTime,
    currentTime,
    player,
    setSongTime,
    stepDuration,
    playing,
  ]);

  if (song === null) {
    return <p>no song selected</p>;
  }

  return <div></div>;
};

export default App;
