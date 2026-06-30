---
type: "SocialGraph"
title: "Social Graph"
description: "Connection map and relationship registry of all individuals in the vault."
timestamp: "2026-06-30T18:25:11Z"
---
# Social Graph

## Connection Map

```mermaid
flowchart LR
    2CRF["2025 Country Report - France"]
    2CRI["2025 Country Report - Italy"]
    2CRP["2025 Country Report - Poland"]
    2CRR["2025 Country Report - Romania"]
    2CRS["2025 Country Report - Slovakia"]
    EC["European Commission"]
    H["Hungary"]
    EC -- "author of" --> 2CRF
    EC -- "authored" --> 2CRI
    EC -- "authored" --> 2CRP
    EC -- "authored" --> 2CRR
    EC -- "author of" --> 2CRS
    EC -- "author of report on" --> H
```

## Relationship Registry

| Person A | Connection | Person B | Context / Source |
| :--- | :--- | :--- | :--- |
| [[European Commission]] | author of | [[2025 Country Report - France]] | [[2025 Country Report - France]] |
| [[European Commission]] | authored | [[2025 Country Report - Italy]] | [[2025 Country Report - Italy]] |
| [[European Commission]] | authored | [[2025 Country Report - Poland]] | [[2025 Country Report - Poland]] |
| [[European Commission]] | authored | [[2025 Country Report - Romania]] | [[2025 Country Report - Romania]] |
| [[European Commission]] | author of | [[2025 Country Report - Slovakia]] | [[2025 Country Report - Slovakia]] |
| [[European Commission]] | author of report on | [[Hungary]] | [[EU Commission (2025) 2025 Country Report - Hungary]] |
