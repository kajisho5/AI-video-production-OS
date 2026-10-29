# 組織図 / Org charts

`ecosystem.json` から生成した図です。手で描き直さず、台帳を直してから再生成してください。

```bash
node scripts/orgchart.mjs        # Playwright があれば PNG も出力(無ければ HTML のみ)
```

| 図 | 内容 |
|---|---|
| [overview.png](overview.png) | 全体: 司令塔 → 各部門 → 実行基盤、保留中のリポジトリ |
| [ingest.png](ingest.png) | 取込部門(素材の取り込み・バックアップ) |
| [visual.png](visual.png) | 映像部門 |
| [audio.png](audio.png) | 音部門 |
| [recognize.png](recognize.png) | 認識部門 |
| [verify.png](verify.png) | 検証部門 |
| [delivery.png](delivery.png) | 納品部門(ディスク作成はオプション) |
| [utility.png](utility.png) | 補助 |
| [governance.png](governance.png) | 統制(スキル契約・エコシステム監査) |
| [command.png](command.png) / [engine.png](engine.png) | 司令塔 / 実行基盤 |

担当(`owns`)の重複は禁止で、テストで検出します。方針は [ADR-012](../../adr/ADR-012-ownership-map-and-org-chart.md)。
