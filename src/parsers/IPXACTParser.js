// IPXACTParser.js - Parse IP-XACT (IEEE 1685) XML files
// IP-XACT is a standard XML format for describing IP components in SoC designs
// Supports both spirit: (legacy) and ipxact: (IEEE 1685-2014+) namespaces

class IPXACTParser {
    constructor() {
        this.namespacePrefix = ''; // Will be detected from XML
    }

    parse(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'application/xml');
        
        // Check for parse errors
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Invalid XML: ' + parserError.textContent);
        }

        const root = doc.documentElement;
        const rootName = root.localName || root.nodeName;
        
        // Detect namespace prefix (spirit: vs ipxact: vs none)
        this.namespacePrefix = this._detectNamespace(root);
        
        if (rootName !== 'component') {
            throw new Error(`Unknown IP-XACT root element: ${rootName}. Expected <component>`);
        }

        return this._parseComponent(root);
    }

    _detectNamespace(root) {
        // Check for common namespace prefixes
        const attrs = root.attributes;
        for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            if (attr.name.startsWith('xmlns:')) {
                const ns = attr.value.toLowerCase();
                if (ns.includes('spirit') || ns.includes('ipxact')) {
                    return attr.name.split(':')[1] + ':';
                }
            }
            // Check for default namespace
            if (attr.name === 'xmlns') {
                const ns = attr.value.toLowerCase();
                if (ns.includes('spirit') || ns.includes('ipxact')) {
                    return ''; // default namespace, no prefix needed
                }
            }
        }
        return '';
    }

    _parseComponent(element) {
        const ip = {
            vendor: this._getText(element, 'vendor'),
            library: this._getText(element, 'library'),
            name: this._getText(element, 'name'),
            version: this._getText(element, 'version'),
            display_name: this._getText(element, 'displayName') || this._getText(element, 'display_name') || this._getText(element, 'name'),
            description: this._getText(element, 'description'),
            category: this._getText(element, 'category') || 'Imported',
            status: 'active',
            interfaces: [],
            parameters: [],
            file_groups: [],
            register_map: { registers: [] }
        };

        // Parse bus interfaces
        const busInterfaces = this._getChild(element, 'busInterfaces');
        if (busInterfaces) {
            for (const busInterface of busInterfaces.querySelectorAll(this._ns('busInterface'))) {
                ip.interfaces.push(this._parseBusInterface(busInterface));
            }
        }

        // Parse parameters
        const parameters = this._getChild(element, 'parameters');
        if (parameters) {
            for (const param of parameters.querySelectorAll(this._ns('parameter'))) {
                ip.parameters.push(this._parseParameter(param));
            }
        }

        // Parse file sets
        const fileSets = this._getChild(element, 'fileSets');
        if (fileSets) {
            for (const fileSet of fileSets.querySelectorAll(this._ns('fileSet'))) {
                ip.file_groups.push(this._parseFileSet(fileSet));
            }
        }

        // Parse memory maps (register definitions)
        const memoryMaps = this._getChild(element, 'memoryMaps');
        if (memoryMaps) {
            ip.register_map = this._parseMemoryMaps(memoryMaps);
        }

        return ip;
    }

    _parseBusInterface(element) {
        const name = this._getText(element, 'name') || 'unnamed';
        
        // Get bus type (VLNV)
        const busType = this._getChild(element, 'busType');
        let type = 'custom';
        if (busType) {
            const typeName = this._getText(busType, 'name') || busType.getAttribute('name') || '';
            type = this._normalizeInterfaceType(typeName);
        }

        // Determine role from interface mode
        let role = null;
        const modes = ['master', 'slave', 'initiator', 'target', 'system', 'monitor'];
        for (const mode of modes) {
            const modeEl = this._getChild(element, mode);
            if (modeEl) {
                role = (mode === 'initiator') ? 'master' : (mode === 'target') ? 'slave' : mode;
                break;
            }
        }

        // If no explicit mode found, try to infer from abstraction type
        if (!role) {
            const abstractionType = this._getChild(element, 'abstractionType');
            if (abstractionType) {
                const absName = this._getText(abstractionType, 'name') || abstractionType.getAttribute('name') || '';
                role = this._inferRoleFromAbstraction(absName);
            }
        }

        // Default role if still not determined
        if (!role) {
            role = this._inferRoleFromPorts(element, type);
        }

        return {
            name: name,
            type: type,
            role: role,
            description: this._getText(element, 'description') || ''
        };
    }

    _parseParameter(element) {
        const name = this._getText(element, 'name') || element.getAttribute('name') || 'unnamed';
        const displayName = this._getText(element, 'displayName') || this._getText(element, 'display_name') || name;
        const value = this._getText(element, 'value') || element.getAttribute('value') || '';
        
        // Determine parameter type
        let type = 'string';
        const valueEl = this._getChild(element, 'value');
        if (valueEl) {
            const resolve = valueEl.getAttribute('resolve') || element.getAttribute('resolve') || 'string';
            type = this._normalizeParamType(resolve);
        } else {
            // Try to infer from value format
            if (/^(true|false)$/i.test(value)) type = 'boolean';
            else if (/^\d+$/.test(value)) type = 'integer';
            else if (/^\d+\.\d+$/.test(value)) type = 'float';
        }

        const description = this._getText(element, 'description') || '';

        return {
            name: name,
            display_name: displayName,
            type: type,
            default: value,
            description: description
        };
    }

    _parseFileSet(element) {
        const name = this._getText(element, 'name') || element.getAttribute('name') || 'default';
        const files = [];
        
        for (const file of element.querySelectorAll(this._ns('file'))) {
            const path = this._getText(file, 'name') || file.getAttribute('name') || '';
            const fileTypeEl = this._getChild(file, 'fileType');
            const fileType = fileTypeEl ? fileTypeEl.textContent.trim() : 
                             (file.getAttribute('fileType') || 'unknown');
            if (path) {
                files.push({ path: path, type: fileType });
            }
        }

        return {
            name: name,
            files: files
        };
    }

    _parseMemoryMaps(element) {
        const registers = [];
        
        for (const memoryMap of element.querySelectorAll(this._ns('memoryMap'))) {
            for (const addressBlock of memoryMap.querySelectorAll(this._ns('addressBlock'))) {
                const baseAddress = this._parseAddress(this._getText(addressBlock, 'baseAddress'));
                const range = this._parseAddress(this._getText(addressBlock, 'range'));
                const width = parseInt(this._getText(addressBlock, 'width')) || 32;
                
                for (const register of addressBlock.querySelectorAll(this._ns('register'))) {
                    const regName = this._getText(register, 'name') || 'unnamed';
                    const offset = this._parseAddress(this._getText(register, 'addressOffset'));
                    const regWidth = parseInt(this._getText(register, 'size')) || width;
                    const access = this._getText(register, 'access') || 'read-write';
                    const description = this._getText(register, 'description') || '';
                    
                    registers.push({
                        name: regName,
                        offset: baseAddress + offset,
                        width: regWidth,
                        access: access,
                        description: description
                    });
                }
            }
        }

        return { registers: registers };
    }

    _getText(parent, tagName) {
        // Try with namespace prefix first, then without
        const el = parent.querySelector(this._ns(tagName)) || 
                   parent.querySelector(tagName);
        return el ? el.textContent.trim() : '';
    }

    _getChild(parent, tagName) {
        return parent.querySelector(this._ns(tagName)) || 
               parent.querySelector(tagName);
    }

    _ns(tagName) {
        // Return tag name with detected namespace prefix
        if (!this.namespacePrefix) return tagName;
        return this.namespacePrefix + tagName;
    }

    _parseAddress(value) {
        if (!value) return 0;
        const trimmed = value.trim();
        if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
            return parseInt(trimmed, 16);
        }
        if (trimmed.startsWith("'h")) {
            return parseInt(trimmed.substring(2), 16);
        }
        return parseInt(trimmed, 10) || 0;
    }

    _normalizeInterfaceType(type) {
        const lower = type.toLowerCase();
        if (lower.includes('axi4') && lower.includes('lite')) return 'axi4_lite';
        if (lower.includes('axi4')) return 'axi4';
        if (lower.includes('axi')) return 'axi';
        if (lower.includes('apb')) return 'apb';
        if (lower.includes('ahb')) return 'ahb';
        if (lower.includes('bram')) return 'bram';
        if (lower.includes('clock')) return 'clock';
        if (lower.includes('reset')) return 'reset';
        if (lower.includes('interrupt')) return 'interrupt';
        if (lower.includes('gpio')) return 'gpio';
        return lower;
    }

    _normalizeParamType(type) {
        const lower = type.toLowerCase();
        if (lower === 'bool' || lower === 'boolean') return 'boolean';
        if (lower === 'int' || lower === 'integer' || lower === 'long' || lower === 'bit') return 'integer';
        if (lower === 'float' || lower === 'double' || lower === 'real') return 'float';
        if (lower === 'bitvector' || lower === 'std_logic_vector') return 'bit_vector';
        return 'string';
    }

    _inferRoleFromAbstraction(absName) {
        const lower = absName.toLowerCase();
        if (lower.includes('master') || lower.includes('initiator')) return 'master';
        if (lower.includes('slave') || lower.includes('target')) return 'slave';
        return null;
    }

    _inferRoleFromPorts(element, type) {
        if (type === 'clock' || type === 'reset' || type === 'interrupt') return null;
        
        const ports = element.querySelectorAll(this._ns('port'));
        let hasInput = false;
        let hasOutput = false;
        
        for (const port of ports) {
            const direction = this._getText(port, 'direction') || port.getAttribute('direction') || '';
            if (direction === 'in' || direction === 'inout') hasInput = true;
            if (direction === 'out' || direction === 'inout') hasOutput = true;
        }

        // Master typically drives signals (outputs), slave receives (inputs)
        if (hasOutput && !hasInput) return 'master';
        if (hasInput && !hasOutput) return 'slave';
        return 'slave'; // default
    }
}

export { IPXACTParser };
