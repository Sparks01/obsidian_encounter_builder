# Obsidian D&D 2024 Encounter Builder



**Build b D&D encounters directly within Obsidian, tailored for the 2024 ruleset!**

This plugin helps Dungeon Masters streamline the encounter creation process by providing:

*   A user-friendly modal for adding monsters.
*   Automatic monster CR/XP lookup from your Obsidian vault.
*   Calculation of total encounter XP.
*   Generation of a clean markdown table for your encounter.
*   An integrated difficulty calculator in reading view based on DMG 2024 XP budgets and Lazy DM CR benchmarks.

---

## Features

*   **Encounter Creation Modal:** Easily add creatures with quantity, name, CR, and XP.
*   **Vault-Powered Monster Lookup:** Autocomplete suggests monsters as you type, searching configurable locations in your vault.
*   **Automatic Stat Parsing:** Looks up CR and XP by parsing creature stat block files (supports multiple common formats, including 2024 style and YAML frontmatter).
    *   Prompts for selection if multiple matching files are found.
    *   Prompts for manual entry if parsing fails.
*   **Quick Add:** Buttons for adding common low-level monsters (e.g., Goblin, Zombie, Orc) with 2024 stats.
*   **Dynamic List:** View, edit, or remove creatures from your encounter list within the modal before finalizing.
*   **Markdown Table Generation:** Creates a ` ```encounter ``` ` code block containing a formatted markdown table with creature details, totals, and automatic `[[wikilinks]]` for creature names.
*   **Rendered Difficulty Calculator:** When viewing the note, the `encounter` block renders as a table with an interactive section below:
    *   Input Party Size and Average Level.
    *   Calculates difficulty based on **DMG 2024 XP Thresholds** (Low, Moderate, High, Out of Bounds), optionally applying official encounter multipliers.
    *   Calculates difficulty based on **Lazy DM CR Benchmarks** (comparing total CR and highest CR to party level).
*   **Configurable Settings:** Define preferred monster locations in your vault and toggle encounter multipliers.

---

## Installation

### Manual Installation

1.  Download the latest `main.js`, `manifest.json`, and `styles.css` files from the [Releases page](https://github.com/Sparks01/obsidian_encounter_builder/releases/latest) of this repository.
2.  Navigate to your Obsidian vault's plugins folder: `VaultFolder/.obsidian/plugins/`.
3.  Create a new folder named `dnd-2024-encounter-builder` (or similar).
4.  Place the downloaded `main.js`, `manifest.json`, and `styles.css` files into this new folder.
5.  Restart Obsidian or reload plugins.
6.  Enable the "D&D 2024 Encounter Builder" plugin in **Settings** > **Community Plugins**.

---

## Usage

### 1. Create an Encounter

1.  Open the command palette (`Ctrl/Cmd+P`).
2.  Search for and select the command: **"Encounter Builder: Create Encounter Table"**.
3.  The "Create Encounter" modal will appear.

### 2. Add Creatures

*   **Quantity:** Enter the number of this creature type.
*   **Creature Name:** Start typing the creature's name.
    *   An autocomplete dropdown will appear, suggesting matching monster files from your configured vault locations. Prioritizes 2024 sources if found.
    *   Select a suggestion with mouse/arrow keys + Enter, or type the full name.
*   **Lookup CR/XP:** Click this button (or press Enter in the Creature Name field) to attempt parsing CR/XP from the corresponding monster file.
    *   If successful, the CR and XP fields will populate.
    *   If multiple files match, a selection modal will appear.
    *   If parsing fails, a manual entry modal will appear.
*   **CR / XP:** These fields can be manually entered or edited if lookup doesn't work or needs correction.
*   **Add Creature to List:** Click this button (or press Enter in the XP field) to add the creature with its details to the list below.
*   **Quick Add Buttons:** Click buttons for common monsters to quickly populate the Name, CR, and XP fields. Adjust Quantity and click "Add Creature to List".

### 3. Manage the List

*   Added creatures appear in a table within the modal.
*   **Edit:** Click the "Edit" button next to a creature to load its details back into the form for modification. Click "Update Creature" to save changes.
*   **Remove:** Click the "Remove" button to delete a creature from the list.
*   The table footer shows the **Grand Total XP** (unadjusted) for the current list.

### 4. Generate the Table

*   Once your creature list is complete, click the **"Create Encounter Table"** button.
*   The modal will close, and a markdown code block like the following will be inserted at your cursor position:


```encounter
| Qty | Creature        | CR   | XP    | Total XP |
|:----|:----------------|:-----|------:|---------:|
| 2   | [[Goblin]]      | 1/4  | 75    | 150      |
| 1   | [[Bugbear]]     | 1    | 200   | 200      |
| **Total** |             |      |       | **350**  |
```

### 5. Use the Difficulty Calculator (Reading View)

1.  Switch to Obsidian's Reading View.
2.  The `encounter` block will render as a formatted table.
3.  Below the table, you'll find the **Difficulty Calculator**:
    *   Enter the **Party Size** (number of characters).
    *   Enter the **Average Level** of the party characters.
    *   Click **"Calculate Difficulty"**.
4.  The results section will appear, showing:
    *   **DMG 2024 Difficulty:** Based on XP thresholds for the party's level. It shows the encounter's Adjusted XP (if multipliers are enabled) compared to Low, Moderate, High, and Out of Bounds thresholds.
    *   **Lazy DM Benchmark:** Based on CR comparisons. It shows the sum of monster CRs and the highest single monster CR compared to party level-based benchmarks, providing a rating (Easy, Medium, Hard, Potentially Deadly).

---

## Configuration

Access the plugin settings via **Settings** > **Community Plugins** > **D&D 2024 Encounter Builder**.

*   **Primary Monster Location:** The main folder path within your vault where monster stat blocks are stored (e.g., `Compendiums/2024/Bestiary`). This location is searched first.
*   **Secondary Monster Location:** A second folder path searched if the monster isn't found in the primary location (e.g., `Compendiums/5e/Bestiary`).
*   **Custom Monster Location:** A third folder path, often used for homebrew creatures (e.g., `Campaigns/MyCampaign/Monsters`).
*   **Search All Vault if Not Found:** If enabled, the entire vault will be searched if the monster isn't found in the specified locations. (Default: `true`)
*   **Use Encounter Multipliers:** If enabled, applies the official DMG 2024 XP multipliers based on the number of monsters when calculating difficulty. (Default: `true`)

---

## Monster Stat Block Format Compatibility

The plugin attempts to parse CR and XP from your monster notes using these methods in order:

1.  **Challenge Line:** Looks for `Challenge CR (XP XP)` or `**Challenge** CR (XP XP)`. Example: `Challenge 5 (1,800 XP)`
2.  **2024 CR Format:** Looks for `**CR** :: CR` or `**CR** CR`. XP is then looked up using the standard 2024 CR-to-XP conversion table. Example: `**CR** :: 3`
3.  **YAML Frontmatter (Obsidian API):** Reads `cr:` and `xp:` fields from the frontmatter.
4.  **YAML Frontmatter (Regex Fallback):** Basic search for `cr:` and `xp:` at the start of lines within `--- ... ---` blocks.
5.  **Summon/Spell:** Recognizes patterns indicating variable CR (e.g., based on spell level) and assigns CR "Varies", XP 0.

*Ensure your monster notes contain CR and XP information in one of these formats for the automatic lookup to work reliably.*

---

## Troubleshooting

*   **Monster Not Found:**
    *   Double-check the creature name spelling.
    *   Ensure the monster's file exists within one of the locations specified in the plugin settings (or that "Search All Vault" is enabled).
    *   Verify the monster file name matches the creature name you're typing.
    *   Check that the monster note contains CR/XP info in a compatible format (see above).
*   **Incorrect Difficulty Calculation:**
    *   Ensure the `encounter` code block table has the correct columns: Qty, Creature, CR, XP, Total XP.
    *   Verify the XP values in the table are correct. The calculator parses *from the table*, not the original files.

---

## Contributing

Contributions, issues, and feature requests are welcome! Please feel free to open an issue or submit a pull request.

---

## License

This plugin is released under the [MIT License](LICENSE).

---

## Acknowledgements

*   98% Vibe Coding with Claude AI and Google AI Studio
*   Inspired by the need for streamlined encounter building in Obsidian.
*   Utilizes encounter balancing concepts from the Dungeons & Dragons 2024 Dungeon Master's Guide.
*   Incorporates benchmark ideas popularized by Sly Flourish's Return of the Lazy Dungeon Master.
