# BalanceDot WorkFlow v2 — 관리자 매뉴얼

> 박경수님 본인용 빠른 참조 문서. 2026-05-28 작성.
> 작은 수정과 기능 추가가 쌓이며 누더기 느낌이 든 시점의 정리본.

## 빠른 접근

| 상황 | 어디로 |
|---|---|
| 처음 보는 분 / 메뉴 구조부터 | [00-overview.md](./00-overview.md) |
| 프로젝트·컨소시엄 만들기 | [01-projects-consortium.md](./01-projects-consortium.md) |
| 프로그램 등록·강사 배정·교육생 관리 | [02-programs.md](./02-programs.md) |
| 외부 포털 7종 운영 (강사·학교·교육청 등) | [03-portals.md](./03-portals.md) |
| 수입·계약·강사료·증빙·정산 | [04-finance.md](./04-finance.md) |
| 결과보고서·재무리포트 | [05-reports.md](./05-reports.md) |
| 트러블슈팅 + 점검 결과 (2026-05-28) | [99-troubleshooting.md](./99-troubleshooting.md) |

## 시스템 한눈에

- **앱**. BalanceDot WorkFlow v2
- **배포 URL**. https://bal24-workflow-v2.netlify.app · https://bal24.kr
- **로컬**. C:\workflow\bal24-workflow-v2
- **GitHub**. https://github.com/bal24com/bal24-workflow-v2
- **Supabase**. https://clsljkxvgmqwenettkrz.supabase.co
- **관리자 계정**. park8451@gmail.com
- **사이드바 메뉴**. 8그룹 22개
- **외부 토큰 라우트**. 15+종 (강사·학교·교육청·고객·회계사·신청자·교육생·평가)

## 작업 흐름 — 새 사업 시작 시

```
1️⃣ 고객사 등록     →  /clients
2️⃣ 컨소시엄 생성   →  /consortium  (필요 시)
3️⃣ 프로젝트 생성   →  /projects (계약 자동 생성)
4️⃣ 프로그램 생성   →  /programs (커리큘럼·강사·교육생)
5️⃣ 외부 포털 발급   →  강사 / 학교 / 교육청 / 고객
6️⃣ 일지·출석 운영   →  강사 포털 (/portal)
7️⃣ 강사료 정산     →  /payroll
8️⃣ 결과보고서      →  /programs/:id → [결과보고]
9️⃣ 회계 검토       →  /accounting-review 외부 포털
```

## 문서 작성 원칙

- 박경수님이 막혔을 때 검색해서 빠르게 답 찾는 용도
- 화면 위치·버튼명 명시 (예. "사이드바 → 프로그램 → [+ 등록]")
- 메뉴마다 "이 화면에서 자주 하는 일" + "안 보이면 확인할 곳"
- 코드 / SQL 은 트러블슈팅 문서에만 (사용 시점에서 멀리)

## 변경 이력

- 2026-05-28. 매뉴얼 최초 작성 (박경수님 누더기 정리 요청)
