---
name: sonar-scan
description: Run a SonarQube analysis of the whole CMS repo (.NET API + Angular) against the team SonarQube server and summarize the results. Use when asked to "掃描程式碼", "跑 SonarQube", "sonar scan", or check code quality / quality gate.
---

# /sonar-scan — SonarQube 掃描

將 `src/CMS.sln`（C#）與 `src/CMS.NG`（TS/HTML）上傳到團隊 SonarQube，並回報摘要。

## 設定

| 項目 | 值 |
|---|---|
| Server | `http://10.0.1.41:9000` |
| Project key / name | `ying0515_cms-1019` |
| Token | 環境變數 `SONAR_TOKEN`（**絕不寫進 repo 或任何檔案**） |

Token 由每位成員在 SonarQube「My Account → Security」自行產生，設成使用者環境變數：

```powershell
[Environment]::SetEnvironmentVariable('SONAR_TOKEN', '<token>', 'User')   # 設完重開終端機
```

若 `SONAR_TOKEN` 未設定，停下來請使用者設定，不要向使用者索取 token 貼在對話中。

## 步驟

1. **前置檢查**：`$env:SONAR_TOKEN` 有值；`dotnet-sonarscanner` 已安裝，沒有就 `dotnet tool install --global dotnet-sonarscanner`。不需另外裝 Java（掃描器會自動下載 JRE）。
2. **掃描**（在 repo 根目錄執行，log 寫到暫存目錄）：

   ```powershell
   $env:PATH += ";$env:USERPROFILE\.dotnet\tools"
   dotnet-sonarscanner begin /k:"ying0515_cms-1019" /n:"ying0515_cms-1019" `
     /d:sonar.host.url="http://10.0.1.41:9000" /d:sonar.token="$env:SONAR_TOKEN" `
     /d:sonar.exclusions="**/node_modules/**,**/dist/**,**/.angular/**,**/bin/**,**/obj/**"
   dotnet build src\CMS.sln --no-incremental
   dotnet-sonarscanner end /d:sonar.token="$env:SONAR_TOKEN"
   ```

   任一步驟失敗就停下，回報 log 最後 30 行。成功時 log 會出現 `ANALYSIS SUCCESSFUL`。
3. **取回結果**（`Authorization: Bearer $env:SONAR_TOKEN`）：
   - `GET /api/qualitygates/project_status?projectKey=ying0515_cms-1019`
   - `GET /api/measures/component?component=ying0515_cms-1019&metricKeys=bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,ncloc,reliability_rating,security_rating,sqale_rating`
   - `GET /api/issues/search?componentKeys=ying0515_cms-1019&resolved=false&ps=1&facets=impactSeverities,impactSoftwareQualities,rules,languages`

   Analysis token 可能沒有讀取權限（回 `Insufficient privileges`），此時只附 dashboard 連結。
4. **回報**（繁體中文）：Quality Gate、指標表格、前幾名規則與數量、dashboard 連結
   `http://10.0.1.41:9000/dashboard?id=ying0515_cms-1019`。對安全性漏洞先看原始碼再判斷是否為誤報。

## 注意

- 掃描會在 repo 根目錄產生 `.sonarqube/`，已列入 `.gitignore`，不要 commit。
- 不修改程式碼；修正問題需使用者另外要求。
