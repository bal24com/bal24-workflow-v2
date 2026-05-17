// bal24 v2 — 고객사 폼의 담당자 섹션 (명함 인식 + 담당자 추가/수정/삭제)
// ClientFormModal 400줄 제한 준수를 위해 분리.

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Plus, ScanLine, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui';
import {
  extractBusinessCardInfo,
  ClaudeApiKeyMissingError,
  ClaudeApiError,
} from '../../lib/businessCardScan';
import type { Profile } from '../../types/database';
import ContactRow, { makeContact, type ContactDraft } from './ContactRow';

type ProfileOption = Pick<Profile, 'id' | 'name'>;

interface ScanFeedback {
  type: 'info' | 'error';
  message: string;
}

interface Props {
  contacts: ContactDraft[];
  profiles: ProfileOption[];
  disabled?: boolean;
  /** 명함 인식으로 회사명을 발견했을 때 (부모가 이름 비어있을 때만 채움) */
  onCompanyNameSuggested?: (name: string) => void;
  /** 명함 인식 결과 / 오류 알림 */
  onScanFeedback?: (feedback: ScanFeedback) => void;
  onChange: (next: ContactDraft[]) => void;
}

export default function ClientContactsSection({
  contacts,
  profiles,
  disabled,
  onCompanyNameSuggested,
  onScanFeedback,
  onChange,
}: Props) {
  const [scanning, setScanning] = useState(false);
  const cardInputRef = useRef<HTMLInputElement | null>(null);

  const updateContact = (uid: string, patch: Partial<ContactDraft>) => {
    onChange(contacts.map((c) => (c.uid === uid ? { ...c, ...patch } : c)));
  };

  const addContact = () => onChange([...contacts, makeContact()]);

  const removeContact = (uid: string) => {
    if (contacts.length <= 1) return;
    onChange(contacts.filter((c) => c.uid !== uid));
  };

  const handleScanCard = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setScanning(true);
    try {
      const info = await extractBusinessCardInfo(file);
      const newContact: ContactDraft = {
        ...makeContact(),
        name: info.name ?? '',
        position: info.position ?? '',
        phoneMobile: info.phone_mobile ?? '',
        phoneOffice: info.phone_office ?? '',
        email: info.email ?? '',
      };

      const emptyIdx = contacts.findIndex((c) => !c.name.trim());
      const next = [...contacts];
      if (emptyIdx >= 0) {
        next[emptyIdx] = { ...next[emptyIdx], ...newContact, uid: next[emptyIdx].uid };
      } else {
        next.push(newContact);
      }
      onChange(next);

      if (info.organization && onCompanyNameSuggested) {
        onCompanyNameSuggested(info.organization);
      }

      const filled = [
        info.name,
        info.organization,
        info.position,
        info.phone_mobile,
        info.phone_office,
        info.email,
      ].filter(Boolean).length;
      onScanFeedback?.({
        type: 'info',
        message: `명함에서 ${filled}개 항목을 읽어와 담당자에 추가했어요.`,
      });
    } catch (err) {
      if (err instanceof ClaudeApiKeyMissingError) {
        onScanFeedback?.({ type: 'error', message: err.message });
      } else if (err instanceof ClaudeApiError) {
        onScanFeedback?.({ type: 'error', message: err.friendlyMessage });
      } else {
        const raw = err instanceof Error ? err.message : '';
        console.error('[clients] 명함 인식 실패:', raw);
        onScanFeedback?.({ type: 'error', message: '명함 인식 중 오류가 발생했어요.' });
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          담당자 ({contacts.length})
        </h3>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={scanning ? <Loader2 size={12} className="animate-spin" /> : <ScanLine size={12} />}
            onClick={() => cardInputRef.current?.click()}
            disabled={disabled || scanning}
          >
            {scanning ? '인식 중…' : '명함 인식'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Plus size={12} />}
            onClick={addContact}
            disabled={disabled}
          >
            담당자 추가
          </Button>
          <input
            ref={cardInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void handleScanCard(e)}
          />
        </div>
      </div>
      <div className="space-y-3">
        {contacts.map((c, idx) => (
          <ContactRow
            key={c.uid}
            contact={c}
            index={idx}
            canRemove={contacts.length > 1}
            profiles={profiles}
            onUpdate={updateContact}
            onRemove={removeContact}
            disabled={disabled}
          />
        ))}
      </div>
      <p className="text-xs text-muted">이름이 비어 있는 담당자 행은 저장되지 않아요.</p>
    </section>
  );
}
