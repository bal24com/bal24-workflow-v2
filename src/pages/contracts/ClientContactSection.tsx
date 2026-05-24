// 계약 모달의 거래처·담당자 영역 — STEP-ACCOUNTING-FOLLOWUP6
// 거래처 select + 부서 표시 + 세금계산서 담당자 select + 이메일·전화 표시

interface ClientOption { id: string; name: string; department: string | null }
interface ContactOption {
  id: string;
  client_id: string;
  name: string;
  position: string | null;
  email: string | null;
  phone_office: string | null;
  phone_mobile: string | null;
}

interface Props {
  clients: ClientOption[];
  contacts: ContactOption[];
  clientId: string;
  contactId: string;
  onClientChange: (clientId: string) => void;
  onContactChange: (contactId: string) => void;
}

export default function ClientContactSection({
  clients, contacts, clientId, contactId, onClientChange, onContactChange,
}: Props) {
  const selectedClient = clients.find((c) => c.id === clientId) ?? null;
  const clientContacts = clientId ? contacts.filter((c) => c.client_id === clientId) : [];
  const selectedContact = contacts.find((c) => c.id === contactId) ?? null;

  return (
    <>
      <FieldBox label="주관기관 (세금계산서 발행처)">
        <select
          value={clientId}
          onChange={(e) => onClientChange(e.target.value)}
          className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
        >
          <option value="">선택 안함</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClient?.department && (
          <p className="text-[11px] text-slate-500 mt-1">부서: <span className="font-semibold text-slate-700">{selectedClient.department}</span></p>
        )}
      </FieldBox>

      {clientId && (
        <FieldBox label="세금계산서 담당자">
          {clientContacts.length === 0 ? (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              등록된 담당자가 없어요. <a href="/clients" target="_blank" rel="noreferrer" className="underline">고객사 페이지</a>에서 담당자를 먼저 등록해 주세요.
            </p>
          ) : (
            <>
              <select
                value={contactId}
                onChange={(e) => onContactChange(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
              >
                <option value="">선택 안함</option>
                {clientContacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.position ? ` (${c.position})` : ''}</option>
                ))}
              </select>
              {selectedContact && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {selectedContact.email && <div>📧 {selectedContact.email}</div>}
                  {selectedContact.phone_office && <div>☎ {selectedContact.phone_office}</div>}
                  {selectedContact.phone_mobile && <div>📱 {selectedContact.phone_mobile}</div>}
                </div>
              )}
            </>
          )}
        </FieldBox>
      )}
    </>
  );
}

function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
