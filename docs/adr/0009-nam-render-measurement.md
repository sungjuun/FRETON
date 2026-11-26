# ADR 0009 · 실제 연주 그래프의 블록 렌더 시간을 측정한다

NAM 비교에는 프로덕션 빌드를 재생하는 Chrome의 Web Audio trace를 사용한다. `RealtimeAudioDestinationHandler::Render` 이벤트는 출력 노드가 한 블록의 입력을 가져와 그래프를 처리하는 구간을 포함하고, 프레임 수를 함께 제공한다. 같은 WAV와 페달 설정을 유지하고 모델만 연결하거나 해제하면 각 조건에서 그래프가 소비한 시간을 비교할 수 있다. [Chromium 렌더 구현](https://chromium.googlesource.com/chromium/src/+/lkgr/third_party/blink/renderer/modules/webaudio/realtime_audio_destination_handler.cc)

파일 선택부터 로드 성공까지의 시간에는 파일 읽기와 WASM 초기화가 포함된다. 프로세스 전체 CPU 사용률에는 UI·브라우저 작업도 포함된다. 연주 중 한 블록의 처리 비용을 비교하기 위해 별도 Playwright 명령으로 렌더 이벤트의 경과 시간을 수집하고 중앙값과 95백분위를 기록한다.

이 방법에는 trace 기록 비용이 있고 이벤트 이름·필드는 Chrome 버전에 의존한다. 프레임 수와 수집량을 검사하고 실제 소리가 출력되는지 미터로 확인한다. 동일 기기의 같은 조건에서 측정을 반복하며 물리적 왕복 지연과 장시간 연주감은 실기기 검증표에서 다룬다. [재현 절차와 결과](../testing/nam-performance.md)
