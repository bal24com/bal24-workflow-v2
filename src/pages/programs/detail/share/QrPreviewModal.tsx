// bal24 v2 — 외부공유 QR 코드 미리보기 모달 (Stage 3-B-1)

import { useRef } from 'react';
import { Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import Modal from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui';
import { useToast } from '../../../../contexts/ToastContext';

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  audienceLabel: string;
}

export default function QrPreviewModal({ open, onClose, url, audienceLabel }: Props) {
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  function handleDownload() {
    const canvas = wrapRef.current?.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas) {
      toast.error('QR 이미지를 만들지 못했어요.');
      return;
    }
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${audienceLabel}-qr.png`;
      a.click();
      toast.success('QR 이미지를 다운로드했어요.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[program-share] QR 다운로드 실패:', raw);
      toast.error('QR 다운로드에 실패했어요.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${audienceLabel} QR 코드`}
      description="휴대폰 카메라로 스캔하면 외부 페이지로 이동해요."
      size="brand"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button variant="primary" onClick={handleDownload} leftIcon={<Download size={14} />}>
            PNG 다운로드
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <div ref={wrapRef} className="rounded-2xl border border-violet-100 bg-white p-4">
          {url ? (
            <QRCodeCanvas
              value={url}
              size={224}
              level="M"
              marginSize={2}
              fgColor="#1E1B4B"
              bgColor="#FFFFFF"
            />
          ) : (
            <p className="text-xs text-slate-400 italic">URL이 없어요.</p>
          )}
        </div>
        <p className="text-[11px] text-slate-500 break-all text-center">{url}</p>
      </div>
    </Modal>
  );
}
