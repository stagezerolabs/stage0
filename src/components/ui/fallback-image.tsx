import React, { useEffect, useState } from 'react';

type FallbackImageProps = {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  placeholder?: React.ReactNode;
  onImageError?: (src: string) => void;
};

const FallbackImage: React.FC<FallbackImageProps> = ({
  src,
  fallbackSrc,
  alt,
  className,
  placeholder,
  onImageError,
}) => {
  const initialSrc = src || fallbackSrc || '';
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc || '');
    setFailed(false);
  }, [src, fallbackSrc]);

  if (!currentSrc || failed) {
    return <>{placeholder ?? null}</>;
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => {
        onImageError?.(currentSrc);
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
          return;
        }
        setFailed(true);
      }}
    />
  );
};

export default FallbackImage;
