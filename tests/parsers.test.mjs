import { XCIParser } from '../src/parsers/XCIParser.js';
import { IPXACTParser } from '../src/parsers/IPXACTParser.js';
import { normalizeParamType, normalizeFileGroups, parseAddress, formatAddress } from '../src/utils/parser-helpers.js';
import assert from 'assert';

// Minimal DOMParser mock for Node.js unit tests.
// Supports the XML structures used by XCI/IP-XACT parsers.
class MockElement {
    constructor(name, attrs = {}, text = '') {
        this.nodeName = name;
        this.localName = name.includes(':') ? name.split(':')[1] : name;
        this.textContent = text;
        this.attributes = {};
        this.children = [];
        for (const [k, v] of Object.entries(attrs)) {
            this.attributes[k] = v;
        }
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    querySelector(selector) {
        const all = this.querySelectorAll(selector);
        return all.length > 0 ? all[0] : null;
    }

    querySelectorAll(selector) {
        const results = [];
        const matchLocalName = selector.match(/\*\[local-name\(\)='([^']+)'\]/);
        if (matchLocalName) {
            const target = matchLocalName[1];
            this._collectByLocalName(target, results);
        } else if (selector.includes(',')) {
            for (const part of selector.split(',')) {
                results.push(...this.querySelectorAll(part.trim()));
            }
        } else {
            const names = selector.split(',').map(s => s.trim());
            this._collectByNames(names, results);
        }
        return results;
    }

    _collectByLocalName(target, results) {
        for (const child of this.children) {
            if (child.localName === target) results.push(child);
            child._collectByLocalName(target, results);
        }
    }

    _collectByNames(names, results) {
        for (const child of this.children) {
            if (names.includes(child.nodeName) || names.includes(child.localName)) {
                results.push(child);
            }
            child._collectByNames(names, results);
        }
    }
}

class MockDocument {
    constructor(root) {
        this.documentElement = root;
    }
    querySelector(selector) {
        if (selector === 'parsererror') return null;
        return this.documentElement.querySelector(selector);
    }
    querySelectorAll(selector) {
        return this.documentElement.querySelectorAll(selector);
    }
}

function parseXml(xml) {
    // Strip XML declaration and comments
    xml = xml.replace(/<\?xml[^?]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    const tagRegex = /<\/?([^\s>\/]+)([^>]*)>/g;
    const stack = [];
    let root = null;
    let lastIndex = 0;
    let match;

    function parseAttrs(attrStr) {
        const attrs = {};
        const attrRegex = /(\S+)="([^"]*)"/g;
        let m;
        while ((m = attrRegex.exec(attrStr)) !== null) {
            attrs[m[1]] = m[2];
        }
        return attrs;
    }

    while ((match = tagRegex.exec(xml)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        const attrStr = match[2];
        const isClosing = fullTag.startsWith('</');
        const isSelfClosing = fullTag.endsWith('/>');

        const text = xml.substring(lastIndex, match.index).trim();
        if (text && stack.length > 0) {
            stack[stack.length - 1].textContent = text;
        }

        if (isClosing) {
            stack.pop();
        } else {
            const attrs = parseAttrs(attrStr);
            const el = new MockElement(tagName, attrs);
            if (stack.length > 0) {
                stack[stack.length - 1].children.push(el);
            } else {
                root = el;
            }
            if (!isSelfClosing) {
                stack.push(el);
            }
        }
        lastIndex = tagRegex.lastIndex;
    }

    return new MockDocument(root);
}

if (typeof DOMParser === 'undefined') {
    global.DOMParser = class {
        parseFromString(xmlText, type) {
            return parseXml(xmlText);
        }
    };
}

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

// --- parser-helpers tests ---

test('normalizeParamType: bool/boolean -> bool', () => {
    assert.strictEqual(normalizeParamType('boolean'), 'bool');
    assert.strictEqual(normalizeParamType('bool'), 'bool');
});

test('normalizeParamType: integer/int/long -> long', () => {
    assert.strictEqual(normalizeParamType('integer'), 'long');
    assert.strictEqual(normalizeParamType('int'), 'long');
});

test('normalizeParamType: float/double -> string', () => {
    assert.strictEqual(normalizeParamType('float'), 'string');
    assert.strictEqual(normalizeParamType('double'), 'string');
});

test('normalizeParamType: bit_vector -> string', () => {
    assert.strictEqual(normalizeParamType('bit_vector'), 'string');
    assert.strictEqual(normalizeParamType('std_logic_vector'), 'string');
});

test('normalizeFileGroups: converts {path, type} to {type, files[]}', () => {
    const input = [
        { name: 'hdlSource', files: [{ path: 'rtl/foo.v', type: 'verilogSource' }] },
        { name: 'simSource', files: [{ path: 'tb/foo_tb.v', type: 'verilogSource' }] }
    ];
    const result = normalizeFileGroups(input);
    assert.deepStrictEqual(result, [
        { type: 'synthesis', files: ['rtl/foo.v'] },
        { type: 'simulation', files: ['tb/foo_tb.v'] }
    ]);
});

test('normalizeFileGroups: deduplicates paths and merges groups', () => {
    const input = [
        { name: 'synthesis', files: ['rtl/a.v'] },
        { name: 'synthesis', files: ['rtl/a.v', 'rtl/b.v'] }
    ];
    const result = normalizeFileGroups(input);
    assert.deepStrictEqual(result, [
        { type: 'synthesis', files: ['rtl/a.v', 'rtl/b.v'] }
    ]);
});

test('parseAddress: handles 0x hex', () => {
    assert.strictEqual(parseAddress('0x4000'), 16384);
});

test('parseAddress: handles decimal', () => {
    assert.strictEqual(parseAddress('512'), 512);
});

test('formatAddress: formats to 0x padded hex', () => {
    assert.strictEqual(formatAddress(0), '0x0000');
    assert.strictEqual(formatAddress(16), '0x0010');
});

// --- XCIParser tests ---

const xciXml = `<?xml version="1.0" encoding="UTF-8"?>
<component>
    <vendor>test.com</vendor>
    <library>test</library>
    <name>xci_ip</name>
    <version>1.0</version>
    <display_name>XCI Test IP</display_name>
    <description>A test IP</description>
    <category>Test</category>
    <busInterfaces>
        <busInterface>
            <name>S_AXI</name>
            <busType name="axilite"/>
            <slave/>
        </busInterface>
    </busInterfaces>
    <parameters>
        <parameter>
            <name>C_WIDTH</name>
            <displayName>Width</displayName>
            <value>32</value>
            <resolve>integer</resolve>
        </parameter>
        <parameter>
            <name>C_ENABLE</name>
            <displayName>Enable</displayName>
            <value>true</value>
            <resolve>boolean</resolve>
        </parameter>
    </parameters>
    <fileSets>
        <fileSet>
            <name>hdlSource</name>
            <file>
                <name>rtl/xci_ip.v</name>
                <fileType>verilogSource</fileType>
            </file>
        </fileSet>
    </fileSets>
</component>`;

test('XCIParser: parses basic component', () => {
    const parser = new XCIParser();
    const ip = parser.parse(xciXml);
    assert.strictEqual(ip.vendor, 'test.com');
    assert.strictEqual(ip.name, 'xci_ip');
    assert.strictEqual(ip.interfaces.length, 1);
    assert.strictEqual(ip.interfaces[0].type, 'axi4_lite');
    assert.strictEqual(ip.interfaces[0].role, 'slave');
});

test('XCIParser: normalizes parameter types', () => {
    const parser = new XCIParser();
    const ip = parser.parse(xciXml);
    assert.strictEqual(ip.parameters[0].type, 'long');
    assert.strictEqual(ip.parameters[1].type, 'bool');
});

test('XCIParser: normalizes file_groups', () => {
    const parser = new XCIParser();
    const ip = parser.parse(xciXml);
    assert.deepStrictEqual(ip.file_groups, [
        { type: 'synthesis', files: ['rtl/xci_ip.v'] }
    ]);
});

// --- IPXACTParser tests ---

const ipxactDefaultNsXml = `<?xml version="1.0" encoding="UTF-8"?>
<component xmlns="http://www.accellera.org/XMLSchema/IPXACT/1685-2014">
    <vendor>test.com</vendor>
    <library>test</library>
    <name>ipxact_ip</name>
    <version>1.0</version>
    <displayName>IP-XACT Test IP</displayName>
    <description>A test IP</description>
    <category>Test</category>
    <busInterfaces>
        <busInterface>
            <name>M_AXI</name>
            <busType>
                <name>axi4</name>
            </busType>
            <master/>
        </busInterface>
    </busInterfaces>
    <parameters>
        <parameter>
            <name>C_COUNT</name>
            <displayName>Count</displayName>
            <value>8</value>
            <value resolve="integer"/>
        </parameter>
    </parameters>
    <fileSets>
        <fileSet>
            <name>simulation</name>
            <file>
                <name>tb/ipxact_ip_tb.v</name>
                <fileType>verilogSource</fileType>
            </file>
        </fileSet>
    </fileSets>
    <memoryMaps>
        <memoryMap>
            <name>mmap</name>
            <addressBlock>
                <name>regBlock</name>
                <baseAddress>0x0000</baseAddress>
                <range>0x0100</range>
                <width>32</width>
                <register>
                    <name>CTRL</name>
                    <addressOffset>0x0000</addressOffset>
                    <size>32</size>
                    <access>read-write</access>
                </register>
            </addressBlock>
        </memoryMap>
    </memoryMaps>
</component>`;

test('IPXACTParser: parses default namespace component', () => {
    const parser = new IPXACTParser();
    const ip = parser.parse(ipxactDefaultNsXml);
    assert.strictEqual(ip.vendor, 'test.com');
    assert.strictEqual(ip.name, 'ipxact_ip');
    assert.strictEqual(ip.interfaces.length, 1);
    assert.strictEqual(ip.interfaces[0].type, 'axi4');
    assert.strictEqual(ip.interfaces[0].role, 'master');
});

test('IPXACTParser: normalizes parameter types', () => {
    const parser = new IPXACTParser();
    const ip = parser.parse(ipxactDefaultNsXml);
    assert.strictEqual(ip.parameters[0].type, 'long');
});

test('IPXACTParser: normalizes file_groups', () => {
    const parser = new IPXACTParser();
    const ip = parser.parse(ipxactDefaultNsXml);
    assert.deepStrictEqual(ip.file_groups, [
        { type: 'simulation', files: ['tb/ipxact_ip_tb.v'] }
    ]);
});

test('IPXACTParser: register offset is hex string', () => {
    const parser = new IPXACTParser();
    const ip = parser.parse(ipxactDefaultNsXml);
    assert.strictEqual(ip.register_map.registers.length, 1);
    assert.strictEqual(ip.register_map.registers[0].offset, '0x0000');
    assert.strictEqual(ip.register_map.registers[0].access, 'RW');
});

const ipxactPrefixedNsXml = `<?xml version="1.0" encoding="UTF-8"?>
<ipxact:component xmlns:ipxact="http://www.accellera.org/XMLSchema/IPXACT/1685-2014">
    <ipxact:vendor>pre.com</ipxact:vendor>
    <ipxact:library>test</ipxact:library>
    <ipxact:name>prefixed_ip</ipxact:name>
    <ipxact:version>1.0</ipxact:version>
</ipxact:component>`;

test('IPXACTParser: parses prefixed namespace component', () => {
    const parser = new IPXACTParser();
    const ip = parser.parse(ipxactPrefixedNsXml);
    assert.strictEqual(ip.vendor, 'pre.com');
    assert.strictEqual(ip.name, 'prefixed_ip');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
