# MacBook에서 Matribox 1 연결하기

대상 장비는 **SONICAKE Matribox 1 (QME-50)**이다. 목표는 기타 → Matribox USB 입력 → FRETON → 유선 헤드폰 경로에서 기타 줄을 튕겼을 때 브라우저 이펙터가 적용된 소리를 듣는 것이다. 실기기 검증 상태는 **Pending**이다. [실기기 검증표](../testing/hardware-test.md)

## 배선과 장치 인식

1. 장비 볼륨을 최소로 내리고 전원이 꺼진 상태에서 기타를 `INPUT`, 유선 헤드폰을 `PHONES`에 꽂는다. Matribox USB-C 단자와 MacBook을 데이터 전송이 가능한 USB 케이블로 연결한다. 장비 규격에 맞는 전원 어댑터를 연결해 켠다. [QME-50 공식 매뉴얼, 인쇄 1·4쪽](https://cdn.shopify.com/s/files/1/0100/1950/4185/files/Matribox_Online_Manual_Firmware_V1.1.0.pdf?v=1763367433)
2. 장비의 `GLOBAL → About`에서 펌웨어 버전을 기록한다. 매뉴얼의 표시와 장비 메뉴가 다르면 해당 펌웨어용 매뉴얼을 확인한다. [제조사 펌웨어별 매뉴얼](https://www.sonicake.com/pages/matribox-software-firmware-download)
3. Mac의 **오디오 MIDI 설정**에서 USB 장치가 보이는지 확인하고 실제 장치 이름, 입력·출력 채널 수, 포맷을 기록한다. 제조사가 표기한 24비트·44.1 kHz는 장비 내부 처리 사양이다. 브라우저 그래프의 샘플레이트는 FRETON 진단에서 별도로 읽는다. [제조사 사양](https://www.sonicake.com/products/matribox)

## Dry와 Wet을 식별하는 방법

1. 장비에서 기존 설정값을 메모한다. `GLOBAL → USB Audio`에서 `Rec Mode (Left)`는 **Dry**, `Rec Mode (Right)`는 **Wet**으로 설정한다. 이는 시험을 위한 배치다. `Rec Level`은 USB 녹음 레벨이며, `Monitor Level`은 USB 모니터 레벨이다. 매뉴얼에는 후자를 장비 직접음만 음소거하는 스위치로 명시한 설명이 없다. [QME-50 공식 매뉴얼, 인쇄 10쪽](https://cdn.shopify.com/s/files/1/0100/1950/4185/files/Matribox_Online_Manual_Firmware_V1.1.0.pdf?v=1763367433)
2. Mac에서 프로젝트를 실행하고 Chrome으로 로컬 주소를 연다. FRETON 엔진을 시작하고, 출력 음소거 상태에서 라이브 입력을 선택한다. 권한을 요청한 뒤 기기 목록에서 USB 장치 이름을 확인하고 연결한다. Chrome에서는 오디오 인터페이스 입력도 마이크 권한을 사용한다. 사이트 권한을 허용했는데도 접근이 거부되면 macOS에서 Chrome의 마이크 접근 권한을 확인한다. [Chrome 권한 안내](https://support.google.com/chrome/answer/2693767?hl=ko)
3. 프렛을 누른 한 음을 짧게 반복한다. 입력 파형이 반응하는지 확인한다. 브라우저가 보고한 채널 수와 에코 제거, 노이즈 억제, 자동 게인의 실제 적용값을 기록한다. 브라우저가 값을 제공하지 않은 경우 **미보고**로 적는다. 장치 선택은 HTTPS 또는 localhost의 보안 컨텍스트에서 시험한다. [W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
4. 브라우저에서 두 채널이 확인되면 FRETON을 Bypass로 두고 Left와 Right를 각각 듣는다. 장비에서 구별이 쉬운 딜레이를 켰을 때 Wet 쪽에서만 반복음이 들리는지 확인한다. 다시 장비 딜레이를 끄고 FRETON 입력을 Dry로 확인한 채널에 둔다. 단일 채널만 제공되면 양쪽 Rec Mode를 Dry로 맞춰 연주하고, 좌우 분리 검증은 Pending으로 기록한다.

## 헤드폰으로 브라우저 처리음 듣기

직접 모니터링은 Matribox의 기타 신호를 장비 출력에서 듣는 경로다. 소프트웨어 모니터링은 USB 입력을 Chrome이 처리한 뒤 선택한 출력으로 보내는 경로다. 두 경로를 함께 들으면 한 음이 두 번 들리거나 음색이 얇아질 수 있다.

1. FRETON 출력을 음소거한 채 줄을 튕긴다. Matribox 헤드폰에서 들리는 기타 소리는 장비 경로에 해당한다.
2. 브라우저 처리음만 식별하려면 우선 헤드폰을 **Mac의 유선 출력**에 연결하고 앱 출력 또는 macOS 사운드 출력에서 해당 장치를 선택한다. 입력은 Matribox를 유지한다. 스피커로 전환되지 않았는지 확인한 다음 낮은 Master에서 소프트웨어 모니터링과 출력을 켠다. [Apple 사운드 출력 설정](https://support.apple.com/ko-kr/guide/mac-help/mchl9777ee30/mac)
3. FRETON Delay를 켜 한 음을 튕기고 Wet과 Dry를 전환한다. FRETON Mute 시 이 헤드폰의 기타 소리가 사라지는지 확인한다. 이전 장비 출력으로 돌아갈 때는 먼저 음소거하고 물리 볼륨을 낮춘다.
4. Matribox 헤드폰으로 USB 리턴을 들으려면 출력 장치를 Matribox로 선택한 뒤 같은 비교를 반복한다. 직접음이 남으면 두 경로가 섞였음을 기록한다. 브라우저가 출력 선택을 제공하지 않으면 개인 Mac의 사운드 설정에서 출력 경로를 확인한다. [W3C Web Audio 출력 장치](https://www.w3.org/TR/webaudio/#dom-audiocontext-setsinkid)

## NAM과 캐비닛

사용 권한과 샘플레이트를 확인한 로컬 `.nam` 파일로 시험한다. Dry 입력과 낮은 Master에서 시작해 모델 로딩 결과, 모델 요구 샘플레이트, 실제 AudioContext 샘플레이트를 기록한다. 모델에 캐비닛까지 캡처되어 있으면 Cabinet IR을 끄고 비교한다. 캐비닛을 제외한 앰프 캡처는 로컬 IR을 별도로 켜서 비교할 수 있다. FRETON에서의 모델 전환은 브라우저의 오디오 그래프에 적용된다. Matribox 본체의 프리셋과 Rec Mode는 본체에서 설정한다. [NAM 연동 및 한계](./nam-integration.md)
