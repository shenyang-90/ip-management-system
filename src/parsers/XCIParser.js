// XCIParser.js - Parse Xilinx Component Interface (XCI) XML files
// XCI is an XML format used by Xilinx Vivado to describe IP configurations

import { normalizeParamType, normalizeFileGroups } from '../utils/parser-helpers.js';

class XCIParser {
    constructor() {}

    parse(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'application/xml');
        
        // Check for parse errors
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Invalid XML: ' + parserError.textContent);
        }

        const root = doc.documentElement;
        
        // Determine root element type
        const rootName = root.localName || root.nodeName;
        
        if (rootName === 'component') {
            // XCI-style component
            return this._parseComponent(root);
        } else if (rootName === 'ip_catalog') {
            // Legacy catalog format
            return this._parseIPCatalog(root);
        } else {
            throw new Error(`Unknown XCI root element: ${rootName}. Expected <component> or <ip_catalog>`);
        }
    }

    _parseComponent(element) {
        const ip = {
            vendor: this._getText(element, 'vendor'),
            library: this._getText(element, 'library'),
            name: this._getText(element, 'name'),
            version: this._getText(element, 'version'),
            display_name: this._getText(element, 'display_name') || this._getText(element, 'name'),
            description: this._getText(element, 'description'),
            category: this._getText(element, 'category') || 'Imported',
            status: 'active',
            interfaces: [],
            parameters: [],
            file_groups: [],
            register_map: { registers: [] }
        };

        // Parse bus interfaces
        const busInterfaces = element.querySelector('busInterfaces') || element.querySelector('bus_interfaces');
        if (busInterfaces) {
            for (const busInterface of busInterfaces.querySelectorAll('busInterface, bus_interface')) {
                ip.interfaces.push(this._parseBusInterface(busInterface));
            }
        }

        // Parse parameters
        const parameters = element.querySelector('parameters');
        if (parameters) {
            for (const param of parameters.querySelectorAll('parameter')) {
                ip.parameters.push(this._parseParameter(param));
            }
        }

        // Parse file sets
        const fileSets = element.querySelector('fileSets') || element.querySelector('file_sets');
        if (fileSets) {
            for (const fileSet of fileSets.querySelectorAll('fileSet, file_set')) {
                ip.file_groups.push(this._parseFileSet(fileSet));
            }
        }

        // Normalize file_groups to internal schema
        ip.file_groups = normalizeFileGroups(ip.file_groups);

        return ip;
    }

    _parseIPCatalog(element) {
        // Legacy catalog format - typically contains one or more components
        const components = element.querySelectorAll('component');
        if (components.length === 0) {
            throw new Error('No <component> found in ip_catalog');
        }
        // Import the first component
        return this._parseComponent(components[0]);
    }

    _parseBusInterface(element) {
        const name = this._getText(element, 'name') || 'unnamed';
        const busType = element.querySelector('busType') || element.querySelector('bus_type');
        
        let type = 'custom';
        let role = null;
        
        if (busType) {
            const typeName = busType.getAttribute('name') || busType.textContent || 'custom';
            type = this._normalizeInterfaceType(typeName);
        }

        // Determine role from abstraction type or interface mode
        const abstractionType = element.querySelector('abstractionType') || element.querySelector('abstraction_type');
        const interfaceMode = element.querySelector('master') || element.querySelector('slave') || 
                              element.querySelector('initiator') || element.querySelector('target');
        
        if (interfaceMode) {
            const modeName = interfaceMode.localName || interfaceMode.nodeName;
            role = modeName === 'master' || modeName === 'initiator' ? 'master' : 'slave';
        } else {
            // Try to infer from port names or type
            role = this._inferRole(element, type);
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
        const displayName = this._getText(element, 'displayName') || element.getAttribute('displayName') || name;
        const value = this._getText(element, 'value') || element.getAttribute('value') || '';
        const type = this._getText(element, 'resolve') || element.getAttribute('resolve') || 'string';
        const description = this._getText(element, 'description') || '';

        return {
            name: name,
            display_name: displayName,
            type: normalizeParamType(type),
            default: value,
            description: description
        };
    }

    _parseFileSet(element) {
        const name = this._getText(element, 'name') || element.getAttribute('name') || 'default';
        const files = [];
        
        for (const file of element.querySelectorAll('file')) {
            const path = this._getText(file, 'name') || file.getAttribute('name') || '';
            const fileType = file.getAttribute('fileType') || file.getAttribute('file_type') || 'unknown';
            if (path) {
                files.push({ path: path, type: fileType });
            }
        }

        return {
            name: name,
            files: files
        };
    }

    _getText(parent, tagName) {
        const el = parent.querySelector(tagName);
        return el ? el.textContent.trim() : '';
    }

    _normalizeInterfaceType(type) {
        const lower = type.toLowerCase().replace(/[-_]/g, '');
        if ((lower.includes('axi4') || lower.includes('axilite') || lower.includes('axiLite'.toLowerCase())) && lower.includes('lite')) return 'axi4_lite';
        if (lower.includes('axi4')) return 'axi4';
        if (lower.includes('axi')) return 'axi';
        if (lower.includes('apb')) return 'apb';
        if (lower.includes('ahb')) return 'ahb';
        if (lower.includes('bram')) return 'bram';
        if (lower.includes('clock')) return 'clock';
        if (lower.includes('reset')) return 'reset';
        if (lower.includes('interrupt')) return 'interrupt';
        return type.toLowerCase();
    }

    _inferRole(element, type) {
        // Infer role from port directions or interface structure
        const ports = element.querySelectorAll('port');
        let hasInput = false;
        let hasOutput = false;
        
        for (const port of ports) {
            const direction = port.getAttribute('direction') || 
                            (port.querySelector('direction') ? port.querySelector('direction').textContent : '');
            if (direction === 'in' || direction === 'input') hasInput = true;
            if (direction === 'out' || direction === 'output') hasOutput = true;
        }

        // For bus interfaces: if mostly outputs, likely master; if mostly inputs, likely slave
        if (hasOutput && !hasInput) return 'master';
        if (hasInput && !hasOutput) return 'slave';
        
        // Default based on type
        if (type === 'clock' || type === 'reset' || type === 'interrupt') return null; // signal types don't have master/slave
        return 'slave'; // default assumption
    }
}

export { XCIParser };
