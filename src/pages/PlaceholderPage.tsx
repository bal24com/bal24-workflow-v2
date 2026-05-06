// bal24 v2 — 미구현 메뉴용 placeholder
// STEP 7+에서 각 도메인 페이지로 교체

type Props = {
  title: string;
  description?: string;
};

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="v2-card p-10 max-w-2xl mx-auto text-center space-y-3">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary text-2xl">
        🛠️
      </div>
      <h2 className="text-xl font-bold text-text">{title}</h2>
      <p className="text-sm text-muted">
        {description ?? '준비 중인 메뉴예요. 곧 만나볼 수 있어요.'}
      </p>
    </div>
  );
}
