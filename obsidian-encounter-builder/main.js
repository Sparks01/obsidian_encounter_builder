'use strict';

const obsidian = require('obsidian');

/**
 * D&D 2024 Encounter Builder Plugin for Obsidian
 * Helps DMs create balanced encounters with monster lookup, XP calculation, and difficulty assessment
 */

// --- Constants for Column Indices ---
const QTY_COL = 0;
const NAME_COL = 1;
const CR_COL = 2;
const XP_COL = 3;

// --- Parse Encounter Source ---
/**
 * Parses an encounter table from markdown source
 * @param {string} source - The markdown source to parse
 * @returns {Object} - Parsed encounter data including creatures, XP, and CR information
 */
function parseEncounterSource(source) {
    const lines = source.trim().split('\n');
    const creatures = [];
    let headerSkipped = false;
    let totalXPFromTable = 0;
    let highestCR = 0;
    let totalCR = 0;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.indexOf('|') === -1 || 
            trimmedLine.replace(/[\|\-\s]/g, '').length === 0 ||
            trimmedLine.includes(':---')) { // Add explicit check for table formatting
            if (trimmedLine.includes('---')) { headerSkipped = true; }
            continue;
        }
        if (!headerSkipped) {
            if (trimmedLine.toLowerCase().includes('creature') || trimmedLine.toLowerCase().includes('cr')) {
                headerSkipped = true;
                continue;
            }
        }
        if (trimmedLine.toLowerCase().includes('total')) { continue; }

        let cells = trimmedLine.split('|').map(cell => cell.trim());
        if (cells[0] === '') cells.shift();
        if (cells[cells.length - 1] === '') cells.pop();

        if (cells.length >= XP_COL + 1) {
            const quantity = parseInt(cells[QTY_COL], 10) || 1;
            const name = cells[NAME_COL];
            const crText = cells[CR_COL];
            const xpText = cells[XP_COL];
            let cr = 0;
            if (crText) {
                if (crText.includes('/')) {
                    const parts = crText.split('/');
                    if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1])) && parseFloat(parts[1]) !== 0) {
                        cr = parseFloat(parts[0]) / parseFloat(parts[1]);
                    } else { console.warn(`EB: Bad fraction CR: ${crText}`); cr = 0; }
                } else {
                    cr = parseFloat(crText);
                    if (isNaN(cr)) { console.warn(`EB: Bad number CR: ${crText}`); cr = 0; }
                }
            } else { console.warn(`EB: Missing CR: ${trimmedLine}`); cr = 0; }
            const xp = parseInt(xpText.replace(/,/g, ''), 10) || 0;
            if (quantity > 0) {
                creatures.push({ quantity, name, cr, crText, xp });
                totalXPFromTable += quantity * xp;
                totalCR += quantity * cr;
                highestCR = Math.max(highestCR, cr);
            }
        } else { console.warn(`EB: Skipping row, bad columns: ${trimmedLine}`); }
    }

    let explicitTotalXP = null;
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.toLowerCase().includes('total')) {
            let cells = trimmedLine.split('|').map(cell => cell.trim());
            if (cells[0] === '') cells.shift();
            if (cells[cells.length - 1] === '') cells.pop();
            for (let j = cells.length - 1; j >= 0; j--) {
                const cell = cells[j];
                if (cell && cell.length > 0) {
                    const matches = cell.match(/(\d[\d,]*)/);
                    if (matches && matches[1]) {
                        explicitTotalXP = parseInt(matches[1].replace(/,/g, ''), 10); break;
                    }
                }
            }
            if (explicitTotalXP !== null) break;
        }
    }
    return {
        creatures: creatures,
        totalXP: explicitTotalXP !== null && !isNaN(explicitTotalXP) ? explicitTotalXP : totalXPFromTable,
        totalCR: totalCR,
        highestCR: highestCR
    };
}

/**
 * Main Encounter Modal for creating new encounters
 */
class EncounterModal extends obsidian.Modal {
    constructor(app, editor, plugin) { 
        super(app); 
        this.editor = editor; 
        this.plugin = plugin; 
        this.creatures = []; 
    }
    
    onOpen() {
        this.contentEl.empty(); 
        this.contentEl.createEl('h2', { text: 'Create Encounter' });
        const formEl = this.contentEl.createDiv({ cls: 'encounter-form' });
        
        // Quantity input
        const quantityEl = formEl.createDiv(); 
        quantityEl.createEl('label', { text: 'Quantity:' });
        this.quantityInput = quantityEl.createEl('input', { type: 'number', value: '1' }); 
        this.quantityInput.min = '1';
        
        // Creature name input with autocomplete
        const nameEl = formEl.createDiv(); 
        nameEl.createEl('label', { text: 'Creature:' });
        this.nameContainer = nameEl.createEl('div', {cls: 'encounter-creature-input-container'});
        this.nameInput = this.nameContainer.createEl('input', { type: 'text', placeholder: 'Enter creature name...' });
        const lookupBtn = this.nameContainer.createEl('button', { text: 'Lookup CR/XP' }); 
        lookupBtn.addClass('mod-cta'); 
        lookupBtn.addEventListener('click', () => this.lookupCreature());
        
        // CR input
        const crEl = formEl.createDiv(); 
        crEl.createEl('label', { text: 'CR:' }); 
        this.crInput = crEl.createEl('input', { type: 'text', placeholder: 'Lookup or enter manually' });
        
        // XP input
        const xpEl = formEl.createDiv(); 
        xpEl.createEl('label', { text: 'XP:' }); 
        this.xpInput = xpEl.createEl('input', { type: 'number', placeholder: 'Lookup or enter manually' }); 
        this.xpInput.min = '0';
        
        // Add creature button
        const addBtn = formEl.createEl('button', { text: 'Add Creature to List' }); 
        addBtn.addEventListener('click', () => this.addCreature());
        
        // Creature list container
        this.listEl = this.contentEl.createDiv({ cls: 'encounter-creature-list' }); 
        this.renderCreatureList();
        
        // Button container for create/cancel
        const buttonContainer = this.contentEl.createEl('div', { cls: 'encounter-button-container' });
        const createBtn = buttonContainer.createEl('button', { text: 'Create Encounter Table' }); 
        createBtn.addClass('mod-cta'); 
        createBtn.addEventListener('click', () => this.createEncounter());
        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' }); 
        cancelBtn.addEventListener('click', () => this.close());
        
        // Setup autocomplete after nameContainer is defined
        this.setupAutocomplete();
        
        // Add quick add section for common monsters
        this.addQuickAddSection();
        
        // Setup keyboard navigation
        this.setupKeyboardNavigation();
        
        // Focus the name input initially
        setTimeout(() => this.nameInput.focus(), 50);
    }
    
    /**
     * Setup keyboard navigation between form fields
     */
    setupKeyboardNavigation() {
        this.nameInput.addEventListener('input', () => {});
        this.nameInput.addEventListener('keydown', async (e) => { 
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                await this.lookupCreature(); 
                this.quantityInput.focus(); 
            } 
        });
        this.quantityInput.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                this.nameInput.focus(); 
            } 
        });
        this.crInput.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                this.xpInput.focus(); 
            } 
        });
        this.xpInput.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                this.addCreature(); 
            } 
        });
    }
    
    /**
     * Setup autocomplete for monster name input
     */
    setupAutocomplete() {
        // Create a container for suggestions
        this.suggestionContainer = this.nameContainer.createDiv({ cls: 'encounter-suggestions' });
        this.suggestionContainer.style.display = 'none';
        
        // Get all monster files for autocomplete based on configured locations
        const locations = [
            this.plugin.settings.monsterLocation1,
            this.plugin.settings.monsterLocation2,
            this.plugin.settings.monsterLocation3
        ].filter(loc => loc && loc.trim() !== '');
        
        this.monsterFiles = this.app.vault.getMarkdownFiles().filter(file => {
            if (locations.length === 0) {
                // Default behavior if no locations configured
                return file.path.includes('/bestiary/') && 
                      (file.path.includes('z_compendium/') || file.path.includes('2024_z_compendium/'));
            }
            
            // Check if file is in any of the configured locations
            return locations.some(location => file.path.includes(location));
        });
            
        // Create a debounced search function
        this.debouncedSearch = this.debounce(() => {
            const query = this.nameInput.value.trim().toLowerCase();
            if (query.length < 2) {
                this.suggestionContainer.style.display = 'none';
                return;
            }

            // Find matches
            const matches = this.monsterFiles
                .filter(file => file.basename.toLowerCase().includes(query))
                .sort((a, b) => {
                    // Prioritize exact matches and 2024 monsters
                    const aExact = a.basename.toLowerCase() === query;
                    const bExact = b.basename.toLowerCase() === query;
                    const a2024 = a.path.includes('2024_z_compendium');
                    const b2024 = b.path.includes('2024_z_compendium');
                    
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;
                    if (a2024 && !b2024) return -1;
                    if (!a2024 && b2024) return 1;
                    return a.basename.toLowerCase().localeCompare(b.basename.toLowerCase());
                })
                .slice(0, 7); // Limit to 7 suggestions

            // Clear previous suggestions
            this.suggestionContainer.empty();
            
            if (matches.length === 0) {
                this.suggestionContainer.style.display = 'none';
                return;
            }
            
            // Add new suggestions
            matches.forEach(file => {
                const source = file.path.includes('2024_z_compendium') ? ' (2024)' : '';
                const item = this.suggestionContainer.createDiv({ cls: 'encounter-suggestion-item', text: file.basename + source });
                
                item.addEventListener('click', () => {
                    this.nameInput.value = file.basename;
                    this.suggestionContainer.style.display = 'none';
                    this.lookupCreature();
                });
            });
            
            this.suggestionContainer.style.display = 'block';
        }, 300);
        
        // Attach input event
        this.nameInput.addEventListener('input', () => {
            this.debouncedSearch();
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.suggestionContainer.contains(e.target) && e.target !== this.nameInput) {
                this.suggestionContainer.style.display = 'none';
            }
        });
        
        // Arrow key navigation for suggestions
        this.nameInput.addEventListener('keydown', (e) => {
            if (this.suggestionContainer.style.display === 'none') return;
            
            const items = this.suggestionContainer.querySelectorAll('.encounter-suggestion-item');
            const selected = this.suggestionContainer.querySelector('.selected');
            let index = Array.from(items).indexOf(selected);
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (index < items.length - 1) {
                        if (selected) selected.removeClass('selected');
                        items[index + 1].addClass('selected');
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (index > 0) {
                        if (selected) selected.removeClass('selected');
                        items[index - 1].addClass('selected');
                    }
                    break;
                case 'Enter':
                    if (selected) {
                        e.preventDefault();
                        this.nameInput.value = selected.textContent.replace(' (2024)', '');
                        this.suggestionContainer.style.display = 'none';
                        this.lookupCreature();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.suggestionContainer.style.display = 'none';
                    break;
            }
        });
    }

    /**
     * Simple debounce function to prevent excessive lookups
     */
    debounce(func, wait) {
        let timeout;
        return () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(), wait);
        };
    }
   
    /**
     * Look up a creature's CR and XP values
     */
    async lookupCreature() {
        const creatureName = this.nameInput.value.trim(); 
        if (!creatureName) { 
            new obsidian.Notice('Please enter a creature name.'); 
            return; 
        }
        this.crInput.value = ''; 
        this.xpInput.value = ''; 
        new obsidian.Notice(`Looking up '${creatureName}'...`);
        try {
            const stats = await this.plugin.lookupCreatureStats(creatureName);
            if (stats && stats.cr !== undefined && stats.xp !== undefined) {
                this.crInput.value = stats.cr; 
                this.xpInput.value = stats.xp; 
                new obsidian.Notice(`Found: ${creatureName} (CR ${stats.cr}, ${stats.xp} XP)`); 
                this.crInput.focus();
            } else { 
                this.nameInput.focus(); 
                this.nameInput.select(); 
            }
        } catch (error) { 
            console.error("EB: Lookup failed in modal:", error); 
            this.nameInput.focus(); 
            this.nameInput.select(); 
        }
    }
    
    /**
     * Add a creature to the encounter list
     */
    addCreature() {
        const quantity = parseInt(this.quantityInput.value, 10) || 1; 
        const name = this.nameInput.value.trim(); 
        const cr = this.crInput.value.trim(); 
        const xp = parseInt(this.xpInput.value, 10);
        
        // Validate inputs
        if (!name) { 
            new obsidian.Notice('Please enter a creature name.'); 
            this.nameInput.focus(); 
            return; 
        }
        if (cr === undefined || cr === '') { 
            new obsidian.Notice('Please enter or lookup a CR value.'); 
            this.crInput.focus(); 
            return; 
        }
        if (isNaN(xp) || xp < 0) { 
            new obsidian.Notice('Please enter a valid XP value (0 or more).'); 
            this.xpInput.focus(); 
            return; 
        }
        
        // Add to creatures array
        this.creatures.push({ quantity, name, cr, xp }); 
        this.renderCreatureList();
        
        // Reset form
        this.quantityInput.value = '1'; 
        this.nameInput.value = ''; 
        this.crInput.value = ''; 
        this.xpInput.value = ''; 
        this.nameInput.focus();
    }
    
    /**
     * Render the list of creatures in the encounter
     */
    renderCreatureList() {
        this.listEl.empty();
        if (this.creatures.length === 0) {
            this.listEl.createEl('p', { text: 'No creatures added yet.' });
            return;
        }
        
        // Create encounter table
        const tableEl = this.listEl.createEl('table', { cls: 'encounter-modal-table' });
        const thead = tableEl.createEl('thead');
        const headerRow = thead.createEl('tr');
        ['Qty', 'Creature', 'CR', 'XP', 'Total XP', 'Actions'].forEach(header => {
            headerRow.createEl('th', { text: header });
        });
        
        // Populate table body
        const tbody = tableEl.createEl('tbody');
        let grandTotalXP = 0;
        
        this.creatures.forEach((creature, index) => {
            const row = tbody.createEl('tr');
            const creatureTotalXP = creature.quantity * creature.xp;
            grandTotalXP += creatureTotalXP;
            
            row.createEl('td', { text: creature.quantity.toString() });
            row.createEl('td', { text: creature.name });
            row.createEl('td', { text: creature.cr });
            row.createEl('td', { text: creature.xp.toLocaleString() });
            row.createEl('td', { text: creatureTotalXP.toLocaleString() });
            
            // Action buttons
            const actionsCell = row.createEl('td');
            const actionsContainer = actionsCell.createDiv({ cls: 'encounter-actions' });
            
            // Edit button
            const editBtn = actionsContainer.createEl('button', { text: 'Edit' });
            editBtn.addEventListener('click', () => {
                this.editCreature(index);
            });
            
            // Remove button
            const removeBtn = actionsContainer.createEl('button', { text: 'Remove' });
            removeBtn.addClass('mod-warning');
            removeBtn.addEventListener('click', () => {
                this.creatures.splice(index, 1);
                this.renderCreatureList();
            });
        });
        
        // Create footer with total XP
        const tfoot = tableEl.createEl('tfoot');
        const totalRow = tfoot.createEl('tr');
        totalRow.addClass('encounter-modal-total-row');
        totalRow.createEl('td', { text: 'TOTAL', attr: { colspan: '4' } });
        totalRow.createEl('td', { text: grandTotalXP.toLocaleString() });
        totalRow.createEl('td');
    }

    /**
     * Edit an existing creature in the encounter
     */
    editCreature(index) {
        const creature = this.creatures[index];
        this.editingIndex = index;
        
        // Fill in form with creature data
        this.quantityInput.value = creature.quantity;
        this.nameInput.value = creature.name;
        this.crInput.value = creature.cr;
        this.xpInput.value = creature.xp;
        
        // Change Add button to Update button
        const addBtn = this.contentEl.querySelector('button:not(.mod-cta):not(.mod-warning)');
        addBtn.textContent = 'Update Creature';
        
        // Store the original click handler and replace it
        addBtn.onclick = () => this.updateCreature();
        
        // Focus the quantity input
        this.quantityInput.focus();
    }

    /**
     * Add a quick-add section for common monsters
     */
    addQuickAddSection() {
        // Create a section for quick add
        const quickAddSection = this.contentEl.createDiv({ cls: 'encounter-quick-add' });
        quickAddSection.createEl('h3', { text: 'Quick Add Common Monsters' });
        
        // Define common monsters with preset stats
        const commonMonsters = [
            { name: 'Zombie', cr: '1/4', xp: 75, source: '2024' },
            { name: 'Skeleton', cr: '1/4', xp: 75, source: '2024' },
            { name: 'Goblin', cr: '1/4', xp: 75, source: '2024' },
            { name: 'Kobold', cr: '1/8', xp: 35, source: '2024' },
            { name: 'Orc', cr: '1/2', xp: 150, source: '2024' },
            { name: 'Bandit', cr: '1/8', xp: 35, source: '2024' },
            { name: 'Wolf', cr: '1/4', xp: 75, source: '2024' },
            { name: 'Giant Rat', cr: '1/8', xp: 35, source: '2024' }
        ];
        
        // Create buttons for quick add
        const buttonContainer = quickAddSection.createDiv({ cls: 'encounter-quick-add-buttons' });
        
        commonMonsters.forEach(monster => {
            const btn = buttonContainer.createEl('button', { 
                text: `${monster.name} (${monster.cr})`,
                cls: 'encounter-quick-add-btn'
            });
            
            if (monster.source === '2024') {
                btn.addClass('encounter-source-2024');
            }
            
            btn.addEventListener('click', () => {
                // Fill in form with monster data
                this.nameInput.value = monster.name;
                this.crInput.value = monster.cr;
                this.xpInput.value = monster.xp;
                
                // Focus the quantity input
                this.quantityInput.focus();
                this.quantityInput.select();
            });
        });
    }

    /**
     * Update an existing creature in the encounter list
     */
    updateCreature() {
        if (this.editingIndex === undefined) return;
        
        const quantity = parseInt(this.quantityInput.value, 10) || 1;
        const name = this.nameInput.value.trim();
        const cr = this.crInput.value.trim();
        const xp = parseInt(this.xpInput.value, 10);
        
        // Validate inputs
        if (!name) {
            new obsidian.Notice('Please enter a creature name.');
            this.nameInput.focus();
            return;
        }
        
        if (cr === undefined || cr === '') {
            new obsidian.Notice('Please enter or lookup a CR value.');
            this.crInput.focus();
            return;
        }
        
        if (isNaN(xp) || xp < 0) {
            new obsidian.Notice('Please enter a valid XP value (0 or more).');
            this.xpInput.focus();
            return;
        }
        
        // Update the creature
        this.creatures[this.editingIndex] = { quantity, name, cr, xp };
        
        // Reset form and button
        this.quantityInput.value = '1';
        this.nameInput.value = '';
        this.crInput.value = '';
        this.xpInput.value = '';
        
        // Reset the Add button
        const addBtn = this.contentEl.querySelector('button:not(.mod-cta):not(.mod-warning)');
        addBtn.textContent = 'Add Creature to List';
        addBtn.onclick = () => this.addCreature();
        
        // Clear editing index
        this.editingIndex = undefined;
        
        // Update the list
        this.renderCreatureList();
        this.nameInput.focus();
    }
    
    /**
     * Create the final encounter table and insert it into the editor
     */
    createEncounter() {
        if (this.creatures.length === 0) { 
            new obsidian.Notice('Add at least one creature.'); 
            return; 
        }
        
        // Create table header
        let tableText = '| Qty | Creature | CR | XP | Total XP |\n'; 
        tableText += '|:----|:---------|:---|---:|---------:|\n'; 
        let finalTotalXP = 0;
        
        // Add each creature row
        this.creatures.forEach(creature => {
            const creatureTotalXP = creature.quantity * creature.xp; 
            finalTotalXP += creatureTotalXP; 
            let linkName = creature.name.trim(); 
            
            // Wrap creature name in wikilinks if not already
            if (!linkName.startsWith('[[') && !linkName.endsWith(']]')) { 
                linkName = `[[${linkName}]]`; 
            }
            
            tableText += `| ${creature.quantity} | ${linkName} | ${creature.cr} | ${creature.xp.toLocaleString()} | ${creatureTotalXP.toLocaleString()} |\n`;
        });
        
        // Add total row
        tableText += `| **Total** | | | | **${finalTotalXP.toLocaleString()}** |\n`;
        
        // Insert table into editor
        this.editor.replaceSelection('```encounter\n' + tableText + '```\n'); 
        this.close();
    }
    
    onClose() { 
        this.contentEl.empty(); 
    }
}

/**
 * Modal for selecting the correct monster when multiple matches are found
 */
class MonsterSelectModal extends obsidian.Modal {
    constructor(app, plugin, files, onSelect) {
        super(app);
        this.plugin = plugin;
        this.files = files;
        this.onSelect = onSelect;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        
        contentEl.createEl('h2', {text: 'Multiple Monsters Found'});
        contentEl.createEl('p', {text: 'Multiple files match this creature name. Please select the correct one:'});
        
        const listEl = contentEl.createDiv({cls: 'encounter-file-list'});
        
        this.files.forEach(file => {
            const fileItem = listEl.createDiv({cls: 'encounter-file-item'});
            
            const fileInfo = fileItem.createDiv({cls: 'encounter-file-info'});
            fileInfo.createEl('div', {
                cls: 'encounter-file-name',
                text: file.basename
            });
            fileInfo.createEl('div', {
                cls: 'encounter-file-path',
                text: file.path
            });
            
            const selectBtn = fileItem.createEl('button', {
                text: 'Select',
                cls: 'mod-cta'
            });
            
            selectBtn.addEventListener('click', () => {
                this.onSelect(file);
                this.close();
            });
        });
        
        const buttonContainer = contentEl.createDiv({cls: 'encounter-button-container'});
        const cancelBtn = buttonContainer.createEl('button', {text: 'Cancel'});
        cancelBtn.addEventListener('click', () => {
            this.close();
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

/**
 * Modal for manually entering monster stats when auto-parsing fails
 */
class ManualStatEntryModal extends obsidian.Modal {
    constructor(app, plugin, creatureName, onSubmit) {
        super(app);
        this.plugin = plugin;
        this.creatureName = creatureName;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        
        contentEl.createEl('h2', {text: 'Enter Monster Stats'});
        contentEl.createEl('p', {
            text: `Could not automatically parse CR/XP for "${this.creatureName}". Please enter them manually:`
        });
        
        const formEl = contentEl.createDiv({cls: 'encounter-manual-form'});
        
        // CR field
        const crDiv = formEl.createDiv();
        crDiv.createEl('label', {text: 'Challenge Rating:'});
        this.crInput = crDiv.createEl('input', {
            type: 'text',
            placeholder: 'e.g., 5, 1/4, 1/8'
        });
        
        // XP field
        const xpDiv = formEl.createDiv();
        xpDiv.createEl('label', {text: 'XP Value:'});
        this.xpInput = xpDiv.createEl('input', {
            type: 'number',
            placeholder: 'e.g., 1800'
        });
        
        // Auto-calculate XP from CR
        this.crInput.addEventListener('change', () => {
            const cr = this.crInput.value.trim();
            const xp = this.plugin.getCRtoXP(cr);
            if (xp) {
                this.xpInput.value = xp;
            }
        });
        
        // Buttons
        const buttonContainer = contentEl.createDiv({cls: 'encounter-button-container'});
        const submitBtn = buttonContainer.createEl('button', {
            text: 'Submit',
            cls: 'mod-cta'
        });
        const cancelBtn = buttonContainer.createEl('button', {text: 'Cancel'});
        
        submitBtn.addEventListener('click', () => {
            const cr = this.crInput.value.trim();
            const xp = parseInt(this.xpInput.value) || 0;
            
            if (!cr) {
                new obsidian.Notice('Please enter a Challenge Rating');
                return;
            }
            
            if (xp <= 0) {
                new obsidian.Notice('Please enter a valid XP value (greater than 0)');
                return;
            }
            
            this.onSubmit({
                cr: cr,
                xp: xp,
                source: 'Manual'
            });
            
            this.close();
        });
        
        cancelBtn.addEventListener('click', () => {
            this.close();
        });
        
        // Focus the CR input
        setTimeout(() => this.crInput.focus(), 50);
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

/**
 * Settings tab for the Encounter Builder plugin
 */
class EncounterBuilderSettings extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: 'Encounter Builder Settings'});
        
        // Description
        containerEl.createEl('p', {
            text: 'Configure paths where your monster stat blocks are stored. ' +
                  'These paths will be searched in order when looking up monsters.'
        });
        
        // Monster Location 1 (Primary)
        new obsidian.Setting(containerEl)
            .setName('Primary Monster Location')
            .setDesc('Primary location where monster stat blocks are stored (e.g., 2024_z_compendium/bestiary)')
            .addText(text => text
                .setPlaceholder('e.g., 2024_z_compendium/bestiary')
                .setValue(this.plugin.settings.monsterLocation1)
                .onChange(async (value) => {
                    this.plugin.settings.monsterLocation1 = value;
                    await this.plugin.saveSettings();
                }));

        // Monster Location 2 (Secondary)
        new obsidian.Setting(containerEl)
            .setName('Secondary Monster Location')
            .setDesc('Secondary location where monster stat blocks are stored (e.g., z_compendium/bestiary)')
            .addText(text => text
                .setPlaceholder('e.g., z_compendium/bestiary')
                .setValue(this.plugin.settings.monsterLocation2)
                .onChange(async (value) => {
                    this.plugin.settings.monsterLocation2 = value;
                    await this.plugin.saveSettings();
                }));

        // Monster Location 3 (Tertiary/Custom)
        new obsidian.Setting(containerEl)
            .setName('Custom Monster Location')
            .setDesc('Custom location where your own monster stat blocks are stored (e.g., creatures/homebrew)')
            .addText(text => text
                .setPlaceholder('e.g., creatures/homebrew')
                .setValue(this.plugin.settings.monsterLocation3)
                .onChange(async (value) => {
                    this.plugin.settings.monsterLocation3 = value;
                    await this.plugin.saveSettings();
                }));

        // Search all vault option
        new obsidian.Setting(containerEl)
            .setName('Search All Vault if Not Found')
            .setDesc('If enabled, will search the entire vault if monster is not found in the locations above')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.searchAllVault)
                .onChange(async (value) => {
                    this.plugin.settings.searchAllVault = value;
                    await this.plugin.saveSettings();
                }));
                
        // Encounter multipliers option
        new obsidian.Setting(containerEl)
            .setName('Use Encounter Multipliers')
            .setDesc('Apply 2024 DMG encounter multipliers based on number of monsters (recommended)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useEncounterMultipliers)
                .onChange(async (value) => {
                    this.plugin.settings.useEncounterMultipliers = value;
                    await this.plugin.saveSettings();
                }));
    }
}

/**
 * Main plugin class for the Encounter Builder
 */
class EncounterBuilderPlugin extends obsidian.Plugin {
    // Default settings
    DEFAULT_SETTINGS = {
        monsterLocation1: '2024_z_compendium/bestiary',
        monsterLocation2: 'z_compendium/bestiary',
        monsterLocation3: '',
        searchAllVault: true,
        useEncounterMultipliers: true
    }
    
    async onload() {
        console.log('Loading Encounter Builder Plugin');
        
        // Load settings
        this.settings = Object.assign({}, this.DEFAULT_SETTINGS, await this.loadData());
        
        // Add settings tab
        this.addSettingTab(new EncounterBuilderSettings(this.app, this));
        
        // Add command
        this.addCommand({
            id: 'create-encounter-table',
            name: 'Create Encounter Table',
            editorCallback: (editor, view) => { this.showEncounterModal(editor); }
        });

        // Register markdown processor for encounter code blocks
        this.registerMarkdownCodeBlockProcessor('encounter', (source, el, ctx) => {
            try {
                const tableContainer = el.createDiv({ cls: 'encounter-table-container' });
                const tableEl = tableContainer.createEl('table', { cls: 'encounter-table' });
                const lines = source.trim().split('\n');
                let headerRendered = false;
                let tbody = null;

                // Parse each line of the table
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line || line.indexOf('|') === -1) continue;
                    if (line.replace(/[\|\-\s]/g, '').length === 0) { headerRendered = true; continue; }
                    
                    const row = tableEl.createEl('tr');
                    const isTotal = line.toLowerCase().includes('total');
                    if (isTotal) row.addClass('encounter-total-row');
                    
                    let cells = line.split('|');
                    for (let j = 0; j < cells.length; j++) {
                        let cellText = cells[j].trim();
                        if ((j === 0 || j === cells.length - 1) && cellText === '') continue;
                        
                        const isHeader = !headerRendered && !isTotal;
                        const cell = row.createEl(isHeader ? 'th' : 'td');
                        
                        // Handle wikilinks in cells
                        if (cellText.startsWith('[[') && cellText.endsWith(']]')) {
                            const linkText = cellText.slice(2, -2);
                            obsidian.MarkdownRenderer.renderMarkdown(`[[${linkText}]]`, cell, ctx.sourcePath, this);
                            if (cell.childNodes.length === 1 && cell.firstChild.nodeName === 'P') { 
                                cell.innerHTML = cell.firstChild.innerHTML; 
                            }
                        } else { 
                            cell.innerHTML = cellText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); 
                        }
                    }
                    
                    // Add row to appropriate section
                    if (!headerRendered && !isTotal && !tableEl.tHead) {
                        const thead = tableEl.createEl('thead');
                        thead.appendChild(row);
                    } else {
                        if (!tbody) tbody = tableEl.createEl('tbody');
                        tbody.appendChild(row);
                    }
                }
                
                if (!tbody && tableEl.tHead) tbody = tableEl.createEl('tbody');
                
                // Add difficulty calculator
                this.addDifficultyCalculator(tableContainer, source);
            } catch (error) {
                console.error("Encounter Builder Error:", error);
                el.createDiv({ cls: 'encounter-error', text: 'Error rendering encounter: ' + error.message });
            }
        });
    }

    onunload() { 
        console.log('Unloading Encounter Builder Plugin'); 
    }

    // Helper method to save settings
    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    /**
     * Get XP from CR using the 2024 DMG table
     */
    getCRtoXP(cr) {
        const CR_TO_XP_2024 = { 
            '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, 
            '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, 
            '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, 
            '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, 
            '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, 
            '29': 135000, '30': 155000  
        };
        
        return CR_TO_XP_2024[cr] || null;
    }
    
    /**
     * Add a difficulty calculator below an encounter table
     */
    addDifficultyCalculator(containerEl, source) {
        const difficultyEl = containerEl.createDiv({ cls: 'encounter-difficulty-container' });
        const encounterData = parseEncounterSource(source);
        console.log("EB: Encounter Total XP (from parser):", encounterData.totalXP);
        console.log("EB: Encounter Data (from parser):", encounterData);

        // Create party input form
        const partyInfoEl = difficultyEl.createDiv({ cls: 'encounter-party-info' });
        const partyForm = partyInfoEl.createDiv({ cls: 'encounter-party-form' });
        partyForm.createEl('label', { text: 'Party Size:' });
        const partySizeInput = partyForm.createEl('input', { type: 'number', value: '4' });
        partySizeInput.min = '1'; partySizeInput.addClass('encounter-party-size');
        partyForm.createEl('label', { text: 'Average Level:' });
        const partyLevelInput = partyForm.createEl('input', { type: 'number', value: '3' });
        partyLevelInput.min = '1'; partyLevelInput.max = '20'; partyLevelInput.addClass('encounter-party-level');
        const calculateButton = partyForm.createEl('button', { text: 'Calculate Difficulty' });
        calculateButton.addClass('encounter-calculate-btn');
        
        // Create results container
        const resultsEl = difficultyEl.createDiv({ cls: 'encounter-difficulty-results' });
        resultsEl.style.display = 'none';
        
        // Add click handler for calculate button
        calculateButton.addEventListener('click', () => {
            const partySize = parseInt(partySizeInput.value, 10) || 4;
            const partyLevel = parseInt(partyLevelInput.value, 10) || 3;
            this.calculateDifficulty(resultsEl, encounterData, partySize, partyLevel);
            resultsEl.style.display = 'block';
        });
    }

    /**
     * Calculate encounter difficulty based on party size, level, and monster data
     */
    calculateDifficulty(resultsEl, encounterData, partySize, partyLevel) {
        resultsEl.empty();
        const { creatures, totalXP, totalCR, highestCR } = encounterData;
    
        // --- DMG 2024 XP Budgets per Character ---
        const dmgXpBudgets = {
            1: { low: 50, moderate: 75, high: 100, outOfBounds: 150 },
            2: { low: 100, moderate: 150, high: 200, outOfBounds: 300 },
            3: { low: 150, moderate: 225, high: 400, outOfBounds: 600 },
            4: { low: 250, moderate: 375, high: 500, outOfBounds: 750 },
            5: { low: 500, moderate: 750, high: 1100, outOfBounds: 1600 },
            6: { low: 600, moderate: 1000, high: 1400, outOfBounds: 2100 },
            7: { low: 750, moderate: 1300, high: 1700, outOfBounds: 2500 },
            8: { low: 1000, moderate: 1700, high: 2100, outOfBounds: 3200 },
            9: { low: 1300, moderate: 2000, high: 2600, outOfBounds: 3900 },
            10: { low: 1600, moderate: 2300, high: 3100, outOfBounds: 4700 },
            11: { low: 1900, moderate: 2900, high: 4100, outOfBounds: 6100 },
            12: { low: 2200, moderate: 3700, high: 4700, outOfBounds: 7000 },
            13: { low: 2600, moderate: 4200, high: 5400, outOfBounds: 8000 },
            14: { low: 2900, moderate: 4900, high: 6200, outOfBounds: 9200 },
            15: { low: 3300, moderate: 5400, high: 7800, outOfBounds: 11500 },
            16: { low: 3800, moderate: 6100, high: 9800, outOfBounds: 14500 },
            17: { low: 4500, moderate: 7200, high: 11700, outOfBounds: 17500 },
            18: { low: 5000, moderate: 8700, high: 14200, outOfBounds: 21500 },
            19: { low: 5500, moderate: 10700, high: 17200, outOfBounds: 26000 },
            20: { low: 6400, moderate: 13200, high: 22000, outOfBounds: 33000 }
        };

        // Validate party level
        if (partyLevel < 1 || partyLevel > 20 || !dmgXpBudgets[partyLevel]) {
            resultsEl.createDiv({ cls: 'encounter-error', text: 'Party level must be between 1 and 20.' }); 
            return;
        }
        
        // Calculate party XP thresholds
        const dmgBudget = dmgXpBudgets[partyLevel];
        const partyLow = dmgBudget.low * partySize;
        const partyModerate = dmgBudget.moderate * partySize;
        const partyHigh = dmgBudget.high * partySize;
        const partyOutOfBounds = dmgBudget.outOfBounds * partySize;

        // Calculate adjusted XP with multipliers if enabled
        let adjustedXP = totalXP;
        let multiplier = 1;
        
        if (this.settings.useEncounterMultipliers) {
            // Count total number of monsters
            const totalMonsters = creatures.reduce((sum, creature) => sum + creature.quantity, 0);
            
            // Apply 2024 DMG encounter multipliers based on monster count
            if (totalMonsters === 1) {
                multiplier = 1.0; // No adjustment for single monster
            } else if (totalMonsters === 2) {
                multiplier = 1.5; // Two monsters
            } else if (totalMonsters >= 3 && totalMonsters <= 6) {
                multiplier = 2.0; // 3-6 monsters
            } else if (totalMonsters >= 7 && totalMonsters <= 10) {
                multiplier = 2.5; // 7-10 monsters
            } else if (totalMonsters >= 11 && totalMonsters <= 14) {
                multiplier = 3.0; // 11-14 monsters
            } else if (totalMonsters >= 15) {
                multiplier = 4.0; // 15+ monsters
            }
            
            adjustedXP = Math.floor(totalXP * multiplier);
        }
        
        // Determine difficulty based on adjusted XP
        let dmgDifficulty = 'Below Low';
        if (adjustedXP >= partyOutOfBounds) dmgDifficulty = 'Out of Bounds';
        else if (adjustedXP >= partyHigh) dmgDifficulty = 'High';
        else if (adjustedXP >= partyModerate) dmgDifficulty = 'Moderate';
        else if (adjustedXP >= partyLow) dmgDifficulty = 'Low';

        resultsEl.createEl('h3', { text: `Difficulty for ${partySize} level ${partyLevel} characters` });

        // --- DMG Section ---
        const dmgSectionEl = resultsEl.createDiv({ cls: 'encounter-dmg-section' });
        dmgSectionEl.createEl('h4', { text: 'DMG 2024 Difficulty (XP Based)' });
        
        // Display multiplier info if enabled
        if (this.settings.useEncounterMultipliers && multiplier > 1) {
            const multiplierInfo = dmgSectionEl.createDiv({ cls: 'encounter-multiplier-info' });
            multiplierInfo.createEl('p', { 
                text: `Base XP: ${totalXP.toLocaleString()} × Multiplier: ${multiplier} = Adjusted XP: ${adjustedXP.toLocaleString()}` 
            });
            multiplierInfo.createEl('p', { 
                text: `(Multiplier based on ${creatures.reduce((sum, c) => sum + c.quantity, 0)} total monsters)`
            });
        }
        
        // Create difficulty threshold table
        const dmgTable = dmgSectionEl.createEl('table', { cls: 'encounter-threshold-table' });
        const dmgHeaderRow = dmgTable.createEl('tr');
        ['Difficulty', 'XP Threshold', 'Encounter XP'].forEach(header => dmgHeaderRow.createEl('th', { text: header }));

        // Use updated difficulty names
        const difficulties = [
            { name: 'Low', value: partyLow },
            { name: 'Moderate', value: partyModerate },
            { name: 'High', value: partyHigh },
            { name: 'Out of Bounds', value: partyOutOfBounds }
        ];

        difficulties.forEach(diff => {
            const row = dmgTable.createEl('tr');
            row.createEl('td', { text: diff.name });
            row.createEl('td', { text: diff.value.toLocaleString() });
            const statusCell = row.createEl('td');
            if (diff.name === dmgDifficulty) {
                statusCell.textContent = '✓'; statusCell.addClass('encounter-current-difficulty'); row.addClass('encounter-highlighted-row');
            } else if (adjustedXP < diff.value) { statusCell.textContent = 'Below'; }
            else { statusCell.textContent = 'Met/Exceeded'; }
        });
        
        // Add summary
        const dmgSummaryEl = dmgSectionEl.createDiv({ cls: 'encounter-summary' });
        
        // Different summary based on whether multipliers are used
        if (this.settings.useEncounterMultipliers && multiplier > 1) {
            dmgSummaryEl.textContent = `Total XP: ${totalXP.toLocaleString()}, Adjusted: ${adjustedXP.toLocaleString()}. DMG Rating: ${dmgDifficulty}.`;
        } else {
            dmgSummaryEl.textContent = `Encounter Total XP: ${totalXP.toLocaleString()}. DMG Rating: ${dmgDifficulty}.`;
        }

        // --- Lazy DM Section (CR Based) ---
        const lazySectionEl = resultsEl.createDiv({ cls: 'encounter-lazy-section' });
        lazySectionEl.createEl('h4', { text: 'Lazy DM Benchmark (CR Based)' });
        const lazyInfoEl = lazySectionEl.createDiv({ cls: 'encounter-lazy-info' });
        
        // Calculate Lazy DM thresholds
        const totalPartyLevel = partySize * partyLevel;
        const crThreshold = partyLevel >= 5 ? totalPartyLevel / 2 : totalPartyLevel / 4;
        const singleMonsterThreshold = partyLevel >= 5 ? partyLevel * 1.5 : partyLevel;
        
        lazyInfoEl.createEl('p', { text: `Party: ${partySize} characters, avg level ${partyLevel} (Total Levels: ${totalPartyLevel})` });
        const crDesc = partyLevel >= 5 ? `LazyDM: Potentially deadly if total monster CR > ${crThreshold.toFixed(2)} (1/2 total party levels).` : `LazyDM: Potentially deadly if total monster CR > ${crThreshold.toFixed(2)} (1/4 total party levels).`;
        lazyInfoEl.createEl('p', { text: crDesc });
        
        // Compare total CR to threshold
        const crComparisonEl = lazyInfoEl.createEl('p'); 
        crComparisonEl.textContent = `Sum of Monster CRs: ${totalCR.toFixed(2)}`;
        if (totalCR > crThreshold) crComparisonEl.addClass('encounter-deadly');
        else if (totalCR > crThreshold * 0.75) crComparisonEl.addClass('encounter-hard');
        else if (totalCR > crThreshold * 0.5) crComparisonEl.addClass('encounter-medium');
        else crComparisonEl.addClass('encounter-easy');
        
        // Compare highest CR to single monster threshold
        const singleDesc = partyLevel >= 5 ? 
            `LazyDM: Single monster may be deadly if its CR > ${singleMonsterThreshold.toFixed(2)} (~1.5x avg party level).` : 
            `LazyDM: Single monster may be deadly if its CR > ${singleMonsterThreshold.toFixed(2)} (~avg party level).`;
        lazyInfoEl.createEl('p', { text: singleDesc });
        
        const singleMonsterEl = lazyInfoEl.createEl('p'); 
        singleMonsterEl.textContent = `Highest single monster CR: ${highestCR.toFixed(2)}`;
        if (highestCR > singleMonsterThreshold) singleMonsterEl.addClass('encounter-deadly');
        else if (highestCR > singleMonsterThreshold * 0.75) singleMonsterEl.addClass('encounter-hard');
        else if (highestCR > singleMonsterThreshold * 0.5) singleMonsterEl.addClass('encounter-medium');
        else singleMonsterEl.addClass('encounter-easy');
        
        // Add final rating
        const crRatingEl = lazyInfoEl.createEl('p'); 
        crRatingEl.addClass('encounter-lazy-rating');
        let crRating = 'Easy';
        if (totalCR > crThreshold || highestCR > singleMonsterThreshold) { 
            crRating = 'Potentially Deadly'; 
            crRatingEl.addClass('encounter-deadly'); 
        }
        else if (totalCR > crThreshold * 0.75 || highestCR > singleMonsterThreshold * 0.75) { 
            crRating = 'Hard'; 
            crRatingEl.addClass('encounter-hard'); 
        }
        else if (totalCR > crThreshold * 0.5 || highestCR > singleMonsterThreshold * 0.5) { 
            crRating = 'Medium'; 
            crRatingEl.addClass('encounter-medium'); 
        }
        else { 
            crRatingEl.addClass('encounter-easy'); 
        }
        
        crRatingEl.textContent = `Lazy DM CR Rating: ${crRating}`; 
        crRatingEl.style.fontWeight = 'bold'; 
        crRatingEl.style.marginTop = '0.5em';
    }

    /**
     * Show the encounter creation modal
     */
    showEncounterModal(editor) { 
        new EncounterModal(this.app, editor, this).open(); 
    }
    
    /**
     * Look up creature stats from vault files
     * @param {string} creatureName - Name of the creature to look up
     * @returns {Promise<Object|null>} - CR and XP values, or null if not found
     */
    async lookupCreatureStats(creatureName) {
        if (!creatureName) return null;
        console.log(`EB: Looking up stats for: ${creatureName}`);
        try {
            const files = this.app.vault.getMarkdownFiles();
            const lowerCaseName = creatureName.toLowerCase().trim();
            
            // Search in configured locations with prioritization
            let possibleFiles = [];
            
            // Extract non-empty locations from settings
            const locations = [
                this.settings.monsterLocation1,
                this.settings.monsterLocation2,
                this.settings.monsterLocation3
            ].filter(loc => loc && loc.trim() !== '');
            
            // Collect all possible files, exact matches first
            if (locations.length > 0) {
                // Add exact matches from configured locations
                possibleFiles.push(...files.filter(file => {
                    const basename = file.basename.toLowerCase();
                    if (basename !== lowerCaseName) return false;
                    return locations.some(location => file.path.includes(location));
                }));
                
                // Add partial matches from configured locations
                if (possibleFiles.length === 0) {
                    for (const location of locations) {
                        if (!location || location.trim() === '') continue;
                        
                        const matches = files.filter(file => 
                            file.basename.toLowerCase().includes(lowerCaseName) && 
                            file.path.includes(location)
                        );
                        
                        possibleFiles.push(...matches);
                        if (possibleFiles.length > 0) break;
                    }
                }
            }
            
            // Final fallback to entire vault if enabled in settings
            if (possibleFiles.length === 0 && this.settings.searchAllVault) {
                possibleFiles.push(...files.filter(file => 
                    file.basename.toLowerCase().includes(lowerCaseName)
                ));
            }
            
            if (possibleFiles.length === 0) { 
                console.log(`EB: Creature file not found: ${creatureName}`); 
                new obsidian.Notice(`Creature not found: ${creatureName}`); 
                return null; 
            }
            
            // If we have multiple files, prioritize those with stat blocks
            // and show a selection modal if needed
            let creatureFile = null;
            
            if (possibleFiles.length > 1) {
                console.log(`EB: Found ${possibleFiles.length} possible files for ${creatureName}`);
                
                // Define common stat block markers to look for
                const statBlockMarkers = [
                    "**AC**", 
                    "**HP**", 
                    "**CR**",
                    "{{stats",
                    "{{vitals",
                    "Challenge Rating",
                    "hit points"
                ];
                
                // Filter files that contain stat block markers
                const statBlockFiles = [];
                
                for (const file of possibleFiles) {
                    const content = await this.app.vault.read(file);
                    
                    // Check if content has any of the stat block markers
                    const hasStatBlock = statBlockMarkers.some(marker => 
                        content.includes(marker)
                    );
                    
                    if (hasStatBlock) {
                        console.log(`EB: Found stat block in file: ${file.path}`);
                        statBlockFiles.push(file);
                    }
                }
                
                if (statBlockFiles.length === 1) {
                    // If exactly one file has stat block markers, use it
                    creatureFile = statBlockFiles[0];
                    console.log(`EB: Using file with stat block: ${creatureFile.path}`);
                } else if (statBlockFiles.length > 1) {
                    // If multiple files have stat block markers, show selection modal
                    return new Promise((resolve) => {
                        new MonsterSelectModal(
                            this.app,
                            this, 
                            statBlockFiles,
                            async (file) => {
                                resolve(await this.processCreatureFile(file));
                            }
                        ).open();
                    });
                } else {
                    // If no files with stat block markers, show selection modal with all files
                    return new Promise((resolve) => {
                        new MonsterSelectModal(
                            this.app,
                            this, 
                            possibleFiles,
                            async (file) => {
                                resolve(await this.processCreatureFile(file));
                            }
                        ).open();
                    });
                }
            } else {
                // If only one file found, use it
                creatureFile = possibleFiles[0];
            }
            
            return await this.processCreatureFile(creatureFile);
        } catch (error) { 
            console.error(`EB: Error looking up ${creatureName}:`, error); 
            new obsidian.Notice(`Error looking up stats for: ${creatureName}`); 
            return null; 
        }
    }

    /**
     * Process a creature file to extract stats
     * @param {Object} creatureFile - The Obsidian file object to process
     * @returns {Promise<Object|null>} - CR and XP values, or null if parsing failed
     */
    async processCreatureFile(creatureFile) {
        console.log(`EB: Processing file: ${creatureFile.path}`);
        const content = await this.app.vault.read(creatureFile);
        const stats = this.parseCreatureStats(content, creatureFile.basename, creatureFile.path);
        
        // Include source information in the return value
        let source = "Custom";
        if (creatureFile.path.includes('2024_z_compendium')) {
            source = '2024';
        } else if (creatureFile.path.includes('z_compendium')) {
            source = 'Classic';
        }
        
        if (stats) {
            stats.source = source;
            return stats;
        } else {
            // If parsing failed, prompt for manual entry
            return new Promise((resolve) => {
                new ManualStatEntryModal(
                    this.app,
                    this,
                    creatureFile.basename,
                    (stats) => {
                        resolve(stats);
                    }
                ).open();
            });
        }
    }

    /**
     * Parse creature stats from file content
     * @param {string} content - The file content to parse
     * @param {string} creatureName - Name of the creature
     * @param {string} creatureFilePath - Path to the creature file
     * @returns {Object|null} - CR and XP values, or null if parsing failed
     */
    parseCreatureStats(content, creatureName = "Unknown", creatureFilePath = null) {
        // Standard D&D 2024 CR-to-XP lookup
        const CR_TO_XP_2024 = { 
            '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, 
            '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, 
            '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, 
            '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, 
            '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, 
            '29': 135000, '30': 155000  
        };

        try {
            // Method 1: Look for standard "Challenge: CR (XP XP)" line first
            const challengeRegex = /(?:(?:\*\*|__)Challenge(?:\*\*|__)|Challenge)\s*(?::?)\s*([0-9\/]+)\s*\(([0-9,]+)\s*XP\)/i;
            let match = content.match(challengeRegex);
            if (match && match[1] && match[2]) {
                const cr = match[1].trim();
                const xp = parseInt(match[2].replace(/,/g, ''), 10);
                if (cr && !isNaN(xp)) { 
                    console.log(`EB: Parsed stats for ${creatureName} via Challenge Line: CR=${cr}, XP=${xp}`); 
                    return { cr: cr, xp: xp }; 
                }
            }
            
            // Method 2: Look for 2024 format with CR in stats section
            // Improved regex that handles variable whitespace better
            const cr2024Regex = /\*\*CR\*\*[\s:]*::[\s:]*([0-9\/]+)/i;
            match = content.match(cr2024Regex);
            if (match && match[1]) {
                const cr = match[1].trim();
                // In 2024 format, XP is not typically listed, so look it up
                const xp = CR_TO_XP_2024[cr] || null;
                if (xp !== null) {
                    console.log(`EB: Parsed CR for ${creatureName} via 2024 format, looked up XP: CR=${cr}, XP=${xp}`);
                    return { cr: cr, xp: xp };
                }
            }

            // If that fails, try an even more lenient regex that just looks for CR near a number
            if (!match) {
                const fallbackCrRegex = /\*\*CR\*\*.*?([0-9\/]+)/i;
                match = content.match(fallbackCrRegex);
                if (match && match[1]) {
                    const cr = match[1].trim();
                    const xp = CR_TO_XP_2024[cr] || null;
                    if (xp !== null) {
                        console.log(`EB: Parsed CR for ${creatureName} via fallback regex, looked up XP: CR=${cr}, XP=${xp}`);
                        return { cr: cr, xp: xp };
                    }
                }
            }

            // Method 3: Look in YAML Frontmatter using Obsidian's parser (for classic monsters)
            // Only attempt this if we have a valid file path
            if (creatureFilePath) {
                // Get the file by path instead of relying on active file
                const file = this.app.vault.getAbstractFileByPath(creatureFilePath);
                if (file && file.path) {
                    const fileCache = this.app.metadataCache.getFileCache(file);
                    if (fileCache && fileCache.frontmatter) {
                        const frontmatter = fileCache.frontmatter;
                        let crFromYaml = frontmatter.cr !== undefined ? String(frontmatter.cr).trim() : null;
                        let xpFromYaml = frontmatter.xp !== undefined && !isNaN(parseInt(String(frontmatter.xp).replace(/,/g, ''), 10))
                            ? parseInt(String(frontmatter.xp).replace(/,/g, ''), 10)
                            : null;

                        if (crFromYaml) {
                            // If XP wasn't found in YAML, try looking it up from CR
                            if (xpFromYaml === null) {
                                xpFromYaml = CR_TO_XP_2024[crFromYaml] || null;
                                if (xpFromYaml !== null) { 
                                    console.log(`EB: Parsed CR for ${creatureName} via YAML, looked up 2024 XP: CR=${crFromYaml}, XP=${xpFromYaml}`); 
                                } else { 
                                    console.warn(`EB: Parsed CR ('${crFromYaml}') for ${creatureName} via YAML, but couldn't lookup XP.`); 
                                }
                            } else {
                                console.log(`EB: Parsed stats for ${creatureName} via YAML: CR=${crFromYaml}, XP=${xpFromYaml}`);
                            }
                            
                            // Return if we have CR and a valid XP number
                            if (xpFromYaml !== null && !isNaN(xpFromYaml)) {
                                return { cr: crFromYaml, xp: xpFromYaml };
                            }
                        }
                    }
                }
            }

            // Fallback: Try basic regex for YAML frontmatter
            const frontmatterRegex = /^---\s*([\s\S]*?)\s*---/;
            match = content.match(frontmatterRegex);
            if (match && match[1]) {
                const yamlText = match[1];
                const crMatch = yamlText.match(/^cr:\s*['"]?([0-9\/]+)['"]?/im);
                const xpMatch = yamlText.match(/^xp:\s*['"]?([0-9,]+)['"]?/im);
                const crFromYaml = crMatch ? crMatch[1].trim() : null;
                let xpFromYaml = xpMatch ? parseInt(xpMatch[1].replace(/,/g, ''), 10) : null;

                if (crFromYaml) {
                    if (xpFromYaml === null || isNaN(xpFromYaml)) {
                        xpFromYaml = CR_TO_XP_2024[crFromYaml] || null;
                    }
                    
                    if (xpFromYaml !== null && !isNaN(xpFromYaml)) {
                        return { cr: crFromYaml, xp: xpFromYaml };
                    }
                }
            }

            // If no CR was found by any method, check if we're dealing with a summon/spell
            if (content.includes("{{monster") && content.includes("spell's level")) {
                // This is likely a summon or spell effect (like your Aberrant Spirit example)
                console.log(`EB: ${creatureName} appears to be a summon or spell effect with variable CR`);
                return { cr: "Varies", xp: 0 };
            }

            console.warn(`EB: Could not find/parse CR/XP for ${creatureName}. Check note format.`);
            return null;
        } catch (error) { 
            console.error(`EB: Error parsing creature stats for ${creatureName}:`, error); 
            return null; 
        }
    }
}

module.exports = EncounterBuilderPlugin;