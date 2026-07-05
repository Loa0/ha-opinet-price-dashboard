# Opinet Price Dashboard

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
title: ⛽ 오피넷 주유소  # 생략 가능
show_usage: true         # API 사용량 표시 (기본: true)
```

### 지도카드

```yaml
type: custom:opinet-map-card
```

> `ha-opinet-price` 통합구성요소가 설치되어 있으면 주유소 위치를 자동으로 찾아 지도에 표시합니다.

## 요구사항

- Home Assistant 2022.11+
- [ha-opinet-price](https://github.com/Loa0/ha-opinet-price) 통합구성요소 v1.7.0+
