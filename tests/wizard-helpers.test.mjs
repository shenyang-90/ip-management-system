import { checkVerilogSyntax, parseEnumOptions, coerceEnumDefault, formatEnumOptions } from '../src/utils/wizard-helpers.js';
import assert from 'assert';

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (error) {
        console.error(`✗ ${name}`);
        console.error(`  ${error.message}`);
        failed++;
    }
}

// checkVerilogSyntax tests

test('checkVerilogSyntax: valid module', () => {
    const content = `module adder (
        input [31:0] a,
        input [31:0] b,
        output [31:0] sum
    );
        assign sum = a + b;
    endmodule`;
    const errors = checkVerilogSyntax(content);
    assert.strictEqual(errors.length, 0, `Expected 0 errors, got ${JSON.stringify(errors)}`);
});

test('checkVerilogSyntax: missing endmodule', () => {
    const content = `module adder (input a, output b);
        assign b = a;`;
    const errors = checkVerilogSyntax(content);
    assert.ok(errors.some(e => e.message.includes('Missing "endmodule"')));
});

test('checkVerilogSyntax: missing module declaration', () => {
    const content = `assign b = a;`;
    const errors = checkVerilogSyntax(content);
    assert.ok(errors.some(e => e.message.includes('No module declaration')));
});

test('checkVerilogSyntax: unbalanced parentheses', () => {
    const content = `module adder (
        input a,
        output b
    ;
    endmodule`;
    const errors = checkVerilogSyntax(content);
    assert.ok(errors.some(e => e.message.includes('Unbalanced parentheses')));
});

test('checkVerilogSyntax: unclosed string', () => {
    const content = `module adder;
        reg [7:0] msg = "hello;
    endmodule`;
    const errors = checkVerilogSyntax(content);
    assert.ok(errors.some(e => e.message.includes('Unclosed string')));
});

test('checkVerilogSyntax: block comment spanning lines', () => {
    const content = `module adder (
        /* multi-line
           comment */
        input a,
        output b
    );
    endmodule`;
    const errors = checkVerilogSyntax(content);
    assert.strictEqual(errors.length, 0, `Expected 0 errors, got ${JSON.stringify(errors)}`);
});

test('checkVerilogSyntax: unclosed block comment', () => {
    const content = `module adder;
        /* unclosed comment
        reg a;
    endmodule`;
    const errors = checkVerilogSyntax(content);
    assert.ok(errors.some(e => e.message.includes('Unclosed block comment')));
});

// parseEnumOptions tests

test('parseEnumOptions: numeric value:label pairs', () => {
    const options = parseEnumOptions('0:Disabled, 1:Enabled, 2:Auto');
    assert.deepStrictEqual(options, [
        { value: 0, label: 'Disabled' },
        { value: 1, label: 'Enabled' },
        { value: 2, label: 'Auto' }
    ]);
});

test('parseEnumOptions: string values', () => {
    const options = parseEnumOptions('ADD, SUB, MUL');
    assert.deepStrictEqual(options, [
        { value: 'ADD', label: 'ADD' },
        { value: 'SUB', label: 'SUB' },
        { value: 'MUL', label: 'MUL' }
    ]);
});

test('parseEnumOptions: mixed string value with label', () => {
    const options = parseEnumOptions('red:Red Color, green:Green Color');
    assert.deepStrictEqual(options, [
        { value: 'red', label: 'Red Color' },
        { value: 'green', label: 'Green Color' }
    ]);
});

test('parseEnumOptions: empty string returns empty array', () => {
    const options = parseEnumOptions('');
    assert.deepStrictEqual(options, []);
});

// coerceEnumDefault tests

test('coerceEnumDefault: numeric options coerce string default', () => {
    const value = coerceEnumDefault('1', [{ value: 0, label: 'A' }, { value: 1, label: 'B' }]);
    assert.strictEqual(value, 1);
});

test('coerceEnumDefault: invalid numeric falls back to first option', () => {
    const value = coerceEnumDefault('not-a-number', [{ value: 0, label: 'A' }]);
    assert.strictEqual(value, 0);
});

test('coerceEnumDefault: string options preserve string default', () => {
    const value = coerceEnumDefault('red', [{ value: 'red', label: 'Red' }]);
    assert.strictEqual(value, 'red');
});

// formatEnumOptions tests

test('formatEnumOptions: formats value:label pairs', () => {
    const str = formatEnumOptions([{ value: 0, label: 'Disabled' }, { value: 1, label: 'Enabled' }]);
    assert.strictEqual(str, '0:Disabled, 1:Enabled');
});

test('formatEnumOptions: uses value as label fallback', () => {
    const str = formatEnumOptions([{ value: 0 }]);
    assert.strictEqual(str, '0:0');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
