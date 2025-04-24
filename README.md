
### 5. Use Rendered Features (Reading View)

1.  Switch to Obsidian's Reading View.
2.  The `encounter` block will render as a formatted table.
3.  Below the table (or near the calculator inputs), you'll find several controls:
    *   **Difficulty Calculator:**
        *   Enter the **Party Size** and **Average Level**.
        *   Click **"Calculate Difficulty"**.
        *   Results appear, showing **DMG 2024 XP Difficulty** and **Lazy DM CR Benchmark** ratings.
    *   **Edit Encounter Button:**
        *   Click this button to modify the encounter defined in *this specific code block*.
        *   The Encounter Modal opens, pre-filled with the creatures from the table.
        *   Add, remove, or edit creatures as needed.
        *   Click **"Save Changes"**. The plugin will attempt to update the original code block directly in your note.
        (Note: If the note context has changed significantly, it might insert the updated block at the cursor instead).
    *   **Export Statblocks Button:**
        *   Click this button to generate a summary note for the creatures in *this specific code block*.
        *   The plugin finds the unique creatures listed.
        *   It searches your vault for the corresponding monster files.
        *   It reads the content of each found file, **removing the YAML frontmatter**.
        *   It creates a **new note** (e.g., `Statblocks - [Your Note Name].md`) containing the extracted statblocks, separated by headers and horizontal rules.
        *   A notice confirms creation and indicates if any statblocks couldn't be found.
        *   The new note is usually opened automatically in a new tab.

---

## Configuration

Access the plugin settings via **Settings** > **Community Plugins** > **D&D 2024 Encounter Builder**.

*   **Primary Monster Location:** The main folder path within your vault where monster stat blocks are stored (e.g., `Compendiums/2024/Bestiary`). This location is searched first.
*   **Secondary Monster Location:** A second folder path searched if the monster isn't found in the primary location (e.g., `Compendiums/5e/Bestiary`).
*   **Custom Monster Location:** A third folder path, often used for homebrew creatures (e.g., `Campaigns/MyCampaign/Monsters`).
*   **Search All Vault if Not Found:** If enabled, the entire vault will be searched if the monster isn't found in the specified locations. (Default: `true`)
*   *(Encounter Multipliers setting removed as per latest code)*

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

*   **Monster Not Found (in Modal or Export):**
    *   Double-check the creature name spelling (including case if relevant to file names).
    *   Ensure the monster's file exists within one of the locations specified in the plugin settings (or that "Search All Vault" is enabled).
    *   Verify the monster file name matches the creature name you're typing/using.
    *   Check that the monster note contains CR/XP info in a compatible format (see above) if using lookup features.
*   **Incorrect Difficulty Calculation:**
    *   Ensure the `encounter` code block table has the correct columns: Qty, Creature, CR, XP, Total XP.
    *   Verify the XP values *in the table* are correct. The calculator parses directly from the rendered table source.
*   **Edit Encounter Fails to Update In-Place:**
    *   This can happen if you edit the note significantly *outside* the code block between rendering and clicking Edit, or if the file was moved or renamed. The plugin inserts the updated block at the cursor as a fallback.
*   **Export Statblocks Missing Creatures:**
    *   Check the "Monster Not Found" steps above for the specific missing creature(s). The export uses the same file-finding logic.

---

## Contributing

Contributions, issues, and feature requests are welcome! Please feel free to open an issue or submit a pull request on the GitHub repository.

---

## License

This plugin is released under the [MIT License](LICENSE).

---

## Acknowledgements

*   Significant assistance from AI coding partners (Claude AI, Google AI Studio).
*   Inspired by the need for streamlined encounter building in Obsidian.
*   Utilizes encounter balancing concepts from the Dungeons & Dragons 2024 Dungeon Master's Guide.
*   Incorporates benchmark ideas popularized by Sly Flourish's Return of the Lazy Dungeon Master.
