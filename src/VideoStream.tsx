import { VideoHTMLAttributes, useRef, useEffect } from "react";

type VideoStreamProps = VideoHTMLAttributes<HTMLVideoElement> & {
  srcObject: MediaStream;
};

const VideoStream = ({ srcObject, ...props }: VideoStreamProps) => {
  const vref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (srcObject && vref.current && !vref.current.srcObject)
      vref.current.srcObject = srcObject;
  }, [srcObject]);

  return (
    <video
      style={{'transform': 'scaleX(-1)', 'WebkitTransform': 'scaleX(-1)'}}
      ref={vref}
      onCanPlay={() => vref.current?.play()}
      autoPlay
      playsInline
      {...props}
    />
  );
};

export default VideoStream;
