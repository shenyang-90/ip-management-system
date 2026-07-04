// Shared normalization helpers for XCI and IP-XACT parsers.
// These ensure parser output matches the internal IPEntity schema.

/**
 * Normalize parameter types from XCI/IP-XACT to the internal schema.
 * Internal types: bool, long, int, string, enum
 * @param {string} type
 * @returns {string}
 */
function normalizeParamType(type) {
    if (!type) return 'string';
    const lower = String(type).toLowerCase();
    if (lower === 'bool' || lower === 'boolean') return 'bool';
    if (lower === 'int' || lower === 'integer' || lower === 'long') return 'long';
    if (lower === 'float' || lower === 'double' || lower === 'real') return 'string';
    if (lower === 'bit' || lower === 'bitvector' || lower === 'std_logic_vector' || lower === 'bit_vector') return 'string';
    if (lower === 'enum' || lower === 'enumeration') return 'enum';
    return 'string';
}

/**
 * Normalize a file group name or file type to the internal group type.
 * Internal types: synthesis, simulation, testbench, constraint, documentation
 * @param {string} name
 * @returns {string}
 */
function normalizeFileGroupType(name) {
    if (!name) return 'other';
    const lower = String(name).toLowerCase();
    if (lower.includes('synth') || lower.includes('hdl') || lower.includes('verilog') || lower.includes('vhdl')) return 'synthesis';
    if (lower.includes('sim') && !lower.includes('test')) return 'simulation';
    if (lower.includes('test')) return 'testbench';
    if (lower.includes('constraint') || lower.includes('xdc') || lower.includes('sdc')) return 'constraint';
    if (lower.includes('doc')) return 'documentation';
    return lower;
}

/**
 * Convert parser-specific file_groups structures to the internal schema:
 * { type: string, files: string[] }
 * @param {Array} fileGroups
 * @returns {Array<{type: string, files: string[]}>}
 */
function normalizeFileGroups(fileGroups) {
    if (!Array.isArray(fileGroups)) return [];
    const groups = {};
    for (const fg of fileGroups) {
        if (!fg) continue;
        const type = normalizeFileGroupType(fg.name || fg.type);
        if (!groups[type]) groups[type] = new Set();
        const files = Array.isArray(fg.files) ? fg.files : [];
        for (const f of files) {
            const path = typeof f === 'string' ? f : (f.path || f.name || '');
            if (path) groups[type].add(path);
        }
    }
    return Object.entries(groups).map(([type, filesSet]) => ({
        type,
        files: Array.from(filesSet)
    }));
}

/**
 * Parse a numeric address string (hex, Verilog hex, decimal).
 * @param {string} value
 * @returns {number}
 */
function parseAddress(value) {
    if (value === undefined || value === null) return 0;
    const trimmed = String(value).trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
        return parseInt(trimmed, 16);
    }
    if (trimmed.startsWith("'h")) {
        return parseInt(trimmed.substring(2), 16);
    }
    return parseInt(trimmed, 10) || 0;
}

/**
 * Format a numeric address as a 0x-padded hex string (e.g. 0x0000).
 * @param {number} value
 * @param {number} padWidth
 * @returns {string}
 */
function formatAddress(value, padWidth = 4) {
    const num = parseInt(value, 10) || 0;
    return `0x${num.toString(16).padStart(padWidth, '0')}`;
}

export { normalizeParamType, normalizeFileGroupType, normalizeFileGroups, parseAddress, formatAddress };
