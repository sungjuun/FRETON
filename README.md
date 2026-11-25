# FRETON · Digital Guitar Studio

**Find your tone. Play your way.**

FRETON은 기타 입력이나 오디오 파일에 이펙터를 연결하고, 처리 전후의 소리를 듣거나 WAV로 비교할 수 있는 한국어 데스크톱 웹 스튜디오다. 기타가 없어도 합성 기타로 바로 시작할 수 있다. 실시간 오디오 처리, 파일 디코딩, NAM 앰프 모델 실행과 프리셋 저장은 브라우저 안에서 이뤄진다.

## 개발 진행 상황

**2026-11-25 기준, v0.0.1 오디오 엔진의 소프트웨어 검증을 마치고 v0.1.0 Virtual Rig를 개발 중이다.**

| 상태             | 작업                         | 확인한 결과                                                                                                                            |
| ---------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 완료             | 오디오 엔진과 Audio Sandbox  | 합성 기타·테스트 신호·로컬 파일·라이브 입력을 같은 이펙터에 연결한다. Chrome에서 DSP 처리, 미터와 WAV 출력을 검증했다.                 |
| 완료             | 이펙터 체인 편집             | 여섯 페달과 NAM·Cabinet IR의 순서를 바꿀 수 있다. EQ를 왜곡 앞뒤로 옮겼을 때 실시간 출력과 Wet WAV 양쪽에서 같은 음량 변화를 측정했다. |
| 완료             | 프리셋 호환                  | 체인 순서를 프리셋에 저장한다. 기존 버전 1 JSON과 IndexedDB 프리셋이 원래 순서로 열리는 것을 확인했다.                                 |
| 실기기 검증 대기 | MacBook과 Matribox 1(QME-50) | Windows Chrome에서 합성 신호와 실제 NAM 캡처를 시험했다. 실제 USB 입출력·연주감·물리적 왕복 지연은 장비에서 확인할 예정이다.           |

자동화 검증은 단위 테스트 16개, Chrome 개발 앱 테스트 11개, 프로덕션 빌드 테스트 1개를 통과했다. [소프트웨어 검증 기록](docs/testing/software-test.md) · [변경 기록](CHANGELOG.md)

### v0.1.0에 남은 작업

- [ ] **Noise Gate**를 추가하고 작은 잡음과 길게 울리는 기타 음에서 게이트가 열리고 닫히는 동작을 검증한다.
- [ ] **Chorus와 Tremolo**를 추가하고 새 페달의 설정을 실시간 처리, Wet WAV와 프리셋 저장에 연결한다.
- [ ] **NAM 모델 라이브러리**를 만들어 Virtual Rig에서 모델을 목록으로 확인하고 선택할 수 있게 한다.
- [ ] **Virtual Rig UI**에 새 페달과 모델 선택을 통합하고, 연주 중 조작 흐름을 점검한다.
- [ ] **성능과 지연**을 측정한다. 모델별 샘플레이트·처리 부하를 비교하고, Matribox에서 USB Dry/Wet 채널, 직접음 분리, 체인 전환음, 장시간 재생과 왕복 지연을 확인한다. [실기기 검증표](docs/testing/hardware-test.md)

## 시작하기

Windows 또는 macOS, Node.js 22.13 이상인 22 LTS 또는 24 이상, npm, 데스크톱 Google Chrome이 필요하다. 프로젝트 루트에서 실행한다.

```sh
npm ci
npm run dev
```

[Virtual Rig 열기](http://127.0.0.1:5173/rig) · [Audio Sandbox 열기](http://127.0.0.1:5173/sandbox)

PowerShell 실행 정책이 npm 스크립트를 가로막으면 같은 명령의 `npm` 자리에 `npm.cmd`를 사용한다. 개발 서버는 루프백에 바인딩한다. 5173을 사용 중이면 `npm run dev -w @freton/web -- --port 5174`로 실행한다.

## 기타 없이 첫 소리 듣기

1. Virtual Rig에서 **엔진 시작**을 누른다. 초기 입력은 합성 기타, 입력 레벨은 −12 dB, Master는 −24 dB다. 실제 기타 녹음이나 상용 앰프 캡처를 사용하지 않는 DSP 검증용 연주음이다.
2. 프리셋을 Studio Clean에서 British Crunch 또는 Ambient Lead로 바꾼다. A · DRY와 B · WET으로 같은 입력을 비교한다. 전체 Bypass가 켜져 있으면 두 경로 모두 원음이 된다.
3. 페달 상단을 눌러 오른쪽 파라미터를 편집하고 하단 풋스위치로 개별 바이패스를 조작한다. 앰프 노브는 위아래 드래그·방향키로 조절하고 더블클릭·Delete로 복원한다. Gain은 입력 게인, Bass/Middle/Treble은 EQ다.
4. Audio Sandbox에서 테스트 신호 또는 로컬 파일을 선택한다. 입력·출력의 파형과 스펙트럼은 각각 전환할 수 있다. **Dry WAV / Wet WAV**로 같은 입력·출력 레벨에서 처리 전후 파일을 저장한다.
5. 프리셋 관리에서 이름을 입력하고 저장한다. 새로고침한 다음 프리셋 목록에서 다시 선택한다. 사이트 데이터는 브라우저 프로필과 주소별로 분리되며 JSON으로 옮길 수 있다.

Virtual Rig 또는 Audio Sandbox의 **이펙터 체인 → 순서 편집**에서 페달·NAM·Cabinet IR을 드래그하거나 화살표 버튼으로 옮긴다. 예를 들어 British Crunch에서 Equalizer를 Overdrive 앞으로 옮기면 EQ로 조정한 신호가 드라이브에 들어간다. **기본 순서**로 되돌릴 수 있고, 편집한 순서를 다시 쓰려면 프리셋 관리에서 저장한다.

로컬 파일·IR·NAM까지 시험하려면 Sandbox 진단에서 샘플레이트를 읽고 아래 명령의 수치를 맞춘다.

```sh
npm run fixtures -- 48000
```

`.local/test-audio/`에 4초 사인 버스트 WAV, 세 개 탭을 가진 시험용 FIR WAV, 계수 0.25 및 0.5의 선형 NAM 파일이 생성된다. 버스트는 오디오 파일 입력에, FIR은 Cabinet IR에, NAM은 모델 슬롯에 넣는다. 실측한 캐비닛이나 앰프의 음색을 담은 파일은 아니다.

## 구현 범위

학습된 캡처도 장비 없이 시험할 수 있다. **Settings → 엔진 샘플레이트 → 48,000 Hz**를 선택하고 엔진을 시작하거나 재시작한다. **Virtual Rig → 모델 & 캐비닛 → NAM 파일 선택**에서 아래 파일을 연다. 앰프·캐비닛이 함께 캡처되어 있어 별도 IR을 끈 상태에서 먼저 비교한다. [RiffSmith Distorted 검증 파일 및 출처](assets/test-audio/riffsmith/README.md)

| 영역        | 현재 사용할 수 있는 기능                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Virtual Rig | 독자적인 앰프 헤드와 페달, 입력 게인, Compressor, Overdrive, Distortion, 3밴드 EQ, Delay, Reverb, Master, 음소거, 개별·전체 바이패스와 Dry/Wet 비교        |
| 입력        | 합성 기타, 7가지 테스트 신호, 로컬 오디오 선택·드롭·재생·일시정지·정지·반복·탐색·파형, 명시적인 라이브 입력 연결                                           |
| Sandbox     | 실제 입출력 분석기, RMS·Peak·클립 표시, 브라우저 지연 정보, 오류 기록, 기본 DSP와 IR을 포함한 오프라인 WAV                                                 |
| 모델        | 공식 NAM Worklet/WASM을 이용한 로컬 모노 모델 로딩·교체·해제, 샘플레이트 검사, 모노·스테레오 캐비닛 IR, 별도 활성화                                        |
| 로컬 프리셋 | 실제 DSP 설정이 다른 기본 6종, IndexedDB 저장·이름 변경·복제·삭제·즐겨찾기. 버전 1은 기존 순서로 열리고, 새 JSON은 편집한 순서를 포함한 버전 2로 저장된다. |
| 장치        | 권한·장치 목록·장치 변경과 해제, 실제 보정 설정 조회, 보고된 채널 수에 따른 Mono/Left/Right, 지원 브라우저의 출력 장치 선택                                |

기술 스택은 React 18, TypeScript strict, Vite, Tailwind CSS, Zustand, React Router, Lucide, Web Audio API, IndexedDB, NAM WASM, Vitest, Playwright다. NAM 패키지의 peer 범위에 맞춰 React 버전을 선택했다. [의존성 및 라이선스](docs/dependencies-and-licenses.md)

## 검증

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:browser
npm run build
npm run test:production
```

브라우저 검사는 설치된 Chrome과 별도 테스트 프로필을 사용한다. 개발용 테스트 포트는 47136, 빌드본 테스트 포트는 47137이다. 프로덕션 산출물은 `apps/web/dist/`에 생긴다. 빌드본을 수동으로 열 때는 `npm run preview -w @freton/web`를 실행하고 출력된 주소로 접속한다. [소프트웨어 검증 기록](docs/testing/software-test.md)

## 실제 기타 연결

Mac에서 Matribox 1을 USB로 연결하고 오디오 MIDI 설정에서 장치를 확인한다. FRETON Settings에서 명시적으로 입력을 연결한 뒤 장치의 USB Dry 신호와 입력 채널을 식별한다. 유선 헤드폰과 낮은 Master로 시작하고 직접 모니터 경로를 확인한 뒤 소프트웨어 모니터링을 켠다. 실행 결과, 연주감, 노이즈와 물리적 지연은 집에서 기록해야 한다. [Matribox 연결 절차](docs/audio/matribox-setup.md) · [실기기 검증표](docs/testing/hardware-test.md)

## 현재 사용 범위

지금 사용할 수 있는 화면은 Virtual Rig, Audio Sandbox, Settings다. NAM은 모델과 엔진의 샘플레이트를 맞춰 실시간으로 사용한다. Wet WAV 내보내기는 기본 DSP와 캐비닛 IR을 지원한다. 새 세션에서 프리셋의 음색을 복원하려면 원본 NAM·IR 파일을 다시 선택한다. [알려진 한계와 해결 방법](docs/troubleshooting/known-issues.md)

## 로드맵

| 버전   | 단계                 | 목표                                                                                 |
| ------ | -------------------- | ------------------------------------------------------------------------------------ |
| v0.0.1 | 소프트웨어 검증 완료 | **Audio Engine PoC** · 브라우저 입력, 기본 DSP, WAV, 로컬 프리셋과 NAM·IR            |
| v0.1.0 | 개발 중              | **Virtual Rig** · 편집 가능한 페달보드, 추가 이펙터, NAM 라이브러리와 Matribox 실측  |
| v0.2.0 | 예정                 | **Practice Room** · 반주 파일, A–B 구간 반복, 메트로놈·튜너, 연습 기록과 곡별 프리셋 |
| v0.3.0 | 예정                 | **Backend** · Spring Boot와 PostgreSQL 기반 회원·장비 관리, 프리셋 동기화            |
| v0.4.0 | 예정                 | **Tone AI** · 보유 장비와 펌웨어에서 사용할 수 있는 톤 설정 추천                     |
| v0.5.0 | 예정                 | **Cover Studio** · Dry/Wet 녹음, 반주 믹싱, 영상·오디오 동기화                       |
| v0.6.0 | 예정                 | **AI Coach** · 단음·박자·음색 분석과 연주 피드백                                     |
| v0.7.0 | 예정                 | **Community & Cloud** · 프로필, 콘텐츠 저장과 공유                                   |
| v1.0.0 | 예정                 | **공개 출시** · 실사용 성능, 접근성, 개인정보 및 콘텐츠 권리 검토                    |

각 버전의 목표와 검증 기준은 [제품 로드맵](docs/product/roadmap.md)에 정리했다.

## 소스 구조

| 경로                                                                  | 역할                                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/web/src/`                                                       | 한국어 앱 셸, Rig·Sandbox·Settings, 노브·미터, IndexedDB 서비스, 중앙 브랜드 설정 |
| `packages/audio-engine/src/core/`                                     | 엔진 생명주기, 공통 라우팅, 오프라인 렌더                                         |
| `packages/audio-engine/src/inputs/`                                   | LiveInput, FileInput, TestSignalInput, Karplus–Strong 합성기                      |
| `packages/audio-engine/src/effects/`, `amps/`, `cabinet/`, `presets/` | DSP 그래프, NAM 어댑터, IR WAV 검사, 파라미터 및 프리셋 스키마                    |
| `packages/audio-engine/tests/`, `apps/web/tests/`, `tests/`           | 순수 함수, 실제 오프라인 DSP, Chrome UI 및 프로덕션 통합 테스트                   |
| `scripts/`, `docs/`                                                   | 자체 시험 파일 생성기, 제품·아키텍처·DSP·검증 기록 및 ADR                         |
