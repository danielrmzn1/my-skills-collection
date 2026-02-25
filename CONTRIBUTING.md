# Contributing a New Skill

## Steps

1. Create a new folder under `skills/` with a descriptive kebab-case name:
   ```
   skills/my-new-skill/
   ```

2. Add a `SKILL.md` file with YAML frontmatter:
   ```markdown
   ---
   name: my-new-skill
   description: Short description of what this skill does.
   license: MIT
   ---

   # My New Skill

   Detailed instructions for the agent...
   ```

3. Optionally add:
   - `README.md` — human-readable docs
   - `references/` — supporting materials
   - `scripts/` — helper scripts
   - `examples/` — usage examples

4. Update the **Available Skills** table in the root `README.md`.

5. Commit and push.
