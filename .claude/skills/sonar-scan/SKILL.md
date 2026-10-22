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
2. **掃描**（在 repo 根目錄執行，log 寫到暫存目錄）。工作目錄有未完成的修改時先問使用者：上傳的是工作目錄，不是 HEAD。

   ```powershell
   $env:PATH += ";$env:USERPROFILE\.dotnet\tools"
   dotnet-sonarscanner begin /k:"ying0515_cms-1019" /n:"ying0515_cms-1019" `
     /d:sonar.host.url="http://10.0.1.41:9000" /d:sonar.token="$env:SONAR_TOKEN" `
     /d:sonar.exclusions="**/node_modules/**,**/dist/**,**/.angular/**,**/bin/**,**/obj/**,**/coverage/**" `
     /d:sonar.cs.opencover.reportsPaths=".sonarqube/coverage/**/coverage.opencover.xml" `
     /d:sonar.javascript.lcov.reportPaths="src/CMS.NG/coverage/cms-ng/lcov.info" `
     /d:sonar.coverage.exclusions="**/*.spec.ts,**/testing/**,src/CMS.NG/karma.conf.js" `
     /d:sonar.cpd.exclusions="src/CMS.NG/src/app/features/**"
   dotnet build src\CMS.sln --no-incremental
   dotnet test src\CMS.sln --no-build --collect "XPlat Code Coverage;Format=opencover" --results-directory .sonarqube\coverage
   Push-Location src\CMS.NG; npx ng test --watch=false --browsers=ChromeHeadless --code-coverage; Pop-Location
   dotnet-sonarscanner end /d:sonar.token="$env:SONAR_TOKEN"
   ```

   任一步驟失敗就停下，回報 log 最後 30 行。成功時 log 會出現 `ANALYSIS SUCCESSFUL`，且有 `Sensor JavaScript/TypeScript Coverage` 與 `C# Tests Coverage Report Import`。

   - lcov 屬性是 `reportPaths`（OpenCover 才是 `reportsPaths`），打錯不會報錯，只會讓前端覆蓋率變 0。
   - `karma.conf.js` 的 `lcovonly` 以 repo 根目錄為 `projectRoot`，SonarQube 才對得到檔案。
   - `features/**` 是 `/crud` 樣板產生的頁面，刻意排除在重複檢查外；共用邏輯的重構另案處理。
3. **取回結果**（`Authorization: Bearer $env:SONAR_TOKEN`）：
   - `GET /api/qualitygates/project_status?projectKey=ying0515_cms-1019`
   - `GET /api/measures/component?component=ying0515_cms-1019&metricKeys=bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,ncloc,reliability_rating,security_rating,sqale_rating`
   - `GET /api/issues/search?componentKeys=ying0515_cms-1019&resolved=false&ps=1&facets=impactSeverities,impactSoftwareQualities,rules,languages`

   Analysis token 可能沒有讀取權限（回 `Insufficient privileges`），此時只附 dashboard 連結。
4. **回報**（繁體中文）：Quality Gate、指標表格、前幾名規則與數量、dashboard 連結
   `http://10.0.1.41:9000/dashboard?id=ying0515_cms-1019`。對安全性漏洞先看原始碼再判斷是否為誤報。

## 注意

- 掃描會在 repo 根目錄產生 `.sonarqube/`（含覆蓋率報告），已列入 `.gitignore`，不要 commit。前端報告在 `src/CMS.NG/coverage/`，也已忽略。
- Quality Gate 看「新程式碼」：覆蓋率 ≥ 80%、重複率 ≤ 3%、新問題 0。
- 不修改程式碼；修正問題需使用者另外要求。
