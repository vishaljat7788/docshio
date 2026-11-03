'use strict';
const { UserError } = require('./errors');
const { clamp } = require('./utils');

/**
 * Never trust what the browser sends. Rebuild the options object from the
 * tool definition so only known keys with valid values get through.
 */
function sanitizeOptions(meta, raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = Object.create(null);
  for (const def of meta.options) {
    let v = Object.prototype.hasOwnProperty.call(input, def.key) ? input[def.key] : def.value;
    if (v === undefined || v === null) v = def.value;

    if (def.type === 'select') {
      v = String(v);
      if (!def.choices.some(([c]) => c === v)) throw new UserError(`Invalid value for "${def.label}".`);
    } else if (def.type === 'number') {
      v = Number(v);
      if (!Number.isFinite(v)) throw new UserError(`"${def.label}" must be a number.`);
      v = clamp(v, def.min ?? -1e6, def.max ?? 1e6);
    } else if (def.type === 'color') {
      v = String(v);
      if (!/^#[0-9a-f]{6}$/i.test(v)) throw new UserError(`"${def.label}" is not a valid colour.`);
    } else {
      v = String(v).slice(0, def.maxLength || 200);
    }
    out[def.key] = v;
  }
  return out;
}

module.exports = { sanitizeOptions };
