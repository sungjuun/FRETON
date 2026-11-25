# 기본 DSP 효과

단위·범위·기본값의 실행 기준은 `packages/audio-engine/src/presets/config.ts`다. 독립 조절 가능한 기본 모듈은 아래와 같다.

| 모듈           | 파라미터 범위                                                                       | 처리                                                                                 |
| -------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 입력 소스 레벨 | −60~0 dB                                                                            | 모든 소스에 동일하게 적용. 입력 분석기 앞                                            |
| Input Gain     | −24~+18 dB                                                                          | 선형 게인 `10^(dB/20)`. 앰프 Gain 노브와 공유                                        |
| Compressor     | Threshold −60~0 dB, Ratio 1~20:1, Attack 1~200 ms, Release 10~1000 ms, Knee 0~40 dB | DynamicsCompressorNode, 시간 파라미터를 초로 변환                                    |
| Overdrive      | Drive 0~100%, Tone 400~10000 Hz, Level −30~+3 dB                                    | 입력 게인 뒤에 부드러운 tanh 곡선, 2× 오버샘플링과 저역통과 필터                     |
| Distortion     | Gain 0~100%, Tone 400~10000 Hz, Level −30~+3 dB                                     | 별도 프리게인과 하드 클리핑 곡선, 2× 오버샘플링, 저역통과 필터                       |
| Equalizer      | 각 −12~+12 dB                                                                       | Bass 120 Hz lowshelf, Middle 800 Hz peaking(Q 0.8), Treble 3500 Hz highshelf         |
| Delay          | Time 10~1000 ms, Feedback 0~80%, Mix 0~75%                                          | 한 번 지연된 신호를 제한된 비율로 재입력. Wet을 병렬 합산                            |
| Reverb         | Decay 0.1~4 s, Mix 0~75%                                                            | 시드 고정 2채널 노이즈의 진폭을 3차 곡선으로 감쇠해 생성한 IR. Decay는 버퍼 길이     |
| Cabinet IR     | WAV, 모노 또는 스테레오, 최대 10초·32 MiB                                           | WAV fmt 검사, 컨텍스트 레이트로 디코딩한 후 ConvolverNode. 브라우저 기본 정규화 사용 |
| Master         | −60~0 dB, Mute                                                                      | 마지막 소프트웨어 출력은 ±0.97 샘플 진폭으로 제한. 엔진 시작 시 최대 −24 dB          |

일반 파라미터 변경은 8 ms 선형 램프로 처리한다. 왜곡 곡선은 고정하고 Gain을 연속 조절한다. IR 교체와 리버브 Decay 변경은 새 응답의 꼬리로 바뀐다. 강한 입력으로 실시간 교체할 때의 청감과 순간 부하는 실기기 측정 대상이다.

**오프라인 출력**은 PCM16 little-endian WAV다. 원본 전체 또는 생성 신호 2초를 사용한다. 지연의 잔향은 피드백이 약 −60 dB까지 감소하는 반복 횟수로 계산한다. IR 및 리버브 꼬리를 추가한다. 다채널 합계 2400만 샘플을 초과하면 렌더 요청을 거절한다. Dry도 선택한 소스 레벨과 Master를 적용한다.

**기본 톤**은 상용 장비 이름을 사용하지 않는 자체 DSP 검증 설정이다. Studio Clean은 컴프레서와 짧은 공간음, Warm Clean은 저음 강조와 고음 감쇠, British Crunch는 오버드라이브와 중역 강조, Indie Drive는 짧은 딜레이, Modern High Gain은 하드 왜곡과 중역 감쇠, Ambient Lead는 긴 딜레이와 리버브를 사용한다.
