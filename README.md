# UniNotes for Obsidian

Goodnotes(iPad) 필기를 UniNotes 서버의 AI 에이전트가 정리한 노트로 바꿔, Obsidian 볼트의 `UniNotes/` 폴더로 가져오는 플러그인입니다.

Brings the study notes that the UniNotes AI agent builds from your handwritten Goodnotes pages into the `UniNotes/` folder of your vault.

> 베타입니다. 아직 Obsidian 커뮤니티 목록에는 없고, BRAT으로 설치합니다.

## 설치 (iPad, PC 공통)

1. Obsidian **설정 › 커뮤니티 플러그인**에서 **제한 모드**를 끕니다.
2. **탐색**에서 **BRAT**을 검색해 설치하고 활성화합니다.
3. BRAT 설정에서 **Add beta plugin**을 누르고 `https://github.com/exelenta/uninotes-obsidian` 을 입력합니다.
4. **커뮤니티 플러그인** 목록에서 **UniNotes**를 켭니다.
5. UniNotes 설정에 서버 주소와 UniNotes 콘솔에서 받은 **연결 토큰**을 넣고, 명령 팔레트에서 **UniNotes: 서버에서 가져오기**를 실행합니다.

BRAT이 새 버전을 자동으로 받아 줍니다.

## 기능

- 서버에서 `UniNotes/` 폴더로 노트 가져오기 (5분마다 자동, 또는 리본 아이콘/명령)
- **지금 처리**: 에이전트 바로 실행
- **마지막 리포트 보기**

아직 볼트에서 고친 내용을 서버로 올리는 기능은 없습니다. 지금은 `UniNotes/` 폴더의 파일을 직접 고치면 다음 가져오기 때 서버 버전으로 덮어써질 수 있습니다.

## Disclosures

- **Account required.** You need a UniNotes account and its connection token.
- **Network use.** The plugin talks only to the UniNotes server you configure (default `https://uninotes.jpstudios.org`) to download notes, start processing, and read reports. Your Goodnotes pages are processed on that server, which sends page images to the AI provider it is configured with (Anthropic or OpenAI).
- **Vault access.** The plugin only writes inside the folder set in its settings (`UniNotes/` by default).
- **No client-side telemetry, no ads.**
- **Payments.** None at this time.

## License

MIT
