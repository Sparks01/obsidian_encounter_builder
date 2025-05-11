
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
