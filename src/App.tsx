/* eslint-disable react-hooks/exhaustive-deps */
// Reference: https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/pc1/js/main.js
import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import VideoStream from "./VideoStream";

const socketUrl = "mywebsocketserver";

type peerMessageType = "offer" | "answer" | "iceCandidate";

type peerMessage = {
  senderConnectionId: string;
  messageType: peerMessageType;
  message: string;
};

const configuration = {
  iceServers: [
    {
      urls: "stun:mystunserver",
    },
    {
      urls: "turn:myturnserver",
      username: "username",
      credential: "password",
    },
  ],
};

const connectionOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};

function App() {
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [remoteConnectionId, setRemoteConnectionId] = useState<string>("");
  const [inCall, setInCall] = useState<boolean>(false);
  const localConnection = useRef<RTCPeerConnection>(
    new RTCPeerConnection(configuration)
  );
  const webSocket = useRef<WebSocket | null>(null);

  useEffect(() => {
    // https://blog.logrocket.com/responsive-camera-component-react-hooks/
    if (!localStream) {
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .then((s) => setLocalStream(s))
        .catch((err) => console.log(err));
    } else {
      return () =>
        localStream.getTracks().forEach((track) => {
          track.stop();
        });
    }
  }, [localStream]);

  useEffect(() => {
    localConnection.current.oniceconnectionstatechange = (ev) =>
      console.log(ev);
    localConnection.current.onicecandidateerror = (err) => console.error(err);
    localConnection.current.ontrack = (trackEvent) => onPeerStream(trackEvent);
    updateListeners();

    // let dataChannel = localConnection.createDataChannel("dataChannel");

    webSocket.current = new WebSocket(socketUrl);
    webSocket.current.addEventListener("open", (_ev) => {
      console.log("Socket connection opened.");
      webSocket.current?.send("");
    });
    webSocket.current.addEventListener("close", (_ev) => {
      console.log("Socket connection closed.");
    });

    return () => webSocket.current?.close();
  }, []);

  useEffect(() => {
    if (localConnection.current) updateListeners();

    if (webSocket.current) {
      webSocket.current.addEventListener("message", (messageEvent) => {
        if (!messageEvent.data) return;
        let response = JSON.parse(messageEvent.data);
        console.log(response);
        if (response.responseType === "defaultStatus") {
          // setLocalConnectionId(response.connectionId);
        } else if (response.responseType === "peerMessage") {
          handlePeerMessage(response);
        }
      });
    }
  }, [remoteConnectionId]);

  const updateListeners = () => {
    localConnection.current.onicecandidate = (iceEvent) => {
      sendPeerMessage(
        remoteConnectionId,
        "iceCandidate",
        JSON.stringify(iceEvent.candidate)
      );
    };
    localConnection.current.onnegotiationneeded = async () => {
      const localSessionDescription = await localConnection.current.createOffer(
        connectionOptions
      );
      if (localConnection.current.signalingState !== "stable") return;
      sendOffer(localSessionDescription);
    };
  };

  const handlePeerMessage = (peerMessage: peerMessage) => {
    console.log(peerMessage);
    setRemoteConnectionId(peerMessage.senderConnectionId);
    if (peerMessage.messageType === "offer") {
      onOffer(JSON.parse(peerMessage.message), peerMessage.senderConnectionId);
    } else if (peerMessage.messageType === "answer")
      onAnswer(JSON.parse(peerMessage.message));
    else if (peerMessage.messageType === "iceCandidate")
      onPeerIceCandidate(JSON.parse(peerMessage.message));
    else console.error("Invalid peer message type.");
  };

  const sendPeerMessage = (
    peerConnectionId: string,
    messageType: peerMessageType,
    message: string
  ) => {
    let messageBody = JSON.stringify({
      action: "peermessage",
      peerConnectionId: peerConnectionId,
      messageType: messageType,
      message: message,
    });
    console.log(messageBody);
    webSocket.current?.send(messageBody);
  };

  const onPeerIceCandidate = (
    iceCandidate: RTCIceCandidate,
    attempt: number = 0
  ) => {
    if (attempt > 0)
      console.log("Retrying ice candidate... Attempt " + attempt);
    localConnection
      .current.addIceCandidate(iceCandidate)
      .then(() => console.log("Successfully added peer ICE candidate"))
      .catch(async (err) => {
        console.error(`Could not add peer ICE candidate. ${err}`);
        // Retry up to two times
        if (attempt < 2)
          setTimeout(() => onPeerIceCandidate(iceCandidate, attempt + 1), 2000);
      });
  };

  const sendOffer = (sessionDescription: RTCSessionDescriptionInit) => {
    setInCall(true);
    localConnection
      .current.setLocalDescription(sessionDescription)
      .then(() => {
        console.log("setLocalDescription complete for local from local");
        // Send offer to remote peer
        sendPeerMessage(
          remoteConnectionId,
          "offer",
          JSON.stringify(sessionDescription)
        );
      })
      .catch((err) =>
        console.error(`Failed to set session description. ${err}`)
      );
  };

  const onOffer = (
    sessionDescription: RTCSessionDescriptionInit,
    peerConnectionId: string
  ) => {
    setInCall(true);
    localConnection
      .current.setRemoteDescription(sessionDescription)
      .then(() => {
        console.log("setLocalDescription complete for remote from local");
        localStream?.getTracks().forEach((track) => {
          console.log(track);
          localConnection.current.addTrack(track, localStream);
        });
        buildAnswer(peerConnectionId);
      })
      .catch((err) =>
        console.error(`Failed to set session description. ${err}`)
      );
  };

  const buildAnswer = (peerConnectionId: string) => {
    localConnection.current.onicecandidate = (iceEvent) => {
      sendPeerMessage(
        peerConnectionId,
        "iceCandidate",
        JSON.stringify(iceEvent.candidate)
      );
    };

    localConnection
      .current.createAnswer()
      .then((sessionDescription) => {
        localConnection
          .current.setLocalDescription(sessionDescription)
          .then(() => {
            console.log("setLocalDescription complete for local from local");
            sendPeerMessage(
              peerConnectionId,
              "answer",
              JSON.stringify(sessionDescription)
            );
          })
          .catch((err) =>
            console.error(`Failed to set session description. ${err}`)
          );
      })
      .catch((err) => console.error(`Failed to send answer. ${err}`));
  };

  const onAnswer = (sessionDescription: RTCSessionDescriptionInit) => {
    localConnection
      .current.setRemoteDescription(sessionDescription)
      .then(() =>
        console.log("setLocalDescription complete for remote from local")
      )
      .catch((err) =>
        console.error(`Failed to set session description. ${err}`)
      );
  };

  const onPeerStream = (trackEvent: RTCTrackEvent) => {
    console.log(trackEvent.streams);
    trackEvent.streams.forEach((s) => console.log(s));
    trackEvent.track.onunmute = () => {
      if (remoteStream !== trackEvent.streams[0]) {
        setRemoteStream(trackEvent.streams[0]);
        console.log("Receieved remote stream!");
      }
    };
  };

  const callPeer = () => {
    if (!localConnection.current) {
      console.error("Local peer connection not yet set up!");
      return;
    }

    // Should trigger on negotiation neeeded
    localStream?.getTracks().forEach((track) => {
      console.log(track);
      localConnection.current.addTrack(track, localStream);
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <input
          type="text"
          value={remoteConnectionId}
          onChange={(event) => setRemoteConnectionId(event.target.value)}
        />
        <button
          type="button"
          disabled={
            !localConnection.current ||
            !webSocket.current ||
            !remoteConnectionId ||
            inCall
          }
          onClick={() => callPeer()}
        >
          Call peer
        </button>
        {/*<button
          type="button"
          disabled={!localConnection || !socketConnected || !remoteConnectionId}
          onClick={() => buildAnswer(remoteConnectionId)}
        >
          Answer peer
        </button>*/}
        <div style={{ display: "flex" }}>
          <div style={{ flex: 1 }}>
            {localStream ? (
              <VideoStream srcObject={localStream} muted />
            ) : (
              <h4>Please enable your camera</h4>
            )}
          </div>
          <div style={{ flex: 1 }}>
            {remoteStream ? (
              <VideoStream srcObject={remoteStream} />
            ) : (
              <h4>No connection</h4>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
