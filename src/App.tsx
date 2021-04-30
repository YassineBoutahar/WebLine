/* eslint-disable react-hooks/exhaustive-deps */
// Reference: https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/pc1/js/main.js
import React, { useEffect, useRef, useState } from "react";
import randomwords from "random-words";
import "./App.css";
import VideoStream from "./VideoStream";

const socketUrl = "mywebsocketserver";

type peerMessageType =
  | "offer"
  | "answer"
  | "iceCandidate"
  | "callRequest"
  | "callAccept"
  | "callReject";

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
  const [peerUsername, setPeerUsername] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [calling, setCalling] = useState<boolean>(false);
  const [inCall, setInCall] = useState<boolean>(false);
  const [debugLogs, setDebugLogs] = useState<boolean>(false);
  const localConnection = useRef<RTCPeerConnection>(
    new RTCPeerConnection(configuration)
  );
  const webSocket = useRef<WebSocket | null>(null);
  const lastPeerMessage = useRef<string>("");

  const consoleDebug = (message: any, error = false) => {
    if(!debugLogs && (!window.console || !console)) return;
    if(error) console.error(message);
    else console.log(message);
  }

  useEffect(() => {
    // https://blog.logrocket.com/responsive-camera-component-react-hooks/
    if (!localStream) {
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .then((s) => setLocalStream(s))
        .catch((err) => consoleDebug(err));
    } else {
      return () =>
        localStream.getTracks().forEach((track) => {
          track.stop();
        });
    }
  }, [localStream]);

  useEffect(() => {
    setUpLocalConnection();

    let twoWords = (randomwords(2) as string[]).join("-");

    webSocket.current = new WebSocket(socketUrl);
    webSocket.current.addEventListener("open", (_ev) => {
      consoleDebug("Socket connection opened.");
      webSocket.current?.send("");
      webSocket.current!.send(
        JSON.stringify({
          action: "setusername",
          username: twoWords,
        })
      );
    });
    webSocket.current.addEventListener("close", (_ev) => {
      consoleDebug("Socket connection closed.");
    });

    return () => webSocket.current?.close();
  }, []);

  useEffect(() => {
    if (localConnection.current) updateListeners();

    if (webSocket.current) {
      webSocket.current.addEventListener("message", (messageEvent) => {
        // To avoid re-handling messages sent by potential duplicate lambda invocations
        if (
          !messageEvent.data ||
          messageEvent.data === lastPeerMessage.current
        ) {
          lastPeerMessage.current = messageEvent.data;
          return;
        }

        let response = JSON.parse(messageEvent.data);
        consoleDebug(response);
        switch (response.responseType) {
          case "defaultStatus":
            break;
          case "peerMessage":
            handlePeerMessage(response);
            break;
          case "usernameSet":
            setUsername(response.username);
            break;
          case "usernameUnavailable":
            let twoWords = (randomwords(2) as string[]).join("-");
            webSocket.current!.send(
              JSON.stringify({
                action: "setusername",
                username: twoWords,
              })
            );
            break;
          default:
            consoleDebug(
              `Unknown socket message type ${response.responseType}`, true
            );
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

  const setUpLocalConnection = () => {
    localConnection.current.oniceconnectionstatechange = (ev) =>
      consoleDebug(ev);
    localConnection.current.onicecandidateerror = (err) => consoleDebug(err, true);
    localConnection.current.ontrack = (trackEvent) => onPeerStream(trackEvent);
    localConnection.current.onconnectionstatechange = (_ev) => {
      if (localConnection.current.connectionState === "disconnected") hangUp();
    };
    updateListeners();

    // let dataChannel = localConnection.createDataChannel("dataChannel");
  };

  const handlePeerMessage = (peerMessage: peerMessage) => {
    let senderConnectionId = peerMessage.senderConnectionId;
    setRemoteConnectionId(senderConnectionId);
    switch (peerMessage.messageType) {
      case "offer":
        onOffer(JSON.parse(peerMessage.message), senderConnectionId);
        break;
      case "answer":
        onAnswer(JSON.parse(peerMessage.message));
        break;
      case "iceCandidate":
        onPeerIceCandidate(JSON.parse(peerMessage.message));
        break;
      case "callRequest":
        let userCallAccepted = window.confirm(
          `Accept call from ${peerMessage.message}?`
        );
        if (userCallAccepted) {
          sendPeerMessage(senderConnectionId, "callAccept", " ");
          setPeerUsername(peerMessage.message);
          setInCall(true);
        } else {
          sendPeerMessage(senderConnectionId, "callReject", " ");
          setRemoteConnectionId("");
        }
        break;
      case "callAccept":
        callPeer();
        break;
      case "callReject":
        setCalling(false);
        alert(`${senderConnectionId} rejected the call.`);
        break;
      default:
        consoleDebug("Invalid peer message type.", true);
    }
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
    consoleDebug(messageBody);
    webSocket.current?.send(messageBody);
  };

  const onPeerIceCandidate = (
    iceCandidate: RTCIceCandidate,
    attempt: number = 0
  ) => {
    if (attempt > 0)
      consoleDebug("Retrying ice candidate... Attempt " + attempt);
    localConnection.current
      .addIceCandidate(iceCandidate)
      .then(() => consoleDebug("Successfully added peer ICE candidate"))
      .catch(async (err) => {
        consoleDebug(`Could not add peer ICE candidate. ${err}`, true);
        // Retry up to two times
        if (attempt < 2)
          setTimeout(() => onPeerIceCandidate(iceCandidate, attempt + 1), 2000);
      });
  };

  const sendOffer = (sessionDescription: RTCSessionDescriptionInit) => {
    setInCall(true);
    localConnection.current
      .setLocalDescription(sessionDescription)
      .then(() => {
        consoleDebug("setLocalDescription complete for local from local");
        // Send offer to remote peer
        sendPeerMessage(
          remoteConnectionId,
          "offer",
          JSON.stringify(sessionDescription)
        );
      })
      .catch((err) =>
        consoleDebug(`Failed to set session description. ${err}`, true)
      );
  };

  const onOffer = (
    sessionDescription: RTCSessionDescriptionInit,
    peerConnectionId: string
  ) => {
    setInCall(true);
    localConnection.current
      .setRemoteDescription(sessionDescription)
      .then(() => {
        consoleDebug("setLocalDescription complete for remote from local");
        localStream?.getTracks().forEach((track) => {
          consoleDebug(track);
          try {
            localConnection.current.addTrack(track, localStream);
          } catch (err) {
            consoleDebug(`Could not add track. ${err}`);
          }
        });
        buildAnswer(peerConnectionId);
      })
      .catch((err) =>
        consoleDebug(`Failed to set session description. ${err}`, true)
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

    localConnection.current
      .createAnswer()
      .then((sessionDescription) => {
        localConnection.current
          .setLocalDescription(sessionDescription)
          .then(() => {
            consoleDebug("setLocalDescription complete for local from local");
            sendPeerMessage(
              peerConnectionId,
              "answer",
              JSON.stringify(sessionDescription)
            );
          })
          .catch((err) =>
            consoleDebug(`Failed to set session description. ${err}`, true)
          );
      })
      .catch((err) => consoleDebug(`Failed to send answer. ${err}`, true));
  };

  const onAnswer = (sessionDescription: RTCSessionDescriptionInit) => {
    localConnection.current
      .setRemoteDescription(sessionDescription)
      .then(() =>
        consoleDebug("setLocalDescription complete for remote from local")
      )
      .catch((err) =>
        consoleDebug(`Failed to set session description. ${err}`, true)
      );
  };

  const onPeerStream = (trackEvent: RTCTrackEvent) => {
    consoleDebug(trackEvent.streams);
    trackEvent.streams.forEach((s) => consoleDebug(s));
    trackEvent.track.onunmute = () => {
      if (remoteStream !== trackEvent.streams[0]) {
        setRemoteStream(trackEvent.streams[0]);
        consoleDebug("Receieved remote stream!");
      }
    };
  };

  const callRequest = () => {
    setCalling(true);
    setPeerUsername(remoteConnectionId);
    sendPeerMessage(remoteConnectionId, "callRequest", username);
  };

  const callPeer = () => {
    setInCall(true);
    setCalling(false);
    // Should trigger on negotiation neeeded
    localStream?.getTracks().forEach((track) => {
      consoleDebug(track);
      try {
        localConnection.current.addTrack(track, localStream);
      } catch (err) {
        consoleDebug(`Could not add track. ${err}`, true);
      }
    });
  };

  const hangUp = () => {
    setInCall(false);
    setPeerUsername("");
    setRemoteConnectionId("");
    localConnection.current.close();
    localConnection.current = new RTCPeerConnection(configuration);
    setUpLocalConnection();
  };

  return (
    <div className="App">
      <header className="App-header">
        {username && (
          <h5>
            {peerUsername && inCall
              ? `In a call with ${peerUsername}`
              : `Your username is ${username}`}
          </h5>
        )}
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
          {remoteStream && inCall && (
            <div style={{ flex: 1 }}>
              <VideoStream srcObject={remoteStream} />
            </div>
          )}
        </div>
        {!inCall && (
          <input
            type="text"
            placeholder="baby-monkey"
            disabled={calling}
            value={remoteConnectionId}
            onChange={(event) => setRemoteConnectionId(event.target.value)}
          />
        )}
        <div style={{ display: "flex" }}>
          <div>
            <button
              type="button"
              disabled={
                !localConnection.current ||
                !webSocket.current ||
                !remoteConnectionId ||
                calling ||
                inCall
              }
              onClick={() => callRequest()}
            >
              Call peer
            </button>
          </div>
          <div>
            <button
              type="button"
              disabled={!localConnection.current || !inCall}
              onClick={() => hangUp()}
            >
              Hang up
            </button>
          </div>
          <div>
            <input type="checkbox" defaultChecked={debugLogs} onChange={() => setDebugLogs(!debugLogs)} />
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
