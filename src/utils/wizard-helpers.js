// Pure helper functions used by PackageIPWizard.
// Kept separate from the component to enable unit testing without a DOM.

/**
 * Perform a basic Verilog syntax check.
 * Looks for module/endmodule keywords, balanced parentheses in the port list,
 * closed string literals, and closed block comments.
 * @param {string} content
 * @returns {Array<{line: number, message: string}>}
 */
function checkVerilogSyntax(content) {
    const errors = [];
    const lines = content.split('\n');
    
    let inModule = false;
    let moduleParenBalance = 0;
    let hasModuleDeclaration = false;
    let hasEndmodule = false;
    let inBlockComment = false;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Handle block comments spanning multiple lines
        if (inBlockComment) {
            const endIdx = line.indexOf('*/');
            if (endIdx !== -1) {
                line = line.substring(endIdx + 2);
                inBlockComment = false;
            } else {
                continue;
            }
        }
        
        // Strip inline block comments
        while (true) {
            const startIdx = line.indexOf('/*');
            const endIdx = line.indexOf('*/');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                line = line.substring(0, startIdx) + line.substring(endIdx + 2);
            } else if (startIdx !== -1) {
                inBlockComment = true;
                line = line.substring(0, startIdx);
                break;
            } else {
                break;
            }
        }
        
        line = line.trim();
        
        // Strip line comments
        const lineCommentIdx = line.indexOf('//');
        if (lineCommentIdx !== -1) {
            line = line.substring(0, lineCommentIdx).trim();
        }
        
        if (!line) continue;
        
        // Check module declaration
        if (/\bmodule\s+\w+/.test(line)) {
            hasModuleDeclaration = true;
            inModule = true;
            const match = line.match(/\bmodule\s+(\w+)/);
            if (!match) {
                errors.push({ line: i + 1, message: 'Module declaration missing module name' });
            }
        }
        
        // Check for endmodule
        if (/\bendmodule\b/.test(line)) {
            hasEndmodule = true;
            inModule = false;
        }
        
        // Track parentheses balance in module declaration
        if (inModule) {
            for (const ch of line) {
                if (ch === '(') moduleParenBalance++;
                else if (ch === ')') moduleParenBalance--;
            }
        }
        
        // Check basic syntax issues
        if (line.includes('module') && !line.match(/\bmodule\s/)) {
            if (!line.startsWith('//') && !line.includes('endmodule')) {
                errors.push({ line: i + 1, message: 'Possible malformed module keyword' });
            }
        }
        
        // Check for unclosed strings
        const quoteCount = (line.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
            errors.push({ line: i + 1, message: 'Unclosed string literal' });
        }
    }
    
    if (inBlockComment) {
        errors.push({ line: lines.length, message: 'Unclosed block comment (/* without */)' });
    }
    if (!hasModuleDeclaration) {
        errors.push({ line: 1, message: 'No module declaration found (expected "module <name>" keyword)' });
    }
    if (hasModuleDeclaration && !hasEndmodule) {
        errors.push({ line: lines.length, message: 'Missing "endmodule" keyword' });
    }
    if (moduleParenBalance !== 0) {
        errors.push({ line: 1, message: `Unbalanced parentheses in module port list (${moduleParenBalance} unmatched)` });
    }
    
    return errors;
}

/**
 * Format enum options as a comma-separated "value:label" string.
 * @param {Array<{value: *, label?: string}>} options
 * @returns {string}
 */
function formatEnumOptions(options) {
    if (!Array.isArray(options)) return '';
    return options.map(o => {
        const label = o.label || o.value;
        return `${o.value}:${label}`;
    }).join(', ');
}

/**
 * Parse a comma-separated "value:label" string into enum options.
 * If no colon is present, value and label are the same.
 * Numeric strings are converted to numbers.
 * @param {string} str
 * @returns {Array<{value: *, label: string}>}
 */
function parseEnumOptions(str) {
    if (!str || !str.trim()) return [];
    return str.split(',').map(part => {
        const trimmed = part.trim();
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) {
            const numericValue = Number(trimmed);
            return Number.isNaN(numericValue)
                ? { value: trimmed, label: trimmed }
                : { value: numericValue, label: trimmed };
        }
        const valueStr = trimmed.substring(0, colonIdx).trim();
        const label = trimmed.substring(colonIdx + 1).trim();
        const numericValue = Number(valueStr);
        return {
            value: Number.isNaN(numericValue) ? valueStr : numericValue,
            label: label || valueStr
        };
    });
}

/**
 * Coerce an enum default value to the same type as the first option value.
 * @param {*} value
 * @param {Array<{value: *}>} options
 * @returns {*}
 */
function coerceEnumDefault(value, options) {
    if (!Array.isArray(options) || options.length === 0) return value;
    const firstValue = options[0].value;
    const firstIsNumber = typeof firstValue === 'number';
    if (firstIsNumber) {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? firstValue : parsed;
    }
    return value;
}

export { checkVerilogSyntax, formatEnumOptions, parseEnumOptions, coerceEnumDefault };
