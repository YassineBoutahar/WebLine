/* eslint-disable react-hooks/exhaustive-deps */
// Reference: https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/pc1/js/main.js
import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Rnd } from "react-rnd";
import { ChatFeed, Message } from "react-chat-ui";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Slide,
  Drawer,
  Divider,
  Typography,
  TextField,
  Box,
  IconButton,
  makeStyles,
  Theme,
  createStyles,
} from "@material-ui/core";
import CallEndIcon from "@material-ui/icons/CallEnd";
import ChatIcon from "@material-ui/icons/Chat";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import { TransitionProps } from "@material-ui/core/transitions";
import randomwords from "random-words";
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

type streamPosition = {
  x: number;
  y: number;
  height: number;
  width: number;
  aspectRatio: number;
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

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children?: React.ReactElement<any, any> },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const drawerWidth = 350;

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      minHeight: "100vh",
      backgroundColor: theme.palette.background.default,
      textAlign: "center",
    },
    drawer: {
      width: drawerWidth,
      flexShrink: 0,
    },
    drawerPaper: {
      width: drawerWidth,
      paddingTop: 5,
    },
    content: {
      flexGrow: 1,
      padding: theme.spacing(3),
      transition: theme.transitions.create("margin", {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      marginRight: -drawerWidth,
    },
    contentShift: {
      transition: theme.transitions.create("margin", {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginRight: 0,
    },
    localStreamRnd: {
      zIndex: 50,
    },
    remoteStream: {
      marginRight: drawerWidth,
    },
    hangupButtonEnabled: {
      "&:hover": {
        opacity: 1,
        backgroundColor: "red",
      },
      backgroundColor: "red",
      color: "white",
      opacity: 0.2,
      marginRight: 25,
    },
    hangupButtonDisabled: {
      backgroundColor: "grey",
      color: "white",
      marginRight: 25,
    },
    callControls: {
      display: "flex",
      position: "absolute",
      left: window.screen.availWidth / 2 - drawerWidth / 2,
      bottom: 20,
      zIndex: 100,
    },
    chatOpenButton: {
      "&:hover": {
        opacity: 1,
      },
      opacity: 0.4,
      color: theme.palette.text.secondary,
    },
    textAreaContainer: {
      height: "100%",
      width: "100%",
    },
    chatFeed: {
      paddingLeft: 7,
      paddingRight: 7,
    },
    hidden: {
      opacity: 0,
    },
  })
);

function App() {
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [
    localStreamPosition,
    setLocalStreamPosition,
  ] = useState<streamPosition>({
    x: 0,
    y: 0,
    height: 0,
    width: 0,
    aspectRatio: 1,
  });
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [remoteConnectionId, setRemoteConnectionId] = useState<string>("");
  const [peerUsername, setPeerUsername] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [placeholderUsername, setPlaceHolderUsername] = useState<string>(
    (randomwords(2) as string[]).join("-")
  );
  const [incomingCall, setIncomingCall] = useState<boolean>(false);
  const [calling, setCalling] = useState<boolean>(false);
  const [inCall, setInCall] = useState<boolean>(false);
  const [callRejected, setCallRejected] = useState<boolean>(false);
  const [callFailed, setCallFailed] = useState<boolean>(false);
  // const [debugLogs, setDebugLogs] = useState<boolean>(true);
  const [chatContent, setChatContent] = useState<Message[]>([]);
  const [chatOpen, setChatOpen] = useState<boolean>(true);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const localConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel>();
  const webSocket = useRef<WebSocket | null>(null);
  const lastPeerMessage = useRef<string>("");

  const classes = useStyles();

  const consoleDebug = (message: any, error = false) => {
    // Temporary till I think of place for debug checkbox
    // if (!debugLogs || !window.console || !console) return;
    if (!false || !window.console || !console) return;
    if (error) console.error(message);
    else console.log(message);
  };

  useEffect(() => {
    // https://blog.logrocket.com/responsive-camera-component-react-hooks/
    if (!localStream) {
      navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            width: { ideal: 4096 },
            height: { ideal: 2160 },
          },
        })
        .then((s) => {
          setLocalStream(s);
          setLocalStreamPosition({
            x: 0,
            y: 0,
            height: s.getVideoTracks()[0].getSettings().height || 960,
            width: s.getVideoTracks()[0].getSettings().width || 1280,
            aspectRatio: s.getVideoTracks()[0].getSettings().aspectRatio || 1,
          });
        })
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

    return () => {
      webSocket.current!.send(
        JSON.stringify({
          action: "deleteusername",
          username: username,
        })
      );
      webSocket.current?.close();
    };
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
          case "missingPeer":
            hangUp();
            setCallFailed(true);
            break;
          default:
            consoleDebug(
              `Unknown socket message type ${response.responseType}`,
              true
            );
        }
      });
    }
  }, [remoteConnectionId]);

  useEffect(() => {
    setPlaceHolderUsername((randomwords(2) as string[]).join("-"));
  }, [inCall]);

  const updateListeners = () => {
    localConnection.current!.onicecandidate = (iceEvent) => {
      sendPeerMessage(
        remoteConnectionId,
        "iceCandidate",
        JSON.stringify(iceEvent.candidate)
      );
    };
    localConnection.current!.onnegotiationneeded = async () => {
      const localSessionDescription = await localConnection.current!.createOffer(
        connectionOptions
      );
      if (localConnection.current!.signalingState !== "stable") return;
      sendOffer(localSessionDescription);
    };
  };

  const setUpLocalConnection = () => {
    localConnection.current = new RTCPeerConnection(configuration);
    localConnection.current.oniceconnectionstatechange = (ev) =>
      consoleDebug(ev);
    localConnection.current.onicecandidateerror = (err) =>
      consoleDebug(err, true);
    localConnection.current.ontrack = (trackEvent) => onPeerStream(trackEvent);
    localConnection.current.onconnectionstatechange = (_ev) => {
      if (localConnection.current?.connectionState === "disconnected") hangUp();
    };
    updateListeners();

    // let dataChannel = localConnection.createDataChannel("dataChannel");
  };

  const setUpDataChannel = () => {
    dataChannel.current!.onmessage = (ev) => receiveTextMessage(ev.data);
    dataChannel.current!.onopen = (ev) => consoleDebug("Data channel open");
    dataChannel.current!.onclose = (ev) => consoleDebug("Data channel close");
  };

  const acceptCall = () => {
    setLocalStreamPosition({
      ...localStreamPosition,
      height: localStreamPosition.height / 2,
      width: localStreamPosition.width / 2,
    });
    localConnection.current!.ondatachannel = (dataChannelEvent) => {
      dataChannel.current = dataChannelEvent.channel;
      setUpDataChannel();
    };
    sendPeerMessage(remoteConnectionId, "callAccept", " ");
    setPeerUsername(peerUsername);
    setChatContent([]);
    setIncomingCall(false);
    setInCall(true);
  };

  const rejectCall = () => {
    sendPeerMessage(remoteConnectionId, "callReject", " ");
    setRemoteConnectionId("");
    setIncomingCall(false);
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
        if (incomingCall || calling || inCall) {
          sendPeerMessage(senderConnectionId, "callReject", " ");
          setRemoteConnectionId("");
          return;
        }
        setPeerUsername(peerMessage.message);
        setIncomingCall(true);
        break;
      case "callAccept":
        callPeer();
        break;
      case "callReject":
        setCalling(false);
        setCallRejected(true);
        setRemoteConnectionId("");
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
    localConnection
      .current!.addIceCandidate(iceCandidate)
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
    localConnection
      .current!.setLocalDescription(sessionDescription)
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
    localConnection
      .current!.setRemoteDescription(sessionDescription)
      .then(() => {
        consoleDebug("setLocalDescription complete for remote from local");
        localStream?.getTracks().forEach((track) => {
          consoleDebug(track);
          try {
            localConnection.current!.addTrack(track, localStream);
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
    localConnection.current!.onicecandidate = (iceEvent) => {
      sendPeerMessage(
        peerConnectionId,
        "iceCandidate",
        JSON.stringify(iceEvent.candidate)
      );
    };

    localConnection
      .current!.createAnswer()
      .then((sessionDescription) => {
        localConnection
          .current!.setLocalDescription(sessionDescription)
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
    localConnection
      .current!.setRemoteDescription(sessionDescription)
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
    setChatContent([]);
    setCalling(true);
    sendPeerMessage(remoteConnectionId, "callRequest", username);
  };

  const callPeer = () => {
    setLocalStreamPosition({
      ...localStreamPosition,
      height: localStreamPosition.height / 2,
      width: localStreamPosition.width / 2,
    });
    setInCall(true);
    setCalling(false);
    // Should trigger on negotiation neeeded
    localStream?.getTracks().forEach((track) => {
      consoleDebug(track);
      try {
        localConnection.current!.addTrack(track, localStream);
      } catch (err) {
        consoleDebug(`Could not add track. ${err}`, true);
      }
    });

    dataChannel.current = localConnection.current!.createDataChannel(
      "textChannel"
    );
    setUpDataChannel();
  };

  const hangUp = () => {
    setCalling(false);
    setInCall(false);
    setPeerUsername("");
    setRemoteConnectionId("");
    dataChannel.current?.close();
    localConnection.current!.close();
    localConnection.current = new RTCPeerConnection(configuration);
    setUpLocalConnection();
  };

  const receiveTextMessage = (receivedMessage: string) => {
    setChatContent((prev) => [
      ...prev,
      new Message({
        id: 1,
        message: receivedMessage,
        senderName: peerUsername,
      }),
    ]);
  };

  const sendTextMessage = () => {
    setChatContent((prev) => [
      ...prev,
      new Message({ id: 0, message: currentMessage, senderName: username }),
    ]);
    dataChannel.current?.send(currentMessage);
    setCurrentMessage("");
  };

  return (
    <div className={classes.root}>
      <main
        className={clsx(classes.content, {
          [classes.contentShift]: true,
        })}
      >
        <Rnd
          className={classes.localStreamRnd}
          size={{
            height: localStreamPosition.height,
            width: localStreamPosition.width,
          }}
          position={{ x: localStreamPosition.x, y: localStreamPosition.y }}
          onDragStop={(_dragEvent, dragData) => {
            setLocalStreamPosition({
              ...localStreamPosition,
              x: Math.min(
                dragData.x,
                window.screen.availWidth -
                  drawerWidth -
                  localStreamPosition.width +
                  20
              ),
              y: dragData.y,
            });
          }}
          onResize={(mouseEvent, direction, elementRef, delta, position) => {
            setLocalStreamPosition({
              ...localStreamPosition,
              height: parseInt(elementRef.style.height),
              width: parseInt(elementRef.style.width),
              x: Math.min(
                position.x,
                window.screen.availWidth -
                  drawerWidth -
                  localStreamPosition.width +
                  20
              ),
              y: position.y,
            });
          }}
          bounds="window"
          lockAspectRatio={localStreamPosition.aspectRatio}
        >
          {localStream ? (
            <VideoStream
              srcObject={localStream}
              muted
              styleObject={{
                height: localStreamPosition.height,
                width: localStreamPosition.width,
                border: "2px dashed rgba(255, 255, 255, 0.1)",
              }}
            />
          ) : (
            <h4>Please enable your camera</h4>
          )}
        </Rnd>
        <div className={classes.remoteStream}>
          {remoteStream && inCall && (
            <VideoStream
              srcObject={remoteStream}
              styleObject={{
                height: "100vh",
                width: `100%`,
                objectFit: "contain",
                position: "absolute",
                top: 0,
                left: 0,
                right: 1000,
                zIndex: 2,
              }}
            />
          )}
        </div>
        <Box className={classes.callControls}>
          <IconButton
            className={
              !localConnection.current || !inCall
                ? classes.hangupButtonDisabled
                : classes.hangupButtonEnabled
            }
            disabled={!localConnection.current || !inCall}
            onClick={() => hangUp()}
            color="inherit"
          >
            <CallEndIcon fontSize="large" color="inherit" />
          </IconButton>
          <IconButton
            className={classes.chatOpenButton}
            onClick={() => setChatOpen(!chatOpen)}
            color="inherit"
          >
            <ChatIcon fontSize="large" color="inherit" />
          </IconButton>
        </Box>

        {/*<input
              type="checkbox"
              disabled={!window.console || !console}
              defaultChecked={debugLogs}
              onChange={() => setDebugLogs(!debugLogs)}
            />
            <div>
              <button type="button" onClick={() => setChatOpen(!chatOpen)}>
                Open chat
              </button>
            </div>*/}
        <Dialog
          open={incomingCall}
          TransitionComponent={Transition}
          keepMounted
          onClose={() => rejectCall()}
          aria-labelledby="alert-dialog-slide-title"
          aria-describedby="alert-dialog-slide-description"
        >
          <DialogTitle id="alert-dialog-slide-title">Incoming call</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-slide-description">
              Would you like to accept the call from <b>{peerUsername}</b>?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => rejectCall()}>Decline</Button>
            <Button onClick={() => acceptCall()}>Accept</Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={callRejected}
          TransitionComponent={Transition}
          keepMounted
          onClose={() => setCallRejected(false)}
          aria-labelledby="alert-dialog-slide-title"
          aria-describedby="alert-dialog-slide-description"
        >
          <DialogTitle id="alert-dialog-slide-title">Declined</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-slide-description">
              <b>{peerUsername}</b> declined to answer your call.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCallRejected(false)}>Ok</Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={callFailed}
          TransitionComponent={Transition}
          keepMounted
          onClose={() => setCallFailed(false)}
          aria-labelledby="alert-dialog-slide-title"
          aria-describedby="alert-dialog-slide-description"
        >
          <DialogTitle id="alert-dialog-slide-title">Call Failed</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-slide-description">
              The specified user <b>{peerUsername}</b> could not be found.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCallFailed(false)}>Dismiss</Button>
          </DialogActions>
        </Dialog>
      </main>
      <Drawer
        className={classes.drawer}
        variant="persistent"
        anchor="right"
        open={chatOpen}
        classes={{
          paper: classes.drawerPaper,
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignContent="center"
        >
          <Box>
            <IconButton
              disabled={!chatOpen}
              onClick={() => setChatOpen(false)}
              color="inherit"
            >
              <ChevronRightIcon fontSize="large" color="inherit" />
            </IconButton>
          </Box>
          <Box>
            <Typography>
              {peerUsername && inCall ? `In a call with` : `Your username is`}
            </Typography>
            <Typography variant="h6">
              {peerUsername && inCall ? peerUsername : username}
            </Typography>
          </Box>
          <Box>
            <IconButton className={classes.hidden} disabled>
              <ChevronRightIcon fontSize="large" color="inherit" />
            </IconButton>
          </Box>
        </Box>
        <Divider />
        <Box
          className={classes.textAreaContainer}
          display="flex"
          flexDirection="column"
          justifyContent="spaceBetween"
        >
          <Box className={classes.chatFeed} display="flex" flexGrow={1}>
            <ChatFeed
              messages={chatContent}
              hasInputField={false}
              showSenderName={false}
              bubblesCentered={false}
              bubbleStyles={{
                text: {
                  fontSize: 15,
                },
                chatbubble: {
                  borderRadius: 50,
                  padding: 10,
                },
              }}
            />
          </Box>
          <Box display="flex" flexWrap="nowrap" padding={1}>
            <Box display="flex" flexGrow={1}>
              <TextField
                fullWidth
                placeholder={inCall ? "Message" : placeholderUsername}
                disabled={calling || incomingCall}
                value={inCall ? currentMessage : remoteConnectionId}
                onChange={(event) => {
                  if (!inCall) {
                    setRemoteConnectionId(event.target.value);
                    setPeerUsername(event.target.value);
                  } else setCurrentMessage(event.target.value);
                }}
                onKeyDown={(keyEvent) => {
                  if (
                    keyEvent.key === "Enter" &&
                    !inCall &&
                    localConnection.current &&
                    webSocket.current &&
                    remoteConnectionId &&
                    !calling &&
                    /^\w+(-\w+)$/.test(remoteConnectionId)
                  ) {
                    callRequest();
                  } else if (
                    keyEvent.key === "Enter" &&
                    inCall &&
                    dataChannel.current
                  ) {
                    sendTextMessage();
                  }
                }}
              />
            </Box>
            <Box display="flex" flexGrow={0}>
              {inCall ? (
                <Button
                  disabled={
                    incomingCall ||
                    calling ||
                    !currentMessage ||
                    !dataChannel.current
                  }
                  onClick={() => sendTextMessage()}
                >
                  Send
                </Button>
              ) : (
                <Button
                  disabled={
                    !localConnection.current ||
                    !webSocket.current ||
                    !remoteConnectionId ||
                    calling ||
                    inCall ||
                    !/^\w+(-\w+)$/.test(remoteConnectionId)
                  }
                  onClick={() => callRequest()}
                >
                  Connect
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Drawer>
    </div>
  );
}

export default App;
