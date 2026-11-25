# 변경 기록

## 0.1.0 개발 중

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
