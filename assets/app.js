(function () {
  'use strict';

  var LS_PIN = 'otit_saving.pin';

  var state = {
    transaksi: [],
    editId: null,
    loading: false
  };

  var $ = function (id) { return document.getElementById(id); };

  var rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  var angka = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
  var tglPanjang = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var tglPendek = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  var namaBulan = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });

  // ---------- Penyimpanan lokal (aman bila storage diblokir) ----------
  function lsGet(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* abaikan */ }
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (e) { /* abaikan */ }
  }

  function apiUrl() {
    return (window.APP_CONFIG && window.APP_CONFIG.API_URL) || '';
  }

  // ---------- API ----------
  // Content-Type text/plain agar tidak memicu preflight CORS ke Apps Script.
  function api(action, payload, pinOverride) {
    var url = apiUrl();
    var pin = pinOverride || lsGet(LS_PIN);
    if (!url) return Promise.reject(new Error('Aplikasi belum dikonfigurasi (API_URL di config.js kosong).'));

    var body = Object.assign({ action: action, pin: pin }, payload || {});
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Server membalas HTTP ' + res.status);
        return res.json().catch(function () {
          throw new Error('Respons bukan JSON. Pastikan Web App di-deploy dengan akses "Anyone".');
        });
      })
      .then(function (json) {
        if (!json.ok) throw new Error(json.error || 'Terjadi kesalahan.');
        return json.data;
      });
  }

  // ---------- Util ----------
  function todayISO() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function parseISODate(s) {
    var p = String(s).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function parseJumlah(s) {
    return Number(String(s).replace(/[^\d]/g, '')) || 0;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showAlert(msg, type) {
    var el = $('alert');
    if (!msg) { el.hidden = true; return; }
    el.textContent = msg;
    el.className = 'alert' + (type ? ' ' + type : '');
    el.hidden = false;
  }

  function sortTransaksi() {
    state.transaksi.sort(function (a, b) {
      if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
      return a.dibuat < b.dibuat ? 1 : -1;
    });
  }

  // ---------- Filter & ringkasan ----------
  function filtered() {
    var bulan = $('fBulan').value;
    var jenis = $('fJenis').value;
    var cari = $('fCari').value.trim().toLowerCase();
    return state.transaksi.filter(function (t) {
      if (bulan && t.tanggal.slice(0, 7) !== bulan) return false;
      if (jenis && t.jenis !== jenis) return false;
      if (cari && (t.kategori + ' ' + t.keterangan).toLowerCase().indexOf(cari) === -1) return false;
      return true;
    });
  }

  function inPeriod() {
    var bulan = $('fBulan').value;
    return state.transaksi.filter(function (t) {
      return !bulan || t.tanggal.slice(0, 7) === bulan;
    });
  }

  function periodLabel() {
    var bulan = $('fBulan').value;
    if (!bulan) return '(semua waktu)';
    return '(' + namaBulan.format(parseISODate(bulan + '-01')) + ')';
  }

  // ---------- Render ----------
  function render() {
    renderSummary();
    renderTable();
    renderKategori();
    renderKategoriOptions();
  }

  function renderSummary() {
    var saldo = state.transaksi.reduce(function (s, t) {
      return s + (t.jenis === 'masuk' ? t.jumlah : -t.jumlah);
    }, 0);
    var masuk = 0, keluar = 0;
    inPeriod().forEach(function (t) {
      if (t.jenis === 'masuk') masuk += t.jumlah; else keluar += t.jumlah;
    });

    $('sumSaldo').textContent = rupiah.format(saldo);
    $('sumMasuk').textContent = rupiah.format(masuk);
    $('sumKeluar').textContent = rupiah.format(keluar);
    $('sumSelisih').textContent = rupiah.format(masuk - keluar);
    document.querySelectorAll('.period-label').forEach(function (el) {
      el.textContent = periodLabel();
    });
  }

  function renderTable() {
    var rows = filtered();
    var html = '';
    var lastDate = null;

    rows.forEach(function (t) {
      if (t.tanggal !== lastDate) {
        lastDate = t.tanggal;
        html += '<tr class="day-sep"><td colspan="5">' + escapeHtml(tglPanjang.format(parseISODate(t.tanggal))) + '</td></tr>';
      }
      var isIn = t.jenis === 'masuk';
      html +=
        '<tr class="tx-row">' +
          '<td class="cell-tgl">' + escapeHtml(tglPendek.format(parseISODate(t.tanggal))) + '</td>' +
          '<td class="cell-kat"><span class="badge ' + (isIn ? 'in' : 'out') + '">' + (isIn ? 'Masuk' : 'Keluar') + '</span> ' + escapeHtml(t.kategori) + '</td>' +
          '<td class="cell-ket">' + escapeHtml(t.keterangan || '—') + '</td>' +
          '<td class="num ' + (isIn ? 'amount-in' : 'amount-out') + '">' + (isIn ? '+' : '−') + rupiah.format(t.jumlah) + '</td>' +
          '<td class="actions-col">' +
            '<button class="btn ghost icon" data-edit="' + escapeHtml(t.id) + '">Ubah</button> ' +
            '<button class="btn ghost icon danger" data-delete="' + escapeHtml(t.id) + '">Hapus</button>' +
          '</td>' +
        '</tr>';
    });

    $('txBody').innerHTML = html;
    $('loadingState').hidden = !state.loading;
    $('emptyState').hidden = state.loading || rows.length > 0;
  }

  function renderKategori() {
    var totals = {};
    inPeriod().forEach(function (t) {
      if (t.jenis !== 'keluar') return;
      totals[t.kategori] = (totals[t.kategori] || 0) + t.jumlah;
    });
    var list = Object.keys(totals)
      .map(function (k) { return { nama: k, total: totals[k] }; })
      .sort(function (a, b) { return b.total - a.total; });

    if (!list.length) {
      $('kategoriList').innerHTML = '<p class="empty">Belum ada pengeluaran.</p>';
      return;
    }
    var max = list[0].total;
    $('kategoriList').innerHTML = list.map(function (k) {
      return '<div class="kat-row">' +
        '<span class="kat-name" title="' + escapeHtml(k.nama) + '">' + escapeHtml(k.nama) + '</span>' +
        '<span class="kat-bar"><span style="width:' + (k.total / max * 100).toFixed(1) + '%"></span></span>' +
        '<span class="kat-val">' + rupiah.format(k.total) + '</span>' +
      '</div>';
    }).join('');
  }

  function renderKategoriOptions() {
    var seen = {};
    state.transaksi.forEach(function (t) { seen[t.kategori] = true; });
    ['Gaji', 'Makan', 'Transport', 'Belanja', 'Tagihan', 'Tabungan', 'Lainnya'].forEach(function (k) { seen[k] = true; });
    $('kategoriOptions').innerHTML = Object.keys(seen).sort().map(function (k) {
      return '<option value="' + escapeHtml(k) + '">';
    }).join('');
  }

  // ---------- Data ----------
  function load() {
    if (!lsGet(LS_PIN)) {
      openLogin();
      return;
    }
    state.loading = true;
    showAlert('');
    renderTable();
    $('btnRefresh').disabled = true;
    api('list')
      .then(function (data) {
        state.transaksi = data || [];
        sortTransaksi();
      })
      .catch(function (err) {
        if (err.message === 'PIN salah.') {
          // PIN di Script Properties sudah diganti: minta login ulang.
          logout();
          return;
        }
        showAlert(navigator.onLine === false
          ? 'Anda sedang offline. Data akan dimuat saat koneksi kembali.'
          : 'Gagal memuat data: ' + err.message);
      })
      .then(function () {
        state.loading = false;
        $('btnRefresh').disabled = false;
        render();
      });
  }

  // ---------- Dialog transaksi ----------
  function openTx(t) {
    var form = $('formTx');
    form.reset();
    $('formTxError').hidden = true;
    state.editId = t ? t.id : null;
    $('dlgTxTitle').textContent = t ? 'Ubah transaksi' : 'Tambah transaksi';
    form.jenis.value = t ? t.jenis : 'keluar';
    form.tanggal.value = t ? t.tanggal : todayISO();
    form.jumlah.value = t ? angka.format(t.jumlah) : '';
    form.kategori.value = t ? t.kategori : '';
    form.keterangan.value = t ? t.keterangan : '';
    $('dlgTx').showModal();
    form.jumlah.focus();
  }

  function submitTx(e) {
    e.preventDefault();
    var form = $('formTx');
    var data = {
      jenis: form.jenis.value,
      tanggal: form.tanggal.value,
      jumlah: parseJumlah(form.jumlah.value),
      kategori: form.kategori.value.trim(),
      keterangan: form.keterangan.value.trim()
    };
    if (data.jumlah <= 0) {
      $('formTxError').textContent = 'Jumlah harus lebih dari 0.';
      $('formTxError').hidden = false;
      return;
    }

    var btn = $('btnSimpan');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    var req = state.editId
      ? api('update', { id: state.editId, data: data })
      : api('create', { data: data });

    req
      .then(function (saved) {
        var idx = state.transaksi.findIndex(function (t) { return t.id === saved.id; });
        if (idx >= 0) state.transaksi[idx] = saved; else state.transaksi.push(saved);
        sortTransaksi();
        render();
        $('dlgTx').close();
      })
      .catch(function (err) {
        $('formTxError').textContent = err.message;
        $('formTxError').hidden = false;
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = 'Simpan';
      });
  }

  function hapus(id) {
    var t = state.transaksi.find(function (x) { return x.id === id; });
    if (!t) return;
    var label = (t.jenis === 'masuk' ? 'pemasukan ' : 'pengeluaran ') + rupiah.format(t.jumlah) + ' (' + t.kategori + ')';
    if (!confirm('Hapus ' + label + '?\n\nData tidak hilang dari spreadsheet, hanya ditandai Status = 0.')) return;

    api('delete', { id: id })
      .then(function () {
        state.transaksi = state.transaksi.filter(function (x) { return x.id !== id; });
        render();
      })
      .catch(function (err) {
        showAlert('Gagal menghapus: ' + err.message);
      });
  }

  // ---------- Login ----------
  function openLogin() {
    var form = $('formLogin');
    form.reset();
    $('formLoginError').hidden = true;
    if (!$('dlgLogin').open) $('dlgLogin').showModal();
    form.pin.focus();
  }

  function submitLogin(e) {
    e.preventDefault();
    var form = $('formLogin');
    var pin = form.pin.value;
    var btn = $('btnLogin');
    btn.disabled = true;
    btn.textContent = 'Memeriksa…';
    $('formLoginError').hidden = true;

    api('ping', null, pin)
      .then(function () {
        lsSet(LS_PIN, pin);
        $('dlgLogin').close();
        load();
      })
      .catch(function (err) {
        $('formLoginError').textContent = err.message === 'PIN salah.' ? 'PIN salah.' : 'Gagal masuk: ' + err.message;
        $('formLoginError').hidden = false;
        form.pin.select();
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = 'Masuk';
      });
  }

  function logout() {
    lsDel(LS_PIN);
    state.transaksi = [];
    render();
    openLogin();
  }

  // ---------- Ekspor CSV ----------
  function exportCsv() {
    var rows = filtered();
    var esc = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
    var lines = [['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Jumlah'].map(esc).join(',')];
    rows.forEach(function (t) {
      lines.push([t.tanggal, t.jenis, t.kategori, t.keterangan, t.jumlah].map(esc).join(','));
    });
    // BOM agar Excel membaca UTF-8 dengan benar.
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'otit-saving-' + ($('fBulan').value || 'semua') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---------- PWA ----------
  function initPwa() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (err) {
          console.warn('Service worker gagal didaftarkan:', err);
        });
      });
    }

    var deferredPrompt = null;
    var btnInstall = $('btnInstall');

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      btnInstall.hidden = false;
    });

    btnInstall.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        btnInstall.hidden = true;
      });
    });

    window.addEventListener('appinstalled', function () {
      btnInstall.hidden = true;
    });

    window.addEventListener('online', load);
    window.addEventListener('offline', function () {
      showAlert('Anda sedang offline. Perubahan data membutuhkan koneksi internet.', 'info');
    });
  }

  // ---------- Event ----------
  function init() {
    $('fBulan').value = todayISO().slice(0, 7);

    ['fBulan', 'fJenis', 'fCari'].forEach(function (id) {
      $(id).addEventListener('input', render);
    });

    $('btnTambah').addEventListener('click', function () { openTx(null); });
    $('btnRefresh').addEventListener('click', load);
    $('btnExport').addEventListener('click', exportCsv);
    $('btnLogout').addEventListener('click', function () {
      if (confirm('Keluar dari aplikasi?')) logout();
    });
    $('formTx').addEventListener('submit', submitTx);
    $('formLogin').addEventListener('submit', submitLogin);
    // Dialog login tidak boleh ditutup dengan tombol Esc.
    $('dlgLogin').addEventListener('cancel', function (e) { e.preventDefault(); });

    // Format ribuan saat mengetik jumlah.
    $('formTx').jumlah.addEventListener('input', function (e) {
      var n = parseJumlah(e.target.value);
      e.target.value = n ? angka.format(n) : '';
    });

    document.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { btn.closest('dialog').close(); });
    });

    $('txBody').addEventListener('click', function (e) {
      var editBtn = e.target.closest('[data-edit]');
      var delBtn = e.target.closest('[data-delete]');
      if (editBtn) {
        var t = state.transaksi.find(function (x) { return x.id === editBtn.dataset.edit; });
        if (t) openTx(t);
      } else if (delBtn) {
        hapus(delBtn.dataset.delete);
      }
    });

    initPwa();
    render();
    load();
  }

  init();
})();
