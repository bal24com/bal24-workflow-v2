// bal24 v2 — QR 다운로드 버튼 (qrcode.react 기반)
// 숨겨진 QRCodeCanvas 를 ref 로 잡고 toDataURL 로 PNG 다운로드

import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode } from 'lucide-react';
import { Button } from './ui';

interface Props {
  url: string;
  filename: string;
  label?: string;
  size?: 'sm' | 'md';
}

export default function QrDownloadButton({ url, filename, label = 'QR 저장', size = 'sm' }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const handleDownload = () => {
    const canvas = wrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${filename}.png`;
    a.click();
  };

  return (
    <>
      {/* 화면 밖에 숨겨진 QRCanvas (다운로드 시 toDataURL 추출용) */}
      <div ref={wrapperRef} aria-hidden="true" style={{ position: 'absolute', left: -9999, top: -9999 }}>
        <QRCodeCanvas
          value={url}
          size={300}
          fgColor="#1E1B4B"
          bgColor="#FFFFFF"
          level="M"
          includeMargin
        />
      </div>
      <Button variant="outline" size={size} onClick={handleDownload}>
        <QrCode size={14} className="mr-1" aria-hidden="true" />
        {label}
      </Button>
    </>
  );
}
