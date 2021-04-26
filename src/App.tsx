// Reference: https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/pc1/js/main.js
import React, { useEffect, useState } from "react";
import "./App.css";

import VideoStream from "./VideoStream";

function App() {
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [localConnection, setLocalConnection] = useState<RTCPeerConnection>();
  const [remoteConnection, setRemoteConnection] = useState<RTCPeerConnection>();

  useEffect(() => {
    // https://blog.logrocket.com/responsive-camera-component-react-hooks/
    if (!localStream) {
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: { facingMode: "environment" } })
        .then((s) => setLocalStream(s))
        .catch((err) => console.log(err));
    } else {
      return () =>
        localStream.getTracks().forEach((track) => {
          track.stop();
        });
    }
  }, [localStream]);

  const getOtherPeer = (peer: RTCPeerConnection) =>
    peer === localConnection ? remoteConnection : localConnection;
  const getPeerName = (peer: RTCPeerConnection) =>
    peer === localConnection ? "local" : "remote";

  const onicecandidate = (
    peer: RTCPeerConnection,
    iceEvent: RTCPeerConnectionIceEvent
  ) => {
    // console.log(JSON.stringify(peer.localDescription));
    getOtherPeer(peer)
      ?.addIceCandidate(iceEvent.candidate!)
      .then(() =>
        console.log(
          `Added ICE candidate to ${getPeerName(
            getOtherPeer(peer)!
          )} connection`
        )
      )
      .catch((err) =>
        console.error(
          `Could not add ICE candidate to ${getPeerName(
            getOtherPeer(peer)!
          )} connection because of error. ${err}`
        )
      );
  };

  const onOfferSuccess = (sessionDescription: RTCSessionDescriptionInit) => {
    localConnection
      ?.setLocalDescription(sessionDescription)
      .then(() =>
        console.log("setLocalDescription complete for local from local")
      )
      .catch((err) =>
        console.error(`Failed to set session description. ${err}`)
      );

    remoteConnection
      ?.setRemoteDescription(sessionDescription)
      .then(() => {
        console.log("setLocalDescription complete for local from remote");
        createRemoteAnswer();
      })
      .catch((err) =>
        console.error(`Failed to set session description. ${err}`)
      );
  };

  const createRemoteAnswer = () => {
    remoteConnection?.createAnswer().then((sessionDescription) => {
      // console.log(`Answer from remote connection. ${desc.sdp}`);
      remoteConnection
        .setLocalDescription(sessionDescription)
        .then(() =>
          console.log("setLocalDescription complete for remote from remote")
        )
        .catch((err) =>
          console.error(`Failed to set session description. ${err}`)
        );

      localConnection
        ?.setRemoteDescription(sessionDescription)
        .then(() =>
          console.log("setLocalDescription complete for remote from local")
        )
        .catch((err) =>
          console.error(`Failed to set session description. ${err}`)
        );
    });
  };

  const gotRemoteStream = (trackEvent: RTCTrackEvent) => {
    console.log(trackEvent.streams);
    trackEvent.streams.forEach((s) => console.log(s));
    if (remoteStream !== trackEvent.streams[0]) {
      setRemoteStream(trackEvent.streams[0]);
      console.log("Receieved remote stream!");
    }
  };

  const connectToPeer = () => {
    console.log("Connecting to peer...");
    setLocalConnection(new RTCPeerConnection({}));
    setRemoteConnection(new RTCPeerConnection({}));

    localConnection?.addEventListener("icecandidate", (ev) =>
      onicecandidate(localConnection, ev)
    );
    remoteConnection?.addEventListener("icecandidate", (ev) =>
      onicecandidate(remoteConnection, ev)
    );
    remoteConnection?.addEventListener("track", (ev) => gotRemoteStream(ev));

    localStream?.getTracks().forEach((track) => {
      console.log(track);
      localConnection?.addTrack(track, localStream);
    });

    // let dataChannel = localConnection.createDataChannel("dataChannel");

    const offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    };

    localConnection?.createOffer(offerOptions).then(
      (localSessionDescription) => {
        // console.log(`Offer from local connection ${value.sdp}`);
        onOfferSuccess(localSessionDescription);
      },
      (reason) =>
        console.error(`Failed to create session description: ${reason}`)
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <button type="button" disabled={!localStream} onClick={connectToPeer}>
          Connect to "remote" peer
        </button>
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
