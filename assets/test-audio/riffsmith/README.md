# RiffSmith Distorted 검증용 캡처

`riffsmith-distorted.nam`은 Matt Hartman이 본인 장비로 학습하고 MIT 라이선스로 공개한 기타 톤 캡처다. 원본 파일을 그대로 보관하며 인접한 LICENSE.txt에 저작권 및 허가 고지가 있다. FRETON은 이 파일을 개발용 브라우저 검사와 수동 파일 선택에 사용한다. [제작자의 모델별 라이선스 설명](https://github.com/hartmamt/riffsmith/blob/228b801ccc8b518d0a1fb53a8e63355a2fbd153f/README.md#credits-and-licenses) · [원본 모델](https://github.com/hartmamt/riffsmith/blob/228b801ccc8b518d0a1fb53a8e63355a2fbd153f/public/nam/models/riffsmith-distorted.nam) · [라이선스](LICENSE.txt)

| 항목             | 값                                                                 |
| ---------------- | ------------------------------------------------------------------ |
| 원본 커밋        | `228b801ccc8b518d0a1fb53a8e63355a2fbd153f`                         |
| SHA-256          | `ec52e16296f96fdd1d07d1aaa699e33e17df253f026f785f135080e1eb5db007` |
| 모델 형식        | NAM 0.7.0, SlimmableContainer, WaveNet 서브모델 2개                |
| 모델 요구 레이트 | 48,000 Hz                                                          |
| 파일 메타데이터  | `gear_type=amp_cab`, 앰프와 캐비닛 포함                            |

Settings에서 엔진 샘플레이트를 48,000 Hz로 선택하고 엔진을 시작하거나 재시작한다. Virtual Rig → 모델 & 캐비닛 → NAM 파일 선택에서 이 파일을 연다. 별도 Cabinet IR을 끄고 B · WET과 A · DRY를 전환해 같은 입력으로 비교한다. [소프트웨어 측정 기록](../../../docs/testing/software-test.md)
