"""
Test-konfiguration för lokal utveckling
Skapa en testmapp med dummy-filer för att testa systemet
"""

import os
from pathlib import Path
import json

def create_test_structure():
    """Skapar en test-filstruktur för lokal utveckling"""
    
    base_path = Path(r"C:\TestData\System_Releases")
    
    # Skapa basstruktur
    test_version = base_path / "Produkter.03_1.0.1.3"
    test_webview = test_version / "support" / "slwebview_files"
    test_webview.mkdir(parents=True, exist_ok=True)
    
    print(f"Skapar teststruktur i: {test_webview}")
    
    # Skapa test PS200 root-filer
    create_test_svg(test_webview / "PS200_d.svg", [
        {"id": "PS200:23345", "name": "Block_23345"}
    ])
    
    create_test_json(test_webview / "PS200_d.json", [
        {
            "icon": "SubSystemIcon_icon",
            "id": "PS200:23345",
            "name": "PS200_23345"
        }
    ])
    
    # Skapa test barn-filer
    create_test_svg(test_webview / "PS200_23345.svg", [
        {"id": "PS200:67890", "name": "Block_67890"}
    ])
    
    create_test_json(test_webview / "PS200_23345.json", [
        {
            "icon": "SubSystemIcon_icon",
            "id": "PS200:67890",
            "name": "PS200_67890"
        }
    ])
    
    # Sista nivån (leaf node)
    create_test_svg(test_webview / "PS200_67890.svg", [])
    create_test_json(test_webview / "PS200_67890.json", [])
    
    print("✅ Teststruktur skapad!")
    print(f"\nUppdatera backend/app.py:")
    print(f"NETWORK_PATH = r'{base_path}'")


def create_test_svg(filepath: Path, elements: list):
    """Skapar en enkel test-SVG"""
    svg_content = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#f0f0f0"/>
  <text x="400" y="50" text-anchor="middle" font-size="24" fill="#333">
    Test SVG: {filename}
  </text>
'''.format(filename=filepath.name)
    
    # Lägg till klickbara element
    y_pos = 100
    for elem in elements:
        svg_content += f'''
  <g id="{elem['id']}">
    <rect x="300" y="{y_pos}" width="200" height="80" fill="#2563eb" stroke="#1d4ed8" stroke-width="2"/>
    <text x="400" y="{y_pos + 45}" text-anchor="middle" font-size="16" fill="white">
      {elem['name']}
    </text>
  </g>
'''
        y_pos += 120
    
    svg_content += '</svg>'
    
    filepath.write_text(svg_content, encoding='utf-8')
    print(f"  ✓ {filepath.name}")


def create_test_json(filepath: Path, subsystems: list):
    """Skapar en enkel test-JSON"""
    json_data = {
        "version": "1.0",
        "type": "simulink_diagram",
        "categories": subsystems
    }
    
    filepath.write_text(json.dumps(json_data, indent=2), encoding='utf-8')
    print(f"  ✓ {filepath.name}")


if __name__ == '__main__':
    print("=" * 60)
    print("Simulink WebView Navigator - Test Setup")
    print("=" * 60)
    print()
    
    response = input("Vill du skapa teststruktur? (ja/nej): ")
    if response.lower() in ['ja', 'j', 'yes', 'y']:
        create_test_structure()
    else:
        print("Avbruten.")
