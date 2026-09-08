"""Protection et formatage des fichiers d'un apply_patch Codex."""
import json
from pathlib import Path
import subprocess
import sys


def paths_from_event(event):
    command = event.get("tool_input", {}).get("command")
    if not isinstance(command, str) or not command.startswith("*** Begin Patch"):
        raise ValueError("Entrée apply_patch non reconnue")
    cwd = Path(event["cwd"])
    paths = []
    for line in command.splitlines():
        for prefix in ("*** Add File: ", "*** Update File: ", "*** Delete File: ", "*** Move to: "):
            if line.startswith(prefix):
                path = Path(line[len(prefix):].replace("\\", "/"))
                path = path if path.is_absolute() else cwd / path
                # Conserver aussi le chemin lexical pour les liens symboliques.
                paths.extend((path, path.resolve()))
    if not paths:
        raise ValueError("Aucun fichier identifié dans apply_patch")
    return list(dict.fromkeys(paths))


def protected(path):
    parts = path.parts
    return (any(part.startswith(".env") for part in parts)
            or ".git" in parts
            or any(parts[i:i + 2] == ("prisma", "migrations") for i in range(len(parts) - 1)))


def main():
    mode = sys.argv[1]
    try:
        event = json.load(sys.stdin)
        paths = paths_from_event(event)
    except (ValueError, KeyError, TypeError) as error:
        print(f"Hook Codex : {error}", file=sys.stderr)
        return 2
    if mode == "protect":
        for path in paths:
            if protected(path):
                print(f"Bloqué : {path}. Fichier protégé (.env, .git ou migrations). "
                      "Créer une nouvelle migration via l'outillage du projet ; "
                      "laisser l'utilisateur modifier les secrets.", file=sys.stderr)
                return 2
        return 0
    if mode != "format":
        raise ValueError("Mode inconnu")
    root = Path(__file__).resolve().parents[2]
    files = []
    for path in paths:
        path = path.resolve()
        if not path.is_relative_to(root) or not path.is_file() or protected(path):
            continue
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".md"}:
            continue
        relative = str(path.relative_to(root))
        if relative not in files:
            files.append(relative)
    if not files:
        return 0
    result = subprocess.run([str(root / "scripts/node-run.sh"), ".", "npx", "--no", "--",
                             "prettier", "--write", "--", *files], cwd=root,
                            capture_output=True, text=True)
    if result.returncode:
        print("Formatage automatique indisponible ; relancer Prettier via "
              "scripts/node-run.sh avant make check.\n" + result.stderr, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
