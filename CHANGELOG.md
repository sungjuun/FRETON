# 변경 기록

## 0.1.0 개발 중

- 2026-11-27 · `npm run bench:nam`으로 프로덕션 Sandbox의 NAM 렌더 부하를 측정할 수 있다. 44.1·48·96 kHz에서 동일한 WAV로 모델 미연결·Linear·RiffSmith의 호환성과 처리 시간을 비교했다. [모델별 측정 결과](docs/testing/nam-performance.md)

- 2026-11-26 · Virtual Rig에서 입력 창 안의 엔진 시작, 라이브 입력 연결 요청 취소, 누락된 NAM 라이브러리로 이동, 대화상자를 닫은 뒤 키보드 포커스 복귀를 지원한다. 앰프 헤드 아래에 Dry·전체 Bypass·현재 NAM 모델·기본 DSP 경로를 표시한다.

- 2026-11-26 · Virtual Rig와 Audio Sandbox에 로컬 NAM 모델 라이브러리를 추가했다. 모델을 한 번 저장한 뒤 목록에서 재사용하고, 새 세션에서도 프리셋에 연결할 수 있다. 같은 파일의 중복 저장을 방지하고 요구 샘플레이트를 표시한다.

- 2026-11-26 · Tremolo를 추가했다. Rate와 Depth로 진폭 변조를 조절하며 기본 위치는 Delay 앞이다. 버전 5 프리셋에 설정·순서를 저장하며, 버전 1~4 프리셋은 이전 톤을 유지하도록 Tremolo가 꺼진 상태로 열린다.

- 2026-11-26 · Chorus를 추가했다. Rate·Depth·Mix와 페달 순서를 편집할 수 있고 Wet WAV에는 마지막 음의 지연분까지 담긴다. 버전 4 프리셋은 코러스 설정을 저장하며 버전 1~3을 열면 꺼진 Chorus가 Delay 앞에 놓인다.

- 2026-11-26 · Noise Gate를 실시간 엔진과 Wet WAV에 추가했다. Threshold·Attack·Hold·Release를 편집하고 체인 안에서 이동할 수 있다. 프리셋 버전 3은 게이트 설정을 저장하며 버전 1·2는 기존 순서를 유지한 채 게이트가 꺼진 상태로 열린다.

- Virtual Rig와 Audio Sandbox에서 여섯 페달과 NAM·Cabinet IR의 신호 순서를 편집할 수 있다. 실시간 연주와 기본 DSP·IR의 Wet WAV에 같은 순서를 적용한다.
- 프리셋 JSON 버전 2에 순서를 저장한다. 기존 버전 1의 JSON과 IndexedDB 프리셋은 원래 순서로 열리며 다음 저장부터 새 형식을 사용한다.

## 0.0.1 · 2026-11-25

- Settings에서 장치 기본값 또는 44.1/48/96 kHz 엔진 레이트를 선택하고, NAM 슬롯에서 모델 형식·레이트·캡처 유형을 확인할 수 있다. 제작자가 MIT로 공개한 RiffSmith Distorted를 검증 자료로 추가했다.
- NAM·IR 원본 재연결 시 지문과 저장된 바이패스를 보존한다. NAM 준비 중 프리셋 전환, 같은 이름의 다른 파일, 파일 재생 중 끝 지점 탐색을 처리했다.

- npm workspaces에 브라우저 앱과 독립 오디오 엔진을 구성했다. Virtual Rig, Audio Sandbox, Settings와 후속 메뉴의 예정 화면을 추가했다.
- 생성 신호·현악기 합성·오디오 파일·사용자 승인 라이브 입력을 같은 DSP 체인에 연결했다. 스테레오 채널 선택, 실제 분석기, 음소거, 바이패스와 WAV 렌더를 구현했다.
- 일곱 DSP 모듈, 여섯 기본 프리셋, IndexedDB 저장 및 스키마 검증 JSON 교환을 추가했다.
- 로컬 NAM Worklet과 WASM, IR WAV를 연동했다. 선형 검증 모델 및 시험 WAV 생성기를 추가했다.
- Windows Chrome 소프트웨어 검증과 MacBook/QME-50 실기기 검증 절차를 마련했다. [실행 결과](docs/testing/software-test.md)
