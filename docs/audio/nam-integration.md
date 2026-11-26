# 로컬 NAM 모델과 WASM 엔진

## 패키지와 자산

2026-11-25에 공식 npm 레지스트리에서 확인한 버전은 `neural-amp-modeler-wasm@3.3.0`이다. 공개 진입점 `neural-amp-modeler-wasm/engine`으로 FRETON의 오디오 그래프에 모노 입출력 노드를 삽입할 수 있다. npm에 선언된 React 및 React DOM 동료 의존성은 모두 `^18.0.0`이다. [npm 배포 정보](https://registry.npmjs.org/neural-amp-modeler-wasm/3.3.0) · [공식 엔진 사용법](https://github.com/tone-3000/neural-amp-modeler-wasm/tree/main/ui#readme)

패키지는 프로세서 `dist/engine/nam-worklet.js`와 바이너리 `dist/engine/nam-engine.wasm`을 제공한다. 직접 배치할 경우 같은 디렉터리에 원래 파일명으로 두고 그 디렉터리를 `assetBaseUrl`에 전달한다. WASM 바이트는 메인 스레드에서 가져와 Worklet으로 전달한다. HTTPS 또는 localhost에서 구동하며 이 버전은 SharedArrayBuffer나 COOP/COEP 헤더를 요구하지 않는다. [엔진 구현](https://github.com/tone-3000/neural-amp-modeler-wasm/blob/main/ui/src/engine/NamEngine.ts) · [공식 빌드 구조](https://github.com/tone-3000/neural-amp-modeler-wasm#architecture)

## 재생 중 모델 수명

FRETON은 Vite의 패키지 상대 자산 URL 처리를 쓴다. 개발 모드에서는 엔진 진입점을 사전 번들에서 제외하고, 프로덕션에서는 Vite가 두 자산을 해시된 이름으로 번들링한다. 로컬 모델은 JSON·계수·채널·샘플레이트를 검사하고 실제 Worklet의 성공 응답 이후에만 슬롯에 연결한다. 모델 호출에는 응답 시간 제한이 있으며 프로세서 오류 시 기본 DSP 경로로 복귀한다. 실시간 Chrome과 빌드본에서 직접 작성한 Linear 모델을 로드했다. [실행 결과](../testing/software-test.md)

| 순서          | 호출                                           | 확인할 점                                                                                                 |
| ------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 초기화        | `await NamEngine.attach(context, assets)`      | 같은 컨텍스트에서 모듈 등록과 자산 읽기를 공유한다.                                                       |
| 인스턴스 생성 | `await engine.createNode()`                    | WASM 인스턴스 초기화 응답까지 기다린다.                                                                   |
| 모델 로딩     | `await node.loadModel(await file.text())`      | JSON 문자열을 전달한다. 성공 응답의 `expectedSampleRate`로 호환성을 확인한다.                             |
| 모델 교체     | 새 노드에서 `loadModel` 성공 후 기존 노드 해제 | 새 파일이 형식·레이트 검사에서 실패하면 기존 모델을 유지한다. 파싱 중 무중단 연주는 실기기 검증 대상이다. |
| 모델 해제     | `await node.unloadModel()`                     | 모델이 없는 노드는 입력을 그대로 통과시킨다.                                                              |
| 노드 폐기     | `await node.dispose()`                         | Worklet의 응답을 받을 수 있을 때 완료한 뒤 컨텍스트를 닫는다.                                             |

모델 사용 여부와 캐비닛 IR 사용 여부는 별개다. 캡처 설명에서 앰프 출력만 녹음했는지, 캐비닛과 마이크까지 포함했는지 확인한다. 후자에서 별도 IR을 켜면 두 번 필터링된다. 고정 캡처 앞의 입력 증폭은 모델로 들어가는 신호 크기를 조절한다. 캡처 장비의 게인 회로를 다시 설정하는 기능은 모델 파일에 들어 있지 않다. [공개 노드 API](https://github.com/tone-3000/neural-amp-modeler-wasm/blob/main/ui/src/engine/NamEngine.ts)

## 샘플레이트와 오프라인 출력

Settings의 엔진 샘플레이트에서 출력 장치 기본값, 44.1, 48, 96 kHz를 고를 수 있다. 다음 시작 또는 수동 재시작에 적용한다. 모델은 요구 레이트와 실제 컨텍스트가 일치할 때 활성화된다. 슬롯은 모델 구조와 요구 레이트를 표시하고, 파일의 gear_type에서 확인할 수 있는 앰프·캐비닛 유형을 제안한다. 사용자가 수정한 캡처 유형과 바이패스는 같은 파일을 다시 연결할 때 유지한다. SHA-256 지문이 없는 이전 참조는 파일명을 사용한다. [공식 NAM 장비 메타데이터](https://github.com/sdatkinson/neural-amp-modeler/blob/main/nam/models/metadata.py)

코어는 모델 최상위 `sample_rate`를 읽고 값이 없으면 `-1`을 반환한다. WASM 래퍼는 현재 컨텍스트의 샘플레이트로 모델을 초기화한 뒤 입력 프레임을 그대로 전달한다. 두 레이트 사이의 변환을 보장하는 공개 API는 확인되지 않았다. 따라서 모델 레이트가 다르면 수치를 함께 표시하고, 값이 없으면 호환성을 확인할 수 없다고 표시한다. 파일 디코더가 오디오 파일을 컨텍스트 레이트로 변환해도 모델의 요구 레이트는 그대로다. [코어 파일 파서](https://github.com/sdatkinson/NeuralAmpModelerCore/blob/v0.5.4/NAM/get_dsp.cpp) · [WASM 처리 코드](https://github.com/tone-3000/neural-amp-modeler-wasm/blob/main/wasm/nam-engine.cpp)

`NamEngine.attach`의 인수 타입은 `BaseAudioContext`다. 공식 예제는 실시간 `AudioContext`를 사용한다. 메시지 포트 초기화·모델 로딩·렌더 시작까지 포함한 `OfflineAudioContext` 지원 절차는 공식 문서에서 확인하지 못했다. Phase 0에서 기본 DSP의 오프라인 WAV 검증과 NAM의 실시간 처리는 별도로 평가한다. [공식 패키지 README](https://github.com/tone-3000/neural-amp-modeler-wasm/tree/main/ui#readme)

## 장비 없는 검증용 모델

Virtual Rig와 Audio Sandbox에서 **NAM 모델 라이브러리**를 열면 엔진 시작 전에도 로컬 .nam을 검사하고 보관할 수 있다. 목록의 구조·레이트·캡처 유형은 파일에서 읽은 값이다. 엔진을 시작하고 **모델 적용**을 눌렀을 때 지문과 실제 레이트를 다시 검사하고 Worklet에서 모델을 로드한다. 엔진을 중지하거나 프리셋을 바꾸면 진행 중이던 라이브러리 읽기의 늦은 결과를 폐기한다. [저장·복원 방식](../adr/0008-local-nam-library.md)

RiffSmith Distorted는 Matt Hartman이 학습한 48 kHz 앰프·캐비닛 캡처다. 저장소의 고정 버전과 지문을 기록하고 개발 앱 및 빌드본의 Worklet에서 활성화했다. Chrome 개발 앱에서 750 Hz WAV를 처리하여 3차 고조파와 바이패스 복귀를 측정했다. [캡처·원본 출처·MIT 고지](../../assets/test-audio/riffsmith/README.md) · [측정 결과](../testing/software-test.md)

공식 코어의 `Linear`는 FIR 계수와 바이어스를 읽는다. 다음은 직접 정한 단일 계수로 구성한 기술 검증용 JSON이다. `sample_rate`에는 검사할 컨텍스트 값을 넣는다. 모델 교체 시 0.25를 0.5로 바꾸면 충분히 안정된 사인파의 RMS 비율이 약 2배가 되는지 비교할 수 있다. 같은 레벨의 Dry/Wet을 비교할 때는 다른 이펙터와 캐비닛 IR을 먼저 우회한다. Worklet의 초기 페이드와 10 Hz DC 차단 필터가 적용되므로 첫 몇 프레임의 값은 판정에서 제외한다. [Linear 구조](https://github.com/sdatkinson/NeuralAmpModelerCore/blob/v0.5.4/NAM/linear.cpp) · [Worklet 구현](https://github.com/tone-3000/neural-amp-modeler-wasm/blob/main/ui/src/engine/nam-worklet.ts)

```json
{
  "version": "0.5.4",
  "architecture": "Linear",
  "config": { "receptive_field": 1, "bias": false },
  "metadata": {},
  "weights": [0.25],
  "sample_rate": 48000
}
```

이 검사는 로딩과 신호 처리를 판정한다. 실제 앰프 캡처의 음질·연주감·장시간 성능은 모델과 실기기로 별도 확인한다. 실행 결과는 [소프트웨어 테스트 기록](../testing/software-test.md)과 [하드웨어 테스트 기록](../testing/hardware-test.md)을 따른다.

`npm run bench:nam`은 프로덕션 빌드의 같은 오디오 그래프에서 NAM 미연결, Linear, RiffSmith를 비교한다. 요구 레이트가 다른 학습 캡처는 로드 거부를 확인하고 호환되는 조합만 측정한다. [모델별 처리 시간과 재현 방법](../testing/nam-performance.md)

## 라이선스

TONE3000의 WASM 패키지 3.3.0과 Steven Atkinson의 NeuralAmpModelerCore v0.5.4는 각각 MIT 라이선스로 배포된다. 바이너리를 배포할 때 저작권 고지와 허가문을 함께 보존한다. npm에 포함된 엔진 자산과 GitHub 데모 라이브러리는 배포 경로도 다르다. 데모 모델을 복사할 경우 파일별 제작자·원본·상업적 사용 및 재배포 조건을 확인해야 한다. FRETON의 한 계수 예제는 직접 구성했으며 학습 데이터나 외부 캡처의 가중치를 포함하지 않는다. [WASM 라이선스](https://github.com/tone-3000/neural-amp-modeler-wasm/blob/main/LICENSE) · [코어 라이선스](https://github.com/sdatkinson/NeuralAmpModelerCore/blob/v0.5.4/LICENSE) · [데모 모델과 기여자](https://github.com/tone-3000/neural-amp-modeler-wasm/blob/main/ui/public/models/README.md)
