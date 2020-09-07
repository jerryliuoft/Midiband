import React, { useState } from "react";
import "bootswatch/dist/slate/bootstrap.min.css"; // bootswatch theme

import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";

import { Link } from "react-router-dom";

const Home = (props) => {
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const [roomId, setRoomId] = useState("");

  return (
    <div>
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div>
          <Link to="/solo">
            <Button>Solo</Button>
          </Link>{" "}
          <Link
            to={() => {
              const roomId = Math.random().toString(32).slice(2, 8);
              return "/room/" + roomId;
            }}
          >
            <Button>Create</Button>
          </Link>{" "}
          <Button onClick={handleShow}>Join</Button>
        </div>
      </div>
      <Modal show={show} onHide={handleClose}>
        <Modal.Body>
          <Form>
            <Form.Label>Room Id</Form.Label>
            <Form.Control
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Link to={"/room/" + roomId}>
            <Button variant="secondary" onClick={handleClose}>
              Go
            </Button>
          </Link>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Home;
