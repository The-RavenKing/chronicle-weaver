export class Grimoire {
    constructor(data = {}) {
        this.name = data.name || "New Grimoire";
        this.description = data.description || "";
        this.scan_depth = data.scan_depth || 2;
        this.token_budget = data.token_budget || 500;
        this.recursive_scanning = data.recursive_scanning || false;
        this.extensions = data.extensions || {};
        this.entries = data.entries || [];
    }

    /**
     * Checks text for keywords and returns matching entries.
     * @param {string} text - The text to scan for keywords.
     * @returns {Array} - Array of matching entry contents.
     */
    scan(text) {
        const matches = [];
        const seenEntries = new Set();
        const lowerText = text.toLowerCase();

        for (const entry of this.entries) {
            if (!entry.enabled) continue;

            // Check keys (primary keywords)
            let matched = false;
            for (const key of entry.keys) {
                if (lowerText.includes(key.toLowerCase())) {
                    matched = true;
                    break;
                }
            }

            // Check secondary keys if primary matched (or if no secondary keys exist)
            if (matched && entry.secondary_keys && entry.secondary_keys.length > 0) {
                let secondaryMatched = false;
                for (const key of entry.secondary_keys) {
                    if (lowerText.includes(key.toLowerCase())) {
                        secondaryMatched = true;
                        break;
                    }
                }
                if (!secondaryMatched) matched = false;
            }

            if (matched && !seenEntries.has(entry.uid)) {
                matches.push(entry);
                seenEntries.add(entry.uid);
            }
        }
        
        // Sort by insertion order/priority if needed, for now just custom order
        return matches.sort((a, b) => a.order - b.order);
    }

    toJSON() {
        return {
            name: this.name,
            description: this.description,
            scan_depth: this.scan_depth,
            token_budget: this.token_budget,
            recursive_scanning: this.recursive_scanning,
            extensions: this.extensions,
            entries: this.entries
        };
    }
}
