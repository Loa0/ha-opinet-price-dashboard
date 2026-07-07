# Opinet Price Dashboard

> ⚠️ 한국 Opinet API 기반으로 **대한민국에서만** 사용 가능한 대시보드 카드입니다.

오피넷 주유소 최저가 통합구성요소([ha-opinet-price](https://github.com/Loa0/ha-opinet-price))의 Lovelace 대시보드 카드입니다.

![icon](https://raw.githubusercontent.com/Loa0/ha-opinet-price-dashboard/master/icon.png)

## 포함된 카드

| 카드 | 타입 | 설명 |
|---|---|---|
| 랭킹보드 | `custom:opinet-rank-card` | 1~10위 주유소 리스트 + 갱신버튼 |
| 지도 | `custom:opinet-map-card` | 기기단위 지도, 가격 마커 |

## 설치 방법 (HACS)

1. HACS → 프론트엔드 → 우측 상단 ⋮ → 커스텀 저장소
2. Repository: `Loa0/ha-opinet-price-dashboard`, Category: `Dashboard` 입력 후 추가
3. "Opinet Price Dashboard" 검색 후 설치
4. 브라우저 새로고침 (F5)

## 사용법

### 랭킹보드

```yaml
type: custom:opinet-rank-card
device: sensor.opines_juyuso_1wi   # 대상 기기 (다중 인스턴스 시 필수)
title: ⛽ 경유 최저가               # 제목 (기본: ⛽ 오피넷 주유소)
show_usage: true                   # API 사용량 표시 (기본: true)
show_fav: true                     # 즐겨찾기 표시 (기본: false)
```

> `device`는 해당 통합구성요소 인스턴스의 아무 순위 센서 entity_id를 지정합니다. 단일 인스턴스 환경에서는 생략 가능합니다.
>
> 행을 클릭하면 주유소명·가격·주소·브랜드·거리 팝업이 열리며, **네이버지도·카카오맵·Tmap** 앱/웹 내비게이션으로 바로 연결할 수 있습니다.

### 지도카드

```yaml
type: custom:opinet-map-card
device: sensor.opines_juyuso_1wi   # 대상 기기 (다중 인스턴스 시 필수)
```

> `device`는 해당 통합구성요소 인스턴스의 아무 순위 센서 entity_id를 지정합니다. 단일 인스턴스 환경에서는 생략 가능합니다.
>
> 마커를 클릭하면 주유소명·가격·주소 팝업이 표시되며, **네이버지도·카카오맵·Tmap** 내비게이션으로 바로 이동할 수 있습니다.

## 요구사항

- Home Assistant 2022.11+
- [ha-opinet-price](https://github.com/Loa0/ha-opinet-price) 통합구성요소 v1.10.15+

## 면책사항

본 대시보드 카드는 Opinet, Tmap, VWorld의 공식 제품이 아니며, 각 사와 어떠한 제휴 관계도 없음을 알려드립니다.

- 표시되는 유가 정보는 Opinet API의 갱신 주기에 따르므로, 실제 주유소 가격과 시차가 있을 수 있습니다.
- 제3자 API의 점검이나 장애로 인해 일부 기능이 일시적으로 제한될 수 있습니다.
- 본 카드 사용으로 발생하는 모든 책임은 사용자에게 있습니다.
