import { useState } from "react";

interface Props {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
}

export function ImageWithFallback({ src, alt, className, fallback = "" }: Props) {
  const [errored, setErrored] = useState(false);
  return (
    <img
      src={errored ? fallback : src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
    />
  );
}
