# 오디오 엔진

## 기본 신호 경로

```text
FileInput / LiveInput / TestSignalInput
  → 소스 레벨 → 입력 Analyser
  → Input Gain → Compressor → Overdrive → Distortion → NAM → Cabinet IR
  → 3-band EQ → Delay → Reverb
  → Master·Mute → 출력 보호 → 출력 Analyser → 출력 장치
```

합성 기타도 TestSignalInput을 이용한다. 전체 Dry 경로는 첫 이펙터 앞에서 분기하고 Master 직전에 합류한다. Dry와 Wet에 같은 소스 레벨·Master·보호단을 적용한다. 개별 바이패스는 병렬 경로의 두 게인을 8 ms에 걸쳐 반대로 램핑한다. 딜레이와 리버브는 동일한 구조로 드라이/처리 비율을 제어한다.

Input Gain과 Master 사이의 여덟 슬롯은 프리셋의 `order` 순서로 연결한다. 실행 중에는 Wet 게인을 8 ms 동안 내리고 오디오 시계의 종료 이벤트에서 슬롯 사이의 연결을 교체한 뒤 8 ms 동안 올린다. 이벤트를 기다리는 동안 들어온 순서 편집은 마지막 값으로 합친다. 오프라인 엔진과 새로 시작한 엔진은 처음부터 선택한 순서로 연결한다. [ADR 0004](../adr/0004-editable-signal-chain.md)

## 수명과 전환

기본 소스 선택·노브 편집에는 장치 접근이 필요 없다. 시작 시점에 컨텍스트, 그래프와 입력을 만든다. 소스에는 공통 `disconnect()`가 있다. 파일은 pause에서 위치를 보존하고 재생할 때 새 AudioBufferSourceNode를 만든다. 자연 종료는 재생 끝 위치를 기록한다.

라이브 입력은 권한을 명시적으로 요청한다. 늦게 도착한 스트림은 요청 번호를 비교한 뒤 모든 트랙을 중지한다. 장치 종료 시 연결·모니터링을 해제한다. 종료와 NAM의 비동기 로딩은 직렬화하며, 컨텍스트 세대와 파일 요청 번호로 늦은 디코딩 결과를 걸러낸다. 종료할 때 리스너, 스트림, 노드와 컨텍스트를 정리한다. 같은 탭에서 다시 재생할 수 있도록 선택된 파일과 IR의 디코딩 버퍼만 보관한다. 파일 해제로 버퍼를 놓을 수 있다.

## 생성·분석·렌더

기본 테스트 루프는 2초, Sweep은 기준 주파수에서 최대 18 kHz 또는 나이퀴스트의 90%까지 상승한다. Impulse는 루프 첫 샘플에 한 번 발생한다. Karplus–Strong은 시드가 고정된 노이즈로 지연선을 여기하고 반초마다 다시 튕긴다.

실시간 미터는 2048 샘플 분석 창에서 최대 20 Hz로 Peak와 RMS를 읽는다. 스펙트럼은 동일 Analyser의 주파수 빈을 표시한다. 분석기는 브라우저가 혼합한 채널을 보여준다. 순간적인 모든 피크를 포착하는 전용 멀티채널 true-peak 계측기는 후속 과제다.

오프라인 렌더는 현재 엔진 샘플레이트의 OfflineAudioContext에 같은 DspGraph를 생성한다. 초기값은 램핑 없이 지정하고 IR·Delay·Reverb의 꼬리를 포함한다. 실시간 청취용 Mute는 파일 생성에 적용하지 않는다. 출력 진폭과 렌더 메모리 한도는 [DSP 사양](../audio/dsp-effects.md)을 따른다.
