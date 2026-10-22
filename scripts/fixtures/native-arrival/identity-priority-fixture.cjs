const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const clone = value => JSON.parse(JSON.stringify(value));
function loadRelease(release = '20261022') {
  let sequence = 0;
  const logs = [], script = new Map(), document = new Map();
  const properties = map => ({ getProperty: key => map.has(key) ? map.get(key) : null,
    setProperty: (key, value) => { map.set(key, String(value)); }, deleteProperty: key => map.delete(key),
    getProperties: () => Object.fromEntries(map) });
  const chain = () => new Proxy({}, { get: (_, key) => key === 'build' ? () => ({ synthetic: true }) : () => chain() });
  const box = { Date, Map, Set, JSON, Math, Number, String, Array, Object, RegExp, Error,
    console: { log: value => logs.push(value) },
    Utilities: { getUuid: () => `synthetic-${++sequence}`,
      formatDate: (date, _zone, pattern) => { const value = new Date(date.getTime() + 8 * 3600000).toISOString(); return pattern === 'HH:mm' ? value.slice(11, 16) : value.slice(0, 10); },
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()],
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' } },
    PropertiesService: { getScriptProperties: () => properties(script), getDocumentProperties: () => properties(document) },
    SpreadsheetApp: { newDataValidation: chain, CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' } },
  };
  vm.createContext(box);
  const directory = path.join(__dirname, '../../apps-script/releases', release);
  for (const file of ['native-main.gs', 'arrival-workflow.gs', 'arrival-integrity.gs']) {
    vm.runInContext(fs.readFileSync(path.join(directory, file), 'utf8'), box, { filename: file });
  }
  return { box, logs, script, document, uuidCount: () => sequence,
    accountNames: () => clone(vm.runInContext('OMNI_ACCOUNT_TABS', box)),
    sourceHeaders: () => clone(vm.runInContext('OMNI_HEADERS.concat(OA2.ACCOUNT_HEADERS)', box)),
    registryHeaders: () => clone(vm.runInContext('OA2.LEDGER_HEADERS', box)),
    historyHeaders: () => clone(vm.runInContext('OA2.HISTORY_HEADERS', box)) };
}

function sheet(name, headers, rows = [], headerRow = 1) {
  const state = { name, matrix: [...Array.from({ length: headerRow - 1 }, () => []), headers.slice(), ...rows.map(row => row.slice())],
    writes: [], reads: 0, names: 0, beforeRead: null, beforeWrite: null, afterWrite: null,
    notes: new Map(), noteWrites: [], beforeNoteWrite: null };
  const value = (row, column) => state.matrix[row - 1]?.[column - 1] ?? '';
  const display = item => item instanceof Date ? new Date(item.getTime() + 8 * 3600000).toISOString().slice(0, 10) : String(item ?? '');
  const sh = { state, getName: () => { state.names++; return state.name; },
    getLastRow: () => state.matrix.length, getLastColumn: () => Math.max(headers.length, ...state.matrix.map(row => row.length)),
    getMaxRows: () => Math.max(100, state.matrix.length), getMaxColumns: () => Math.max(38, headers.length),
    getDataRange: () => sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()),
    appendRow: row => { sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]); return sh; },
    insertRowsAfter: (_row, count) => { state.matrix.push(...Array.from({ length: count }, () => [])); return sh; },
    getRange: (row, column, height = 1, width = 1) => {
      const read = () => { state.reads++; if (state.beforeRead) state.beforeRead(state.reads, { row, column, height, width });
        return Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => value(row + i, column + j))); };
      const write = (values, kind) => {
        if (values.length !== height || values.some(item => item.length !== width)) throw new Error('Synthetic write shape mismatch');
        if (state.beforeWrite) state.beforeWrite({ kind, row, column, height, width, values });
        state.writes.push({ kind, row, column, height, width, values: clone(values) });
        values.forEach((item, i) => { while (state.matrix.length < row + i) state.matrix.push([]);
          item.forEach((cell, j) => { state.matrix[row + i - 1][column + j - 1] = cell; }); });
        if (state.afterWrite) state.afterWrite({ kind, row, column, height, width, values });
        return range;
      };
      const range = { getValues: read, getDisplayValues: () => read().map(item => item.map(display)),
        getValue: () => read()[0][0], getDisplayValue: () => display(read()[0][0]),
        getFormulas: () => read().map(item => item.map(cell => typeof cell === 'string' && cell.startsWith('=') ? cell : '')),
        getNote: () => state.notes.get(`${row}:${column}`) ?? '',
        getNotes: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => state.notes.get(`${row + i}:${column + j}`) ?? '')),
        setNote: note => { if (state.beforeNoteWrite) state.beforeNoteWrite({ row, column, note });
          state.notes.set(`${row}:${column}`, note); state.noteWrites.push({ row, column, note }); return range; },
        setNotes: notes => { notes.forEach((items, i) => items.forEach((note, j) => {
          if (state.beforeNoteWrite) state.beforeNoteWrite({ row: row + i, column: column + j, note });
          state.notes.set(`${row + i}:${column + j}`, note); state.noteWrites.push({ row: row + i, column: column + j, note }); })); return range; },
        setValues: values => write(values, 'values'), setValue: value => write([[value]], 'values'),
        setFormula: formula => write([[formula]], 'formula'), setFormulas: values => write(values, 'formula'),
        clearContent: () => write(Array.from({ length: height }, () => Array(width).fill('')), 'values'),
        clearDataValidations: () => range, setDataValidation: () => range, setNumberFormat: () => range,
        getRow: () => row, getLastRow: () => row + height - 1, getColumn: () => column,
        getLastColumn: () => column + width - 1, getNumRows: () => height, getNumColumns: () => width,
      };
      return range;
    } };
  return sh;
}
function valuesRow(headers, values) {
  const row = Array(headers.length).fill('');
  for (const [name, value] of Object.entries(values)) {
    const index = headers.indexOf(name); if (index < 0) throw new Error(`Synthetic unknown header: ${name}`); row[index] = value;
  }
  return row;
}
function workbook(sheets) {
  const ss = { getId: () => 'synthetic_identity_priority_workbook', getSheetByName: name => sheets.get(name) ?? null, getSpreadsheetTimeZone: () => 'Asia/Hong_Kong',
    getActiveSheet: () => sheets.values().next().value, toast() {} };
  for (const sh of sheets.values()) sh.getParent = () => ss;
  return ss;
}
module.exports = { clone, loadRelease, sheet, valuesRow, workbook };
