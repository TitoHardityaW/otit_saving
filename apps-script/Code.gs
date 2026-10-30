/**
 * Backend Otit Saving — Google Apps Script yang menempel pada Google Spreadsheet.
 *
 * Cara pasang: lihat README.md bagian "Setup Google Sheets".
 * PIN akses disimpan di Script Properties dengan nama APP_PIN.
 */

var SHEET_NAME = 'Transaksi';
var HEADERS = ['ID', 'Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Jumlah', 'Dibuat', 'Diubah', 'Status'];
var COL_STATUS = 9; // 1 = aktif, 0 = dihapus (soft delete)
var STATUS_AKTIF = 1;
var STATUS_DIHAPUS = 0;
var JENIS_VALID = ['masuk', 'keluar'];

function doGet(e) {
  return handle_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Body request bukan JSON yang valid.' });
  }
  return handle_(body);
}

function handle_(req) {
  try {
    checkPin_(req.pin);
    switch (req.action) {
      case 'ping':
        return json_({ ok: true });
      case 'list':
        return json_({ ok: true, data: listTransaksi_() });
      case 'create':
        return json_({ ok: true, data: withLock_(function () { return createTransaksi_(req.data); }) });
      case 'update':
        return json_({ ok: true, data: withLock_(function () { return updateTransaksi_(req.id, req.data); }) });
      case 'delete':
        withLock_(function () { deleteTransaksi_(req.id); });
        return json_({ ok: true });
      default:
        throw new Error('Aksi tidak dikenal: ' + req.action);
    }
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function checkPin_(pin) {
  var expected = PropertiesService.getScriptProperties().getProperty('APP_PIN');
  if (!expected) {
    throw new Error('APP_PIN belum diatur di Script Properties.');
  }
  if (String(pin || '') !== String(expected)) {
    throw new Error('PIN salah.');
  }
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    // Tanggal disimpan sebagai teks yyyy-MM-dd agar tidak berubah zona waktu.
    sheet.getRange('B:B').setNumberFormat('@');
    sheet.getRange('F:F').setNumberFormat('#,##0');
  } else if (sheet.getRange(1, COL_STATUS).getValue() === '') {
    // Migrasi sheet versi lama yang belum punya kolom Status.
    sheet.getRange(1, COL_STATUS).setValue('Status').setFontWeight('bold');
  }
  return sheet;
}

function listTransaksi_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values
    .filter(function (r) { return r[0] !== '' && isAktif_(r[COL_STATUS - 1]); })
    .map(rowToObject_);
}

function createTransaksi_(data) {
  var t = validate_(data);
  var now = new Date().toISOString();
  var id = Utilities.getUuid();
  var row = [id, t.tanggal, t.jenis, t.kategori, t.keterangan, t.jumlah, now, now, STATUS_AKTIF];
  getSheet_().appendRow(row);
  return rowToObject_(row);
}

function updateTransaksi_(id, data) {
  var sheet = getSheet_();
  var rowIndex = findRow_(sheet, id);
  var t = validate_(data);
  var range = sheet.getRange(rowIndex, 1, 1, HEADERS.length);
  var row = range.getValues()[0];
  row[1] = t.tanggal;
  row[2] = t.jenis;
  row[3] = t.kategori;
  row[4] = t.keterangan;
  row[5] = t.jumlah;
  row[7] = new Date().toISOString();
  range.setValues([row]);
  return rowToObject_(row);
}

// Soft delete: baris tetap ada di sheet, hanya Status diubah menjadi 0.
function deleteTransaksi_(id) {
  var sheet = getSheet_();
  var rowIndex = findRow_(sheet, id);
  sheet.getRange(rowIndex, 8, 1, 2).setValues([[new Date().toISOString(), STATUS_DIHAPUS]]);
}

function findRow_(sheet, id) {
  if (!id) throw new Error('ID transaksi wajib diisi.');
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var statuses = sheet.getRange(2, COL_STATUS, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id) && isAktif_(statuses[i][0])) return i + 2;
    }
  }
  throw new Error('Transaksi tidak ditemukan.');
}

function validate_(data) {
  data = data || {};
  var tanggal = String(data.tanggal || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    throw new Error('Tanggal harus berformat YYYY-MM-DD.');
  }
  var jenis = String(data.jenis || '').trim().toLowerCase();
  if (JENIS_VALID.indexOf(jenis) === -1) {
    throw new Error('Jenis harus "masuk" atau "keluar".');
  }
  var jumlah = Number(data.jumlah);
  if (!isFinite(jumlah) || jumlah <= 0) {
    throw new Error('Jumlah harus angka lebih dari 0.');
  }
  var kategori = String(data.kategori || '').trim() || 'Lainnya';
  var keterangan = String(data.keterangan || '').trim();
  return {
    tanggal: tanggal,
    jenis: jenis,
    kategori: kategori.slice(0, 100),
    keterangan: keterangan.slice(0, 500),
    jumlah: Math.round(jumlah * 100) / 100
  };
}

// Status kosong (data dari versi lama) dianggap aktif.
function isAktif_(v) {
  return v === '' || Number(v) === STATUS_AKTIF;
}

function rowToObject_(r) {
  return {
    id: String(r[0]),
    tanggal: formatTanggal_(r[1]),
    jenis: String(r[2]),
    kategori: String(r[3]),
    keterangan: String(r[4]),
    jumlah: Number(r[5]) || 0,
    dibuat: r[6] instanceof Date ? r[6].toISOString() : String(r[6]),
    diubah: r[7] instanceof Date ? r[7].toISOString() : String(r[7]),
    status: isAktif_(r[8]) ? STATUS_AKTIF : STATUS_DIHAPUS
  };
}

// Jaga-jaga bila tanggal diketik manual di sheet dan terbaca sebagai Date.
function formatTanggal_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
