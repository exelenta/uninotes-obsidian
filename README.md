# UniNotes for Obsidian

Goodnotes 필기를 UniNotes 서버의 AI 에이전트가 정리한 노트로 받아 오고, Obsidian에서 고친 내용을 서버로 올립니다.

## 설치 (BRAT)

1. 커뮤니티 플러그인에서 **Obsidian42 - BRAT** 설치
2. BRAT → *Add Beta plugin* → `exelenta/uninotes-obsidian`
3. 설정 → UniNotes → **연결 토큰** 입력 (웹 콘솔 온보딩에서 발급)

## 기능

- **동기화**: 서버 정리 결과가 `UniNotes/` 폴더에 자동 반영되고, 직접 고친 내용은 서버로 올라갑니다.
  같은 노트를 에이전트와 동시에 고치면 서버가 병합하며 **내 수정이 우선**입니다. 서버에서 지운 노트라도 이 기기에서 고친 것은 지우지 않습니다.
- **상태 표시줄**: 동기화 상태와 처리 중 여부. 누르면 최근 세션 리포트
- **명령** (리본 아이콘 또는 명령 팔레트 "UniNotes: 명령 보내기"): 손글씨 `@AI`와 같은 명령을 입력. 현재 노트의 원본 문서를 대상으로 지정 가능
- **리포트와 되돌리기**: 최근 세션 리포트, 세션 되돌리기, "커서 위치 블록 되돌리기"
- **원본 링크**: 노트의 `obsidian://uninotes-open?...` 링크를 누르면 웹 콘솔에서 Goodnotes 원본 페이지를 엽니다
- **블록 스타일**: `> [!source]` 손필기, `> [!question]` 스캔 배경, `> [!ai]` 에이전트 작성
- 대시보드·설정은 웹 콘솔에서 ("UniNotes: 웹 콘솔 열기")

## 여러 기기

동기화는 **주 기기 한 대**만 합니다. 처음 연결한 기기가 주 기기가 되고, 나머지는 명령과 리포트만 씁니다.
설정 → UniNotes → "이 기기를 주 기기로"에서 바꿀 수 있습니다.
Obsidian Sync·iCloud로 볼트를 동기화한다면 `UniNotes/` 폴더를 그 동기화에서 빼는 것을 권장합니다.

## 개발

이 저장소는 배포용입니다. 코드는 UniNotes 본 저장소의 `plugin/`에서만 고치고 `scripts/release-plugin.sh`로 배포합니다.

```bash
npm ci
npm run build      # main.js
npm run test:e2e   # 본 저장소에서: 로컬 서버를 띄워 동기화 시나리오 검사
```
