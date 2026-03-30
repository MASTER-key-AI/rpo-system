/**
 * DB -> Google Spreadsheet sync for all companies.
 *
 * Entry points:
 * - syncAllCompanies()
 * - syncCompanyByName(companyName)
 * - dryRunAllCompanies()
 * - dryRunCompanyByName(companyName)
 * - discoverAndSyncNewCompanies()
 * - setupStatusCheckboxValidationAllCompanies()
 *
 * Required Script Properties:
 * - RPO_API_URL          (e.g. https://example.com/api/sync/applicants)
 * - RPO_API_KEY
 *
 * Optional Script Properties:
 * - RPO_SYNC_PAGE_SIZE
 * - RPO_COMPANIES_API_URL  (e.g. https://example.com/api/sync/companies — defaults to RPO_API_URL sister path)
 * - RPO_TEMPLATE_SPREADSHEET_ID (defaults to TEMPLATE_SPREADSHEET_ID below)
 */

const DB_SHEET_SYNC_CONFIG = {
  request: {
    defaultPageSize: 200,
    maxPagesPerCompany: 50,
    lockWaitMs: 25000,
    timeoutMs: 30000,
    maxRetries: 3,
    retryBaseSleepMs: 800,
    safeTimeLimitMs: 5 * 60 * 1000, // 5 min (GAS limit = 6 min)
  },
  properties: {
    apiUrl: 'RPO_API_URL',
    apiKey: 'RPO_API_KEY',
    pageSize: 'RPO_SYNC_PAGE_SIZE',
    companiesApiUrl: 'RPO_COMPANIES_API_URL',
    templateSpreadsheetId: 'RPO_TEMPLATE_SPREADSHEET_ID',
  },
  state: {
    keyPrefix: 'RPO_SYNC_LAST_',
    dynamicCompaniesKey: 'RPO_DYNAMIC_COMPANIES',
  },
  sheet: {
    targetSheetName: '候補者管理',
    targetGid: 465742923,
    headerRow: 1,
    dataStartRow: 2,
    keyHeader: '_applicant_id',
    minKeyColumn: 30, // AD
    columns: {
      name: 11, // K
      furigana: 12, // L
      phone: 13, // M
      email: 14, // N
      notes: 15, // O (備考)
      gender: 16, // P
      birthDate: 17, // Q
      statusStart: 20, // T
      statusEnd: 29, // AC
    },
  },
  autoCreate: {
    templateSpreadsheetId: '1GT9SaY2laeD03EDg6LTl4TqjoQdroNffuOcilcqmSBA',
    templateGid: 465742923,
    namingPattern: '【RPO】{companyName}_候補者管理',
  },
};

const DB_SHEET_SYNC_COMPANIES = [
  { code: 'company_001', name: '大阪機器工作所', spreadsheetId: '1eVO3Ix9o08M17w87wOdJiOLfd668oEXjfKbpcnmm-J0', gid: 465742923, enabled: true },
  { code: 'company_002', name: 'TKC株式会社/YMD株式会社', spreadsheetId: '1paHNHLJjBxBIgbY1ki7IoocqKBKpFGmlDvT4ormpOl4', gid: 465742923, enabled: true },
  { code: 'company_003', name: 'AYKサービス株式会社', spreadsheetId: '1mCCVIsDxYsv0VNV4yJ3-o4hQ7gyt-ic6mZ_xqdNZD_c', gid: 465742923, enabled: true },
  { code: 'company_004', name: '株式会社ULC', spreadsheetId: '1kDs6q2B1SgXKzYszN5tpV23CKaj8hyO6k5WGLYN1kvE', gid: 465742923, enabled: true },
  { code: 'company_005', name: '株式会社ハーツ', spreadsheetId: '11h3bQXaU0oTIeMTlUrVUpr5qZyx1cadP0UV10RVUhhs', gid: 465742923, enabled: true },
  { code: 'company_006', name: '株式会社前田営工センター', spreadsheetId: '1lnBf9iw-qAicp_ATetjVPaBIVz8NFGHD5gyjdloV6w0', gid: 465742923, enabled: true },
  { code: 'company_007', name: '株式会社有明', spreadsheetId: '1-1DWyCMHRgmfSUNTd_xCGGSyA_g0ENHPeqZP1EVbju8', gid: 465742923, enabled: true },
  { code: 'company_008', name: 'ミナミ住設', spreadsheetId: '1LgbrIA6oGUPA9E8QAgzL2kgQJlJ6yAzGi7KVQd8R3oQ', gid: 465742923, enabled: true },
  { code: 'company_009', name: 'ライフコア株式会社', spreadsheetId: '1hSn-ihHRgo6sY9SWBxHjpo9aBgihgwRp_PSV4c2XmBo', gid: 465742923, enabled: true },
  { code: 'company_010', name: '株式会社エムワイジー', spreadsheetId: '14zZaFjh2URJb9s4IilYILmsUwSBbf2m-B2gbo3p5XHM', gid: 465742923, enabled: true },
  { code: 'company_011', name: '株式会社レックホーム', spreadsheetId: '1PQEQG1NhZL6HY6r8QToYMe6xOe4augONxsbP_guxGvI', gid: 465742923, enabled: true },
  { code: 'company_012', name: '株式会社東京ハーツ', spreadsheetId: '1vnPNPiaBEBR7-mbBmk8pXvYuAjyTrTDsP7GdX5ukB9k', gid: 465742923, enabled: true },
  { code: 'company_013', name: '西新町二丁目クリニック', spreadsheetId: '1MTL76bmjOlBAdQ-AcBk7tJkIlMip_X5apfmzQ6nF6xA', gid: 465742923, enabled: true },
  { code: 'company_014', name: 'ウェルネス・コーチ（エニタイム）', spreadsheetId: '1_t1zLBmwOBJ48ySObioIxSlwOYyVmsYaxSiIQF6DJkE', gid: 465742923, enabled: true },
  { code: 'company_015', name: '株式会社SHINYUU', spreadsheetId: '1svT2wawOkPTilKGeTiB4fCtRw4EMuJwF_gWuLTAhpck', gid: 465742923, enabled: true },
  { code: 'company_016', name: '株式会社アースデザイン', spreadsheetId: '1ItZ4uTDJwRfSMihUUcVRc9KLGMN7vldDnp8NWSUJ7KE', gid: 465742923, enabled: true },
  { code: 'company_017', name: 'エース建設', spreadsheetId: '1VID7MYQRePbmDLwCfO-NSjCWuqd_hXtKQBJNSwjOQyA', gid: 465742923, enabled: true },
  { code: 'company_018', name: 'OG建設', spreadsheetId: '1DqtfrVYNIk6x0xrIU7-OLHApOyZqMGplvm1gCDoXPvw', gid: 465742923, enabled: true },
  { code: 'company_019', name: '仁美工業', spreadsheetId: '15_8pWdEmCZF4MIX4AmF-3KQXtXfnphpaALmvgdLasBw', gid: 465742923, enabled: true },
  { code: 'company_020', name: '株式会社オルグージョジャパン', spreadsheetId: '1QN2XzsVWcilQ0Cstm-Pg5HYv09b55uUKv0ZVilpdoCU', gid: 465742923, enabled: true },
  { code: 'company_021', name: '株式会社太田不動産', spreadsheetId: '1ruFJltIrt_QoH_ooAuDKV0mnpf6KFP6cwgrgi-EOMf4', gid: 465742923, enabled: true },
  { code: 'company_022', name: '株式会社大豊工業所', spreadsheetId: '1aL2AN8TQY38VAvgNhzZA1UmJ20lQ5JY5liZwBpTeU_Y', gid: 465742923, enabled: true },
  { code: 'company_023', name: '株式会社大雄工業', spreadsheetId: '1qSkYWmKoLmwT2lIYDF_8HBEAfaD1KeTqqpKlOJLompI', gid: 465742923, enabled: true },
  { code: 'company_024', name: '株式会社徳信商会（高石）', spreadsheetId: '1baWrUIfKt9LytQlJmJL7W8Hft9hA-PDyd-pVgNFdMXw', gid: 465742923, enabled: true },
  { code: 'company_025', name: '株式会社北野田ガスセンター', spreadsheetId: '1yE31V0Y4OT9mM-8cc1y5YiK5PwjD5t4b1ERD6hLVpXw', gid: 465742923, enabled: true },
  { code: 'company_026', name: '株式会社Uca', spreadsheetId: '1SBMnQqcohUXxnMYitVqXJneyMI74eDvqFdeyYBKwJlw', gid: 465742923, enabled: true },
];

/* ============================
 * Entry Points
 * ============================ */

function syncAllCompanies() {
  return DbSheetSyncApp.runAll({ dryRun: false });
}

function dryRunAllCompanies() {
  return DbSheetSyncApp.runAll({ dryRun: true });
}

function syncCompanyByName(companyName) {
  return DbSheetSyncApp.runSingle(companyName, { dryRun: false });
}

function dryRunCompanyByName(companyName) {
  return DbSheetSyncApp.runSingle(companyName, { dryRun: true });
}

function discoverAndSyncNewCompanies() {
  return DbSheetSyncApp.discoverAndSync({ dryRun: false });
}

function dryRunDiscoverNewCompanies() {
  return DbSheetSyncApp.discoverAndSync({ dryRun: true });
}

function setupStatusCheckboxValidationAllCompanies() {
  const companies = getAllCompanyConfigs_();
  for (const company of companies) {
    try {
      const sheet = SheetSyncClient.getTargetSheet(company);
      SheetSyncClient.setupStatusCheckboxValidation(sheet);
      Logger.log(`checkbox rule set: ${company.name}`);
    } catch (e) {
      Logger.log(`[WARN] checkbox setup failed: ${company.name} err=${errorToMessage_(e)}`);
    }
  }
}

function debugFetchCompanyApi(companyName) {
  DbSyncClient.validateConfigOrThrow();
  const company = getAllCompanyConfigs_().find(function (c) { return c.name === companyName; });
  if (!company) {
    throw new Error('company not found: ' + companyName);
  }
  const result = DbSyncClient.debugFetchFirstPage(company);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/* ============================
 * DbSheetSyncApp (Orchestrator)
 * ============================ */

const DbSheetSyncApp = (function () {
  function runAll(opts) {
    var dryRun = opts.dryRun;
    DbSyncClient.validateConfigOrThrow();
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(DB_SHEET_SYNC_CONFIG.request.lockWaitMs)) {
      throw new Error('Another sync execution is running.');
    }

    try {
      var companies = getAllCompanyConfigs_();
      return syncCompanyList_(companies, { dryRun: dryRun });
    } finally {
      lock.releaseLock();
    }
  }

  function runSingle(companyName, opts) {
    var dryRun = opts.dryRun;
    DbSyncClient.validateConfigOrThrow();
    var company = getAllCompanyConfigs_().find(function (c) { return c.name === companyName; });
    if (!company) {
      throw new Error('company not found: ' + companyName);
    }
    return syncCompany_(company, { dryRun: dryRun });
  }

  function discoverAndSync(opts) {
    var dryRun = opts.dryRun;
    DbSyncClient.validateConfigOrThrow();
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(DB_SHEET_SYNC_CONFIG.request.lockWaitMs)) {
      throw new Error('Another sync execution is running.');
    }

    try {
      var dbCompanies = CompanyDiscovery.fetchDbCompanies();
      var knownNames = buildKnownCompanyNameSet_();
      var newCompanies = [];

      for (var i = 0; i < dbCompanies.length; i++) {
        var dbCo = dbCompanies[i];
        if (knownNames[dbCo.name]) continue;
        newCompanies.push(dbCo);
      }

      if (!newCompanies.length) {
        Logger.log('[INFO] No new companies found in DB.');
        return { newCompanies: 0, created: 0, synced: 0 };
      }

      Logger.log('[INFO] New companies found: ' + newCompanies.length + ' — ' + newCompanies.map(function (c) { return c.name; }).join(', '));

      var created = 0;
      var synced = 0;
      var allCompanies = getAllCompanyConfigs_();

      for (var j = 0; j < newCompanies.length; j++) {
        if (isTimeLimitApproaching_()) {
          Logger.log('[WARN] time limit approaching during discovery. Stopping.');
          break;
        }

        var dbCo2 = newCompanies[j];
        try {
          var newConfig = CompanyDiscovery.createSpreadsheetForCompany(dbCo2.name, { dryRun: dryRun });
          if (newConfig) {
            created++;
            if (!dryRun) {
              saveDynamicCompany_(newConfig);
              allCompanies.push(newConfig);
              var result = syncCompany_(newConfig, { dryRun: false });
              if (result) synced++;
            }
          }
        } catch (e) {
          Logger.log('[ERROR] Failed to create/sync for: ' + dbCo2.name + ' err=' + errorToMessage_(e));
        }
      }

      var summary = { newCompanies: newCompanies.length, created: created, synced: synced, dryRun: dryRun };
      Logger.log(JSON.stringify(summary, null, 2));
      return summary;
    } finally {
      lock.releaseLock();
    }
  }

  function syncCompanyList_(companies, opts) {
    var dryRun = opts.dryRun;
    var summary = {
      companyCount: companies.length,
      processedCompanies: 0,
      successCompanies: 0,
      failedCompanies: 0,
      skippedByTimeLimit: 0,
      totalFetched: 0,
      totalInitialMatchedByNameEmail: 0,
      totalUpdated: 0,
      totalAppended: 0,
      totalUnchanged: 0,
      totalWriteFailed: 0,
      totalSkipped: 0,
    };

    for (var i = 0; i < companies.length; i++) {
      var company = companies[i];

      if (isTimeLimitApproaching_()) {
        summary.skippedByTimeLimit = companies.length - i;
        Logger.log('[WARN] time limit approaching. Processed ' + i + '/' + companies.length + ' companies.');
        break;
      }

      summary.processedCompanies += 1;
      try {
        var result = syncCompany_(company, { dryRun: dryRun });
        summary.successCompanies += 1;
        summary.totalFetched += result.fetched;
        summary.totalInitialMatchedByNameEmail += result.initialMatchedByNameEmail || 0;
        summary.totalUpdated += result.updated;
        summary.totalAppended += result.appended;
        summary.totalUnchanged += result.unchanged || 0;
        summary.totalWriteFailed += result.writeFailed || 0;
        summary.totalSkipped += result.skipped;
      } catch (e) {
        summary.failedCompanies += 1;
        Logger.log('[ERROR] ' + company.name + ': ' + errorToMessage_(e));
      }
    }

    Logger.log(JSON.stringify({ mode: dryRun ? 'dryRun' : 'sync', summary: summary }, null, 2));
    return summary;
  }

  function syncCompany_(company, opts) {
    var dryRun = opts.dryRun;
    var sheet = SheetSyncClient.getTargetSheet(company);
    var keyCol = SheetSyncClient.ensureKeyColumn(sheet, { dryRun: dryRun });

    // Single sheet read → build all indexes at once
    var indexes = SheetSyncClient.buildAllIndexes(sheet, keyCol);
    var keyIndex = indexes.keyIndex;
    var nameEmailIndex = indexes.nameEmailIndex;
    var rowDataIndex = indexes.rowDataIndex;

    // Delta sync: use last sync timestamp
    var stateKey = DB_SHEET_SYNC_CONFIG.state.keyPrefix + (company.code || company.name);
    var updatedAfter = getScriptProperty_(stateKey);

    var rawRecords = DbSyncClient.fetchAllUpdatedRecords(company, updatedAfter);
    var mappedRecords = RecordMapper.toMappedRecords(rawRecords);
    var dedupedRecords = dedupeByApplicantId_(mappedRecords);

    var updates = [];
    var appends = [];
    var skipped = 0;
    var unchanged = 0;
    var initialMatchedByNameEmail = 0;
    var writeFailed = 0;
    var appliedUpdates = 0;
    var appliedAppends = 0;
    var reservedRows = {};

    for (var i = 0; i < dedupedRecords.length; i++) {
      var rec = dedupedRecords[i];
      if (!rec.applicantId) {
        skipped += 1;
        continue;
      }

      var row = keyIndex[rec.applicantId];
      var matchedByNameEmail = false;

      if (!row) {
        var fallbackKey = makeNameEmailMatchKey_(rec.name, rec.email);
        var fallbackRow = fallbackKey ? nameEmailIndex[fallbackKey] : 0;
        if (fallbackRow) {
          row = fallbackRow;
          keyIndex[rec.applicantId] = fallbackRow;
          matchedByNameEmail = true;
        }
      }

      if (row) {
        if (reservedRows[row] && reservedRows[row] !== rec.applicantId) {
          skipped += 1;
          Logger.log('[WARN] row conflict on ' + company.name + ': row=' + row + ', applicantId=' + rec.applicantId + ', existing=' + reservedRows[row]);
          continue;
        }
        reservedRows[row] = rec.applicantId;
        if (SheetSyncClient.hasRowDiff(rowDataIndex[row], keyCol, rec)) {
          updates.push({ row: row, record: rec });
          if (matchedByNameEmail) {
            initialMatchedByNameEmail += 1;
          }
        } else {
          unchanged += 1;
        }
      } else {
        appends.push(rec);
      }
    }

    logAppendCandidates_(company, appends, { dryRun: dryRun });

    if (!dryRun) {
      var updateResult = SheetSyncClient.applyUpdates(sheet, keyCol, updates);
      var appendResult = SheetSyncClient.appendRowsBatch(sheet, keyCol, appends);
      writeFailed = (updateResult.failed || 0) + (appendResult.failed || 0);
      appliedUpdates = updateResult.updated || 0;
      appliedAppends = appendResult.appended || 0;

      // Save last sync timestamp for delta sync
      if (rawRecords.length > 0) {
        var latest = latestUpdatedAt_(mappedRecords);
        if (latest) {
          PropertiesService.getScriptProperties().setProperty(stateKey, latest);
        }
      }
    }

    var result = {
      company: company.name,
      fetched: rawRecords.length,
      mapped: mappedRecords.length,
      deduped: dedupedRecords.length,
      initialMatchedByNameEmail: initialMatchedByNameEmail,
      updated: dryRun ? updates.length : appliedUpdates,
      appended: dryRun ? appends.length : appliedAppends,
      unchanged: unchanged,
      writeFailed: writeFailed,
      skipped: skipped,
      updatedAfter: updatedAfter,
      dryRun: dryRun,
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }

  function dedupeByApplicantId_(records) {
    var latestMap = {};
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var id = rec.applicantId;
      if (!id) continue;

      var existing = latestMap[id];
      if (!existing) {
        latestMap[id] = rec;
        continue;
      }

      var nextTime = toEpoch_(rec.updatedAt);
      var prevTime = toEpoch_(existing.updatedAt);
      if (nextTime >= prevTime) {
        latestMap[id] = rec;
      }
    }
    return Object.keys(latestMap).map(function (k) { return latestMap[k]; });
  }

  function latestUpdatedAt_(records) {
    var latest = '';
    var latestMs = 0;
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (!rec.updatedAt) continue;
      var ms = toEpoch_(rec.updatedAt);
      if (ms > latestMs) {
        latestMs = ms;
        latest = rec.updatedAt;
      }
    }
    return latest;
  }

  function toEpoch_(value) {
    if (!value) return 0;
    var d = new Date(value);
    var ms = d.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  function logAppendCandidates_(company, appends, opts) {
    if (!appends || !appends.length) return;

    var mode = opts.dryRun ? 'dryRun' : 'sync';
    var previewLimit = 200;
    var preview = [];

    for (var i = 0; i < appends.length && i < previewLimit; i++) {
      var rec = appends[i];
      preview.push({
        index: i + 1,
        applicantId: String(rec.applicantId || ''),
        name: String(rec.name || ''),
        email: String(rec.email || ''),
      });
    }

    Logger.log('[INFO] append candidates company=' + company.name + ' mode=' + mode + ' count=' + appends.length + ' preview=' + JSON.stringify(preview));
    if (appends.length > previewLimit) {
      Logger.log('[INFO] append candidates truncated company=' + company.name + ' omitted=' + (appends.length - previewLimit));
    }
  }

  return { runAll: runAll, runSingle: runSingle, discoverAndSync: discoverAndSync };
})();

/* ============================
 * CompanyDiscovery (Auto-create spreadsheets)
 * ============================ */

const CompanyDiscovery = (function () {
  function fetchDbCompanies() {
    var url = getCompaniesApiUrl_();
    var apiKey = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.apiKey);
    if (!url || !apiKey) {
      throw new Error('Companies API URL or API key is not configured.');
    }

    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'x-rpo-api-key': apiKey },
      muteHttpExceptions: true,
      validateHttpsCertificates: true,
    });

    var status = response.getResponseCode();
    var text = String(response.getContentText() || '');

    if (status < 200 || status >= 300) {
      throw new Error('Companies API failed (' + status + '): ' + truncateText_(text, 500));
    }

    var body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('Companies API returned non-JSON: ' + truncateText_(text, 300));
    }

    var root = (body && body.data) ? body.data : body;
    var list = root.companies || root.items || root.list || [];
    if (!Array.isArray(list)) return [];

    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item && typeof item === 'object' && item.name) {
        out.push({ id: String(item.id || ''), name: String(item.name).trim() });
      }
    }
    return out;
  }

  function createSpreadsheetForCompany(companyName, opts) {
    var dryRun = opts.dryRun;
    var templateId = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.templateSpreadsheetId)
      || DB_SHEET_SYNC_CONFIG.autoCreate.templateSpreadsheetId;

    if (!templateId) {
      throw new Error('Template spreadsheet ID is not configured.');
    }

    var sheetName = DB_SHEET_SYNC_CONFIG.autoCreate.namingPattern.replace('{companyName}', companyName);

    if (dryRun) {
      Logger.log('[DRYRUN] Would create spreadsheet: ' + sheetName + ' from template: ' + templateId);
      return null;
    }

    var templateFile = DriveApp.getFileById(templateId);
    var newFile = templateFile.makeCopy(sheetName);
    var newSpreadsheetId = newFile.getId();

    Logger.log('[INFO] Created spreadsheet: ' + sheetName + ' id=' + newSpreadsheetId);

    // Set up checkbox validation on the new spreadsheet
    try {
      var ss = SpreadsheetApp.openById(newSpreadsheetId);
      var targetSheet = ss.getSheetByName(DB_SHEET_SYNC_CONFIG.sheet.targetSheetName);
      if (!targetSheet) {
        targetSheet = findSheetByGid_(ss, DB_SHEET_SYNC_CONFIG.autoCreate.templateGid);
      }
      if (targetSheet) {
        SheetSyncClient.setupStatusCheckboxValidation(targetSheet);
      }
    } catch (e) {
      Logger.log('[WARN] checkbox setup on new sheet failed: ' + errorToMessage_(e));
    }

    return {
      code: '',
      name: companyName,
      spreadsheetId: newSpreadsheetId,
      gid: DB_SHEET_SYNC_CONFIG.sheet.targetGid,
      enabled: true,
      autoCreated: true,
    };
  }

  function getCompaniesApiUrl_() {
    var explicit = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.companiesApiUrl);
    if (explicit) return explicit;

    // Derive from RPO_API_URL: replace /api/sync/applicants with /api/sync/companies
    var baseUrl = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.apiUrl);
    if (!baseUrl) return '';

    return baseUrl.replace(/\/api\/sync\/applicants\b/, '/api/sync/companies');
  }

  return { fetchDbCompanies: fetchDbCompanies, createSpreadsheetForCompany: createSpreadsheetForCompany };
})();

/* ============================
 * DbSyncClient (API Communication)
 * ============================ */

const DbSyncClient = (function () {
  function validateConfigOrThrow() {
    var url = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.apiUrl);
    var apiKey = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.apiKey);
    if (!url) {
      throw new Error('Missing Script Property: ' + DB_SHEET_SYNC_CONFIG.properties.apiUrl);
    }
    if (!apiKey) {
      throw new Error('Missing Script Property: ' + DB_SHEET_SYNC_CONFIG.properties.apiKey);
    }

    if (isLikelyInboundEndpoint_(url)) {
      throw new Error(
        'RPO_API_URL is /api/inbound/indeed. This is an inbound endpoint for 1件受信, not a DB 差分取得 endpoint.'
        + ' DB sync requires an endpoint that returns applicant list data.'
      );
    }
  }

  function isLikelyInboundEndpoint_(url) {
    return String(url || '').indexOf('/api/inbound/indeed') !== -1;
  }

  function fetchAllUpdatedRecords(company, updatedAfter) {
    var url = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.apiUrl);
    var apiKey = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.apiKey);
    var pageSize = getPageSize_();
    var maxPages = DB_SHEET_SYNC_CONFIG.request.maxPagesPerCompany;

    var cursor = '';
    var page = 0;
    var out = [];

    while (page < maxPages) {
      page += 1;
      var res = fetchUpdatedRecordsPage_(url, apiKey, company, updatedAfter, cursor, pageSize);
      out.push.apply(out, res.records);
      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }

    if (page >= maxPages && cursor) {
      throw new Error('max pages reached for ' + company.name + '. Increase maxPagesPerCompany.');
    }

    return out;
  }

  function debugFetchFirstPage(company) {
    var pageSize = getPageSize_();
    var url = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.apiUrl);
    var apiKey = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.apiKey);
    var payload = buildPayload_(company, '', '', pageSize);

    var response = postJsonWithRetry_(url, apiKey, payload, company.name);
    var status = response.getResponseCode();
    var text = String(response.getContentText() || '');

    return {
      company: company.name,
      endpoint: url,
      status: status,
      requestPayload: payload,
      responsePreview: truncateText_(text, 1200),
    };
  }

  function fetchUpdatedRecordsPage_(url, apiKey, company, updatedAfter, cursor, pageSize) {
    var payload = buildPayload_(company, updatedAfter, cursor, pageSize);

    var response = postJsonWithRetry_(url, apiKey, payload, company.name);
    var status = response.getResponseCode();
    var text = String(response.getContentText() || '');

    if (status < 200 || status >= 300) {
      throw new Error(
        'DB sync API failed (' + status + ') company=' + company.name + ' ' +
        'payload=' + truncateText_(JSON.stringify(payload), 400) + ' ' +
        'response=' + truncateText_(text, 800)
      );
    }

    var body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('DB sync API returned non-JSON: ' + text);
    }

    var root = (body && Object.prototype.hasOwnProperty.call(body, 'data')) ? body.data : body;
    var records = extractRecords_(root);
    var nextCursor = extractNextCursor_(root);

    if (!cursor) {
      var matchedCompanies = extractMatchedCompanies_(root);
      if (matchedCompanies.length) {
        Logger.log('[INFO] matched companies company=' + company.name + ' matched=' + JSON.stringify(matchedCompanies));
      }
    }

    return { records: records, nextCursor: nextCursor };
  }

  function postJsonWithRetry_(url, apiKey, payload, companyName) {
    var maxRetries = Math.max(1, Number(DB_SHEET_SYNC_CONFIG.request.maxRetries || 3));
    var baseSleep = Math.max(100, Number(DB_SHEET_SYNC_CONFIG.request.retryBaseSleepMs || 800));
    var lastErr = null;

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        var response = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          headers: { 'x-rpo-api-key': apiKey },
          muteHttpExceptions: true,
          followRedirects: true,
          validateHttpsCertificates: true,
        });

        var status = response.getResponseCode();
        if (!isRetryableStatus_(status) || attempt === maxRetries) {
          return response;
        }

        var waitMs = baseSleep * Math.pow(2, attempt - 1);
        Logger.log('[WARN] retryable API status company=' + companyName + ' attempt=' + attempt + '/' + maxRetries + ' status=' + status + ' waitMs=' + waitMs);
        Utilities.sleep(waitMs);
      } catch (e) {
        lastErr = e;
        if (attempt === maxRetries) {
          break;
        }
        var waitMs2 = baseSleep * Math.pow(2, attempt - 1);
        Logger.log('[WARN] API request exception company=' + companyName + ' attempt=' + attempt + '/' + maxRetries + ' waitMs=' + waitMs2 + ' err=' + errorToMessage_(e));
        Utilities.sleep(waitMs2);
      }
    }

    throw new Error(
      'DB sync API request failed after retries company=' + companyName + ' ' +
      'payload=' + truncateText_(JSON.stringify(payload), 400) + ' ' +
      'err=' + errorToMessage_(lastErr)
    );
  }

  function buildPayload_(company, updatedAfter, cursor, pageSize) {
    return {
      companyCode: company.code || '',
      companyName: company.name,
      name: company.name,
      company: company.name,
      company_name: company.name,
      updatedAfter: updatedAfter || '',
      updated_after: updatedAfter || '',
      cursor: cursor || '',
      nextCursor: cursor || '',
      limit: pageSize,
      pageSize: pageSize,
    };
  }

  function normalizeRecords_(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    for (var i = 0; i < value.length; i++) {
      if (value[i] && typeof value[i] === 'object') {
        out.push(value[i]);
      }
    }
    return out;
  }

  function extractRecords_(root) {
    if (Array.isArray(root)) {
      return normalizeRecords_(root);
    }
    if (!root || typeof root !== 'object') {
      return [];
    }
    return normalizeRecords_(root.records || root.items || root.list || root.results || []);
  }

  function extractNextCursor_(root) {
    if (!root || typeof root !== 'object' || Array.isArray(root)) {
      return '';
    }
    return String(root.nextCursor || root.next_cursor || root.cursor || '');
  }

  function extractMatchedCompanies_(root) {
    if (!root || typeof root !== 'object' || Array.isArray(root)) {
      return [];
    }
    var list = root.matchedCompanies || root.matched_companies || root.resolvedCompanies || root.resolved_companies || [];
    if (!Array.isArray(list)) return [];
    var out = [];
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var name = String(list[i] || '').trim();
      if (!name) continue;
      if (seen[name]) continue;
      seen[name] = true;
      out.push(name);
    }
    return out;
  }

  function isRetryableStatus_(status) {
    return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }

  function getPageSize_() {
    var raw = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.pageSize);
    var n = Number(raw || DB_SHEET_SYNC_CONFIG.request.defaultPageSize);
    return (Number.isFinite(n) && n > 0) ? Math.floor(n) : DB_SHEET_SYNC_CONFIG.request.defaultPageSize;
  }

  return { validateConfigOrThrow: validateConfigOrThrow, fetchAllUpdatedRecords: fetchAllUpdatedRecords, debugFetchFirstPage: debugFetchFirstPage };
})();

/* ============================
 * SheetSyncClient (Spreadsheet R/W)
 * ============================ */

const SheetSyncClient = (function () {
  function getTargetSheet(company) {
    var spreadsheet = SpreadsheetApp.openById(company.spreadsheetId);
    var targetSheetName = company.sheetName || DB_SHEET_SYNC_CONFIG.sheet.targetSheetName;
    if (targetSheetName) {
      var sheetByName = spreadsheet.getSheetByName(targetSheetName);
      if (sheetByName) {
        return sheetByName;
      }
    }

    var targetGid = company.gid || DB_SHEET_SYNC_CONFIG.sheet.targetGid;
    if (targetGid) {
      var sheetByGid = findSheetByGid_(spreadsheet, targetGid);
      if (sheetByGid) {
        return sheetByGid;
      }
    }

    throw new Error('target sheet not found: ' + company.name + ' (sheetName=' + targetSheetName + ', gid=' + targetGid + ')');
  }

  function ensureKeyColumn(sheet, opts) {
    var dryRun = opts.dryRun;
    var headerRow = DB_SHEET_SYNC_CONFIG.sheet.headerRow;
    var lastCol = Math.max(sheet.getLastColumn(), DB_SHEET_SYNC_CONFIG.sheet.minKeyColumn);
    var headerValues = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];

    for (var i = 0; i < headerValues.length; i++) {
      if (String(headerValues[i] || '').trim() === DB_SHEET_SYNC_CONFIG.sheet.keyHeader) {
        return i + 1;
      }
    }

    if (dryRun) {
      return 0;
    }

    var keyCol = Math.max(DB_SHEET_SYNC_CONFIG.sheet.minKeyColumn, sheet.getLastColumn() + 1);
    try {
      sheet.getRange(headerRow, keyCol).setValue(DB_SHEET_SYNC_CONFIG.sheet.keyHeader);
      return keyCol;
    } catch (e) {
      Logger.log('[WARN] key column header write skipped (protected?): sheet=' + sheet.getName() + ' col=' + keyCol + ' err=' + errorToMessage_(e));
      return 0;
    }
  }

  // Single sheet read → builds all three indexes at once
  function buildAllIndexes(sheet, keyCol) {
    var c = DB_SHEET_SYNC_CONFIG.sheet.columns;
    var startRow = DB_SHEET_SYNC_CONFIG.sheet.dataStartRow;
    var lastRow = sheet.getLastRow();
    if (lastRow < startRow) return { keyIndex: {}, nameEmailIndex: {}, rowDataIndex: {} };

    var width = Math.max((keyCol || 0), c.statusEnd, c.birthDate, c.email, c.name);
    var values = sheet.getRange(startRow, 1, lastRow - startRow + 1, width).getValues();

    var keyIndex = {};
    var nameEmailIndex = {};
    var duplicateKeys = {};
    var rowDataIndex = {};

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var rowNumber = startRow + i;
      rowDataIndex[rowNumber] = row;

      // keyIndex
      if (keyCol && keyCol > 0) {
        var id = String(row[keyCol - 1] || '').trim();
        if (id && !keyIndex[id]) {
          keyIndex[id] = rowNumber;
        }
      }

      // nameEmailIndex (only for rows without applicantId)
      if (keyCol && keyCol > 0) {
        var applicantId = String(row[keyCol - 1] || '').trim();
        if (applicantId) continue;
      }

      var key = makeNameEmailMatchKey_(row[c.name - 1], row[c.email - 1]);
      if (!key) continue;

      if (Object.prototype.hasOwnProperty.call(nameEmailIndex, key)) {
        delete nameEmailIndex[key];
        duplicateKeys[key] = true;
        continue;
      }
      if (!duplicateKeys[key]) {
        nameEmailIndex[key] = rowNumber;
      }
    }

    return { keyIndex: keyIndex, nameEmailIndex: nameEmailIndex, rowDataIndex: rowDataIndex };
  }

  function hasRowDiff(rowValues, keyCol, rec) {
    if (!rowValues || !rowValues.length) return true;
    var c = DB_SHEET_SYNC_CONFIG.sheet.columns;
    var currentBasic = [
      normalizeComparableText_(rowValues[c.name - 1]),
      normalizeComparableText_(rowValues[c.furigana - 1]),
      normalizePhoneForDiff_(rowValues[c.phone - 1]),
      normalizeEmailForMatch_(rowValues[c.email - 1]),
      normalizeComparableText_(rowValues[c.notes - 1]),
      normalizeComparableText_(rowValues[c.gender - 1]),
      normalizeBirthDateForDiff_(rowValues[c.birthDate - 1]),
    ];
    var nextBasic = [
      normalizeComparableText_(rec.name),
      normalizeComparableText_(rec.furigana),
      normalizePhoneForDiff_(rec.phone),
      normalizeEmailForMatch_(rec.email),
      normalizeComparableText_(rec.notes),
      normalizeComparableText_(rec.gender),
      normalizeBirthDateForDiff_(rec.birthDate),
    ];

    for (var i = 0; i < currentBasic.length; i++) {
      if (currentBasic[i] !== nextBasic[i]) {
        return true;
      }
    }

    for (var j = 0; j < rec.statusValues.length; j++) {
      var currentStatus = to01ForDiff_(rowValues[c.statusStart + j - 1]);
      if (currentStatus !== to01ForDiff_(rec.statusValues[j])) {
        return true;
      }
    }

    if (keyCol && keyCol > 0) {
      var currentApplicantId = String(rowValues[keyCol - 1] || '').trim();
      if (currentApplicantId !== String(rec.applicantId || '').trim()) {
        return true;
      }
    }

    return false;
  }

  function to01ForDiff_(value) {
    if (value === true) return 1;
    if (value === false) return 0;
    if (typeof value === 'number') return value > 0 ? 1 : 0;

    var s = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
    if (!s) return 0;
    if (s === 'true' || s === 'yes' || s === 'on') return 1;
    if (s === 'false' || s === 'no' || s === 'off') return 0;

    var n = Number(s);
    if (Number.isFinite(n)) return n > 0 ? 1 : 0;
    return 0;
  }

  function normalizePhoneForDiff_(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .replace(/[^\d+]/g, '');
  }

  function normalizeBirthDateForDiff_(value) {
    if (value === null || value === undefined || value === '') return '';

    if (Object.prototype.toString.call(value) === '[object Date]') {
      return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd');
    }

    var raw = String(value).trim();
    if (!raw) return '';

    var m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) {
      var mm = String(Number(m[2])).padStart(2, '0');
      var dd = String(Number(m[3])).padStart(2, '0');
      return m[1] + '-' + mm + '-' + dd;
    }

    var d = new Date(raw);
    if (Number.isFinite(d.getTime())) {
      return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
    }

    return raw;
  }

  function applyUpdates(sheet, keyCol, updates) {
    var c = DB_SHEET_SYNC_CONFIG.sheet.columns;
    var updated = 0;
    var failed = 0;

    for (var i = 0; i < updates.length; i++) {
      var item = updates[i];
      var row = item.row;
      var rec = item.record;
      var okBasic = safeSetValues_(
        sheet.getRange(row, c.name, 1, c.birthDate - c.name + 1),
        [[rec.name, rec.furigana, rec.phone, rec.email, rec.notes, rec.gender, rec.birthDate]],
        'update KQ row=' + row
      );
      var okStatus = safeSetValues_(
        sheet.getRange(row, c.statusStart, 1, c.statusEnd - c.statusStart + 1),
        [rec.statusValues],
        'update status row=' + row
      );

      var okKey = true;
      if (keyCol && keyCol > 0) {
        okKey = safeSetValue_(
          sheet.getRange(row, keyCol),
          rec.applicantId,
          'update applicant_id row=' + row
        );
      }

      if (okBasic && okStatus && okKey) {
        updated += 1;
      } else {
        failed += 1;
      }
    }

    return { updated: updated, failed: failed };
  }

  // Batch append — writes all rows in a single setValues call per region
  function appendRowsBatch(sheet, keyCol, records) {
    if (!records.length) return { appended: 0, failed: 0 };
    var c = DB_SHEET_SYNC_CONFIG.sheet.columns;
    var startRow = Math.max(sheet.getLastRow() + 1, DB_SHEET_SYNC_CONFIG.sheet.dataStartRow);

    var basicData = [];
    var statusData = [];
    var keyData = [];

    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      basicData.push([rec.name, rec.furigana, rec.phone, rec.email, rec.notes, rec.gender, rec.birthDate]);
      statusData.push(rec.statusValues);
      keyData.push([rec.applicantId]);
    }

    var failed = 0;

    if (!safeSetValues_(
      sheet.getRange(startRow, c.name, records.length, c.birthDate - c.name + 1),
      basicData,
      'batch append basic rows=' + records.length
    )) {
      failed++;
    }

    if (!safeSetValues_(
      sheet.getRange(startRow, c.statusStart, records.length, c.statusEnd - c.statusStart + 1),
      statusData,
      'batch append status rows=' + records.length
    )) {
      failed++;
    }

    if (keyCol && keyCol > 0) {
      if (!safeSetValues_(
        sheet.getRange(startRow, keyCol, records.length, 1),
        keyData,
        'batch append key rows=' + records.length
      )) {
        failed++;
      }
    }

    var appended = failed > 0 ? 0 : records.length;
    return { appended: appended, failed: failed > 0 ? records.length : 0 };
  }

  function setupStatusCheckboxValidation(sheet) {
    var c = DB_SHEET_SYNC_CONFIG.sheet.columns;
    var startRow = DB_SHEET_SYNC_CONFIG.sheet.dataStartRow;
    var maxRows = sheet.getMaxRows();
    if (maxRows < startRow) return;
    var rowCount = maxRows - startRow + 1;
    var colCount = c.statusEnd - c.statusStart + 1;

    var rule = SpreadsheetApp.newDataValidation()
      .requireCheckbox('1', '0')
      .build();

    sheet.getRange(startRow, c.statusStart, rowCount, colCount).setDataValidation(rule);
  }

  function safeSetValues_(range, values, meta) {
    try {
      range.setValues(values);
      return true;
    } catch (e) {
      Logger.log('[WARN] write skipped (' + meta + ') sheet=' + range.getSheet().getName() + ' err=' + errorToMessage_(e));
      return false;
    }
  }

  function safeSetValue_(range, value, meta) {
    try {
      range.setValue(value);
      return true;
    } catch (e) {
      Logger.log('[WARN] write skipped (' + meta + ') sheet=' + range.getSheet().getName() + ' err=' + errorToMessage_(e));
      return false;
    }
  }

  return {
    getTargetSheet: getTargetSheet,
    ensureKeyColumn: ensureKeyColumn,
    buildAllIndexes: buildAllIndexes,
    hasRowDiff: hasRowDiff,
    applyUpdates: applyUpdates,
    appendRowsBatch: appendRowsBatch,
    setupStatusCheckboxValidation: setupStatusCheckboxValidation,
  };
})();

/* ============================
 * RecordMapper
 * ============================ */

const RecordMapper = (function () {
  var FIELD_KEYS = {
    applicantId: ['applicantId', 'applicant_id', 'id', 'entryId', 'entry_id'],
    name: ['name', 'fullName', 'full_name', 'candidateName', 'candidate_name', '氏名'],
    email: ['email', 'mail', 'mailAddress', 'mail_address', 'メール', 'メールアドレス'],
    furigana: ['furigana', 'kana', 'ruby', 'nameKana', 'name_kana', 'ふりがな'],
    phone: ['phone', 'phoneNumber', 'phone_number', 'tel', 'telephone', '電話番号'],
    notes: ['notes', 'memo', '備考', 'メモ'],
    gender: ['gender', 'sex', '性別'],
    birthDate: ['birthDate', 'birth_date', 'birthday', 'dateOfBirth', 'date_of_birth', '生年月日'],
    updatedAt: ['updatedAt', 'updated_at'],
  };

  var STATUS_KEYS = {
    validApply: ['validApply', 'validApplyCount', 'valid_apply', 'valid_apply_count', '有効応募数'],
    absent: ['absent', 'absentCount', 'absent_count', '不在'],
    connected: ['connected', 'connection', 'connectedCount', 'connected_count', '通電'],
    interviewSet: ['interviewSet', 'interviewConfirmed', 'interview_confirmed', '面談確定'],
    seated: ['seated', 'seat', 'seatedCount', 'seated_count', '着席数'],
    rejected: ['rejected', 'reject', 'rejectedCount', 'rejected_count', '不採用'],
    offer: ['offer', 'offered', 'offerCount', 'offer_count', '内定'],
    offerDeclined: ['offerDeclined', 'declinedAfterOffer', 'offer_declined', '内定後辞退'],
    joined: ['joined', 'joinedCount', 'joined_count', '入社'],
    left: ['left', 'leftCount', 'left_count', 'resigned', '退職'],
  };

  function toMappedRecords(rawRecords) {
    var out = [];
    for (var i = 0; i < rawRecords.length; i++) {
      var mapped = toMappedRecord_(rawRecords[i]);
      if (mapped) out.push(mapped);
    }
    return out;
  }

  function toMappedRecord_(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var applicantId = asString_(pickValue_(raw, FIELD_KEYS.applicantId));
    if (!applicantId) return null;

    return {
      applicantId: applicantId,
      name: asString_(pickValue_(raw, FIELD_KEYS.name)),
      email: normalizeEmailForMatch_(pickValue_(raw, FIELD_KEYS.email)),
      furigana: asString_(pickValue_(raw, FIELD_KEYS.furigana)),
      phone: normalizePhone_(pickValue_(raw, FIELD_KEYS.phone)),
      notes: asString_(pickValue_(raw, FIELD_KEYS.notes)),
      gender: asString_(pickValue_(raw, FIELD_KEYS.gender)),
      birthDate: normalizeBirthDate_(pickValue_(raw, FIELD_KEYS.birthDate)),
      statusValues: [
        to01_(pickStatusValue_(raw, STATUS_KEYS.validApply)),
        to01_(pickStatusValue_(raw, STATUS_KEYS.absent)),
        to01_(pickStatusValue_(raw, STATUS_KEYS.connected)),
        to01_(pickStatusValue_(raw, STATUS_KEYS.interviewSet)),
        to01_(pickStatusValue_(raw, STATUS_KEYS.seated)),
        to01_(pickStatusValue_(raw, STATUS_KEYS.rejected)),
        to01_(pickStatusValue_(raw, STATUS_KEYS.offer)),
        to01_(pickStatusValue_(raw, STATUS_KEYS.offerDeclined)),
        to01_(pickStatusValue_(raw, STATUS_KEYS.joined)),
        to01_(pickStatusValue_(raw, STATUS_KEYS.left)),
      ],
      updatedAt: asString_(pickValue_(raw, FIELD_KEYS.updatedAt)),
    };
  }

  function pickStatusValue_(raw, keys) {
    var direct = pickValue_(raw, keys);
    if (direct !== null && direct !== undefined && direct !== '') return direct;

    var nestedKeys = ['counts', 'statusCounts', 'statuses', 'metrics', 'result'];
    for (var i = 0; i < nestedKeys.length; i++) {
      var container = raw[nestedKeys[i]];
      if (!container || typeof container !== 'object') continue;
      var nested = pickValue_(container, keys);
      if (nested !== null && nested !== undefined && nested !== '') {
        return nested;
      }
    }
    return 0;
  }

  function pickValue_(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(obj, keys[i])) {
        return obj[keys[i]];
      }
    }
    return '';
  }

  function to01_(value) {
    if (value === true) return 1;
    if (value === false) return 0;
    if (typeof value === 'number') return value > 0 ? 1 : 0;

    var s = String(value || '').trim().toLowerCase();
    if (!s) return 0;
    if (s === 'true' || s === 'yes' || s === 'on') return 1;
    if (s === 'false' || s === 'no' || s === 'off') return 0;

    var n = Number(s);
    if (Number.isFinite(n)) return n > 0 ? 1 : 0;
    return 0;
  }

  function normalizePhone_(value) {
    var s = asString_(value);
    return s.replace(/[^\d+]/g, '');
  }

  function normalizeBirthDate_(value) {
    if (value === null || value === undefined || value === '') return '';

    if (Object.prototype.toString.call(value) === '[object Date]') {
      return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd');
    }

    var raw = String(value).trim();
    if (!raw) return '';

    var m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) {
      return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
    }

    var d = new Date(raw);
    if (Number.isFinite(d.getTime())) {
      return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
    }

    return raw;
  }

  function asString_(value) {
    return String(value === null || value === undefined ? '' : value).trim();
  }

  function pad2_(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value).padStart(2, '0');
    return String(n).padStart(2, '0');
  }

  return { toMappedRecords: toMappedRecords };
})();

/* ============================
 * Dynamic Company Management
 * ============================ */

function getAllCompanyConfigs_() {
  var staticCompanies = DB_SHEET_SYNC_COMPANIES.filter(function (c) { return c.enabled; });
  var dynamicCompanies = loadDynamicCompanies_();
  return staticCompanies.concat(dynamicCompanies);
}

function buildKnownCompanyNameSet_() {
  var configs = getAllCompanyConfigs_();
  var set = {};
  for (var i = 0; i < configs.length; i++) {
    set[configs[i].name] = true;
  }
  return set;
}

function loadDynamicCompanies_() {
  var raw = getScriptProperty_(DB_SHEET_SYNC_CONFIG.state.dynamicCompaniesKey);
  if (!raw) return [];
  try {
    var list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(function (c) { return c && c.name && c.spreadsheetId && c.enabled !== false; });
  } catch (e) {
    Logger.log('[WARN] Failed to parse dynamic companies: ' + errorToMessage_(e));
    return [];
  }
}

function saveDynamicCompany_(config) {
  var existing = loadDynamicCompanies_();
  var found = false;
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].name === config.name) {
      existing[i] = config;
      found = true;
      break;
    }
  }
  if (!found) {
    existing.push(config);
  }
  PropertiesService.getScriptProperties().setProperty(
    DB_SHEET_SYNC_CONFIG.state.dynamicCompaniesKey,
    JSON.stringify(existing)
  );
}

/* ============================
 * Shared Utilities
 * ============================ */

var syncStartTime_ = Date.now();

function isTimeLimitApproaching_() {
  return (Date.now() - syncStartTime_) > DB_SHEET_SYNC_CONFIG.request.safeTimeLimitMs;
}

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function errorToMessage_(e) {
  if (!e) return 'unknown error';
  if (e.stack) return String(e.stack);
  if (e.message) return String(e.message);
  return String(e);
}

function truncateText_(text, maxLen) {
  var s = String(text || '');
  var n = Number(maxLen || 0);
  if (!Number.isFinite(n) || n <= 0) return s;
  if (s.length <= n) return s;
  return s.slice(0, n) + '...';
}

function makeNameEmailMatchKey_(name, email) {
  var n = normalizeNameForMatch_(name);
  var m = normalizeEmailForMatch_(email);
  if (!n || !m) return '';
  return n + '||' + m;
}

function normalizeNameForMatch_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/[ 　]+/g, '')
    .trim();
}

function normalizeEmailForMatch_(value) {
  return String(value === null || value === undefined ? '' : value)
    .trim()
    .toLowerCase();
}

function normalizeComparableText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function findSheetByGid_(spreadsheet, gid) {
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) {
      return sheets[i];
    }
  }
  return null;
}


/* ============================
 * Two-way Sync (Notes) Trigger
 * ============================ */

function setupOnEditTriggersAll() {
  var companies = getAllCompanyConfigs_();
  var count = 0;
  for (var i = 0; i < companies.length; i++) {
    var co = companies[i];
    if (!co.spreadsheetId) continue;
    try {
      var triggers = ScriptApp.getUserTriggers(SpreadsheetApp.openById(co.spreadsheetId));
      var hasTrigger = false;
      for (var j = 0; j < triggers.length; j++) {
        if (triggers[j].getHandlerFunction() === 'onEditNotesSync') {
          hasTrigger = true;
          break;
        }
      }
      if (!hasTrigger) {
        ScriptApp.newTrigger('onEditNotesSync')
          .forSpreadsheet(co.spreadsheetId)
          .onEdit()
          .create();
        count++;
        Logger.log('Created onEditNotesSync trigger for ' + co.name);
      }
    } catch (e) {
      Logger.log('[WARN] Failed to create trigger for ' + co.name + ': ' + errorToMessage_(e));
    }
  }
  Logger.log('Finished setting up triggers. New triggers created: ' + count);
}

function onEditNotesSync(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== DB_SHEET_SYNC_CONFIG.sheet.targetSheetName) return;

  var row = e.range.getRow();
  var col = e.range.getColumn();
  var numRows = e.range.getNumRows();

  // Ensure edit overlaps the notes column
  var notesCol = DB_SHEET_SYNC_CONFIG.sheet.columns.notes || 15;
  var startRow = DB_SHEET_SYNC_CONFIG.sheet.dataStartRow || 2;
  
  // Check if edited range includes Notes column
  if (col > notesCol || (col + e.range.getNumColumns() - 1) < notesCol) return;
  if (row + numRows - 1 < startRow) return;

  var url = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.apiUrl);
  if (!url) return;
  var notesUrl = url.replace(/\/api\/sync\/applicants\b/, '/api/sync/notes');
  var apiKey = getScriptProperty_(DB_SHEET_SYNC_CONFIG.properties.apiKey);

  var keyCol = 0;
  var lastCol = Math.max(sheet.getLastColumn(), 24);
  var headerValues = sheet.getRange(DB_SHEET_SYNC_CONFIG.sheet.headerRow, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headerValues.length; i++) {
    if (String(headerValues[i] || '').trim() === DB_SHEET_SYNC_CONFIG.sheet.keyHeader) {
      keyCol = i + 1;
      break;
    }
  }
  if (!keyCol) return;

  for (var r = 0; r < numRows; r++) {
    var currentRow = row + r;
    if (currentRow < startRow) continue;
    var applicantId = String(sheet.getRange(currentRow, keyCol).getValue() || '').trim();
    if (!applicantId) continue;

    var newNotes = String(sheet.getRange(currentRow, notesCol).getValue() || '');
    
    try {
      var response = UrlFetchApp.fetch(notesUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ applicantId: applicantId, notes: newNotes }),
        headers: { 'x-rpo-api-key': apiKey },
        muteHttpExceptions: true
      });
      Logger.log('notes sync: applicantId=' + applicantId + ' status=' + response.getResponseCode());
    } catch (err) {
      Logger.log('[ERROR] onEditNotesSync failed: ' + errorToMessage_(err));
    }
  }
}
