import {log, t} from '../utils';

export class Sheeted {
  constructor ([sheetNames, sheets]) {
    this.__keys = sheetNames;
    Object.keys(sheets).map((key)=> {
      this[key] = new Sheeted.Sheet(sheets[key], key);
    });
  }
  toArray (opts={}) {
    var o = {};
    opts.compact = true;
    if (opts.compact) {
      return [this.__keys, ...this.__keys.map((name, i) => {
        log(name);
        return this[name].toArray(opts);
      })]
    }
    this.__keys.forEach((name, i) => {
      o[name] = this[name].toArray();
    });
    return [this.__keys, o]
  }
  toJSON (opts={}) {
    let spaces = opts.spaces;
    return JSON.stringify(this.toArray(), null, spaces);
  }
  log () {
    log(this);
  }
}
Sheeted.Sheet = class Sheet {
  constructor (rows, sheetName) {
    this.rows = rows;
    this.sheetName = sheetName;
    var cols = [];
    this.rows = this.rows.filter((row, i) => {
      if (i === 0 && Array.isArray(row)) {
        cols = row;
        return;
      } else {
        return Object.keys(row).map((c) => {
          if (cols.indexOf(c) === -1) {
            cols.push(c);
          }
        });
      }
    });
    this.__cols = cols;
  }
  toArray (opts={}) {
    var outRows;
    opts.compact = true;
    if (opts.compact) {
      return [this.__cols, ...this.rows.map((item, i)=>{
        var outRow = [];
        this.__cols.forEach(function(col){
          outRow.push(item[col]);
        });
        return outRow;
      })]
    }
    return [this.cols, this.rows]
  }
}
