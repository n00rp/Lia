"""
Flask backend för Simulink WebView Navigation System
Hanterar filskanning, trädbygge och API-endpoints
"""

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import os
from pathlib import Path
import json
import re
from typing import Dict, List, Tuple

app = Flask(__name__)
CORS(app)

# Konfigurera nätverksmappen
NETWORK_PATH = r"\\network\System_Releases"  # Ändra till din faktiska nätverkssökväg
# För lokal testning, kan du använda en lokal sökväg:
# NETWORK_PATH = r"C:\TestData\System_Releases"


class SimulinkFileScanner:
    """Skannar och organiserar Simulink WebView-filer"""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.versions = {}
        self.products = {}
        self.tree_cache = {}  # Cache för färdigbyggda träd
        
    def scan_versions(self) -> Dict:
        """
        Skannar alla versioner och hittar tillgängliga produkter
        Returnerar: {version: {products: [...]}}
        """
        if not self.base_path.exists():
            return {"error": f"Sökvägen finns inte: {self.base_path}"}
        
        versions = {}
        
        # Hitta alla versionskataloger (matchar olika mönster)
        for item in self.base_path.iterdir():
            if item.is_dir():
                # Matcha mönster som: Produkter.XX_X.X.X.X eller liknande
                match = re.match(r'.*?(\d+[_.]\d+\.\d+\.\d+\.\d+)', item.name)
                if match:
                    version = match.group(1)
                    # Sökväg: [Version]/support/slwebview_files
                    webview_path = item / "support" / "slwebview_files"
                    
                    if webview_path.exists():
                        products = self._find_root_products(webview_path)
                        versions[version] = {
                            "path": str(webview_path),
                            "products": products
                        }
        
        self.versions = versions
        return versions
    
    def _find_root_products(self, webview_path: Path) -> List[Dict]:
        """
        Hittar alla root-produkter (filer som slutar på _d.svg)
        Dessa är alltid entry-points för navigation
        """
        products = []
        
        # Hitta alla _d.svg filer (root-filer)
        root_svg_files = list(webview_path.glob("*_d.svg"))
        
        for svg_file in root_svg_files:
            # Extrahera produktnamn (ta bort _d.svg)
            product_name = svg_file.stem[:-2]  # Tar bort "_d" från namnet
            json_file = svg_file.with_name(f"{svg_file.stem}.json")
            
            product = {
                "name": product_name,
                "svg_file": svg_file.name,
                "json_file": json_file.name if json_file.exists() else None,
                "svg_path": str(svg_file.relative_to(webview_path)),
                "json_path": str(json_file.relative_to(webview_path)) if json_file.exists() else None
            }
            
            products.append(product)
        
        return products
    
    def build_tree_from_root(self, version: str, product_name: str, use_cache: bool = True) -> Dict:
        """
        Bygger navigeringsträd dynamiskt från root-produkten
        genom att följa .slx-referenser i JSON-filerna
        
        Args:
            version: Versionsnummer
            product_name: Produktnamn
            use_cache: Om True, använd cache om tillgänglig
        """
        # Kolla cache först
        cache_key = f"{version}:{product_name}"
        if use_cache and cache_key in self.tree_cache:
            print(f"📦 Använder cached träd för {product_name}")
            return self.tree_cache[cache_key]
        
        if version not in self.versions:
            return {"error": "Version inte hittad"}
        
        webview_path = Path(self.versions[version]["path"])
        root_svg = webview_path / f"{product_name}_d.svg"
        root_json = webview_path / f"{product_name}_d.json"
        
        if not root_svg.exists():
            return {"error": f"Root-fil hittades inte: {product_name}_d.svg"}
        
        print(f"🔨 Bygger träd för {product_name}...")
        # Bygg träd rekursivt
        tree = self._build_tree_node(webview_path, product_name, root_json, level=0)
        
        # Spara i cache
        self.tree_cache[cache_key] = tree
        print(f"✅ Träd cachat för {product_name}")
        
        return tree
    
    def _build_tree_node(self, webview_path: Path, name: str, json_path: Path, level: int) -> Dict:
        """
        Bygger en nod i trädet rekursivt genom att läsa JSON-metadata
        """
        # Root-filer har _d suffix, barn-filer har inte
        is_root = level == 0
        svg_filename = f"{name}_d.svg" if is_root else f"{name}.svg"
        json_filename = f"{name}_d.json" if is_root else f"{name}.json"
        
        node = {
            "name": name,
            "svg": svg_filename,
            "json": json_filename,
            "svg_path": str((webview_path / svg_filename).relative_to(webview_path)),
            "json_path": str(json_path.relative_to(webview_path)) if json_path.exists() else None,
            "children": [],
            "level": level,
            "is_root": is_root
        }
        
        # Läs JSON för att hitta barn (slx-referenser)
        if json_path.exists():
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                
                node["metadata"] = metadata
                
                # Hitta alla SubSystemIcon_icon-element i JSON
                subsystems = self._extract_subsystem_icons(metadata)
                
                # Spara mappningsinformation för SVG-klick
                node["clickable_elements"] = subsystems
                
                # För varje subsystem, bygg barn-nod
                for subsystem in subsystems:
                    child_name = subsystem['name']
                    child_json = webview_path / f"{child_name}.json"
                    child_svg = webview_path / f"{child_name}.svg"
                    
                    # Kontrollera att barn-filen existerar
                    if child_svg.exists():
                        child_node = self._build_tree_node(webview_path, child_name, child_json, level + 1)
                        child_node["svg_element_id"] = subsystem['id']
                        child_node["subsystem_metadata"] = subsystem
                        node["children"].append(child_node)
                
            except Exception as e:
                node["error"] = str(e)
        
        return node
    
    def _extract_subsystem_icons(self, metadata: Dict) -> List[Dict]:
        """
        Extraherar alla element med icon="SubSystemIcon_icon" från JSON-metadata
        Returnerar lista med {id, name, metadata} för mappning mellan SVG och filer
        """
        subsystems = []
        
        # Rekursiv sökning efter SubSystemIcon_icon i JSON-strukturen
        def search_dict(obj, parent_key=None):
            if isinstance(obj, dict):
                # Kolla om detta objekt har icon="SubSystemIcon_icon"
                if obj.get('icon') == 'SubSystemIcon_icon':
                    # Extrahera ID (för SVG-mappning)
                    element_id = obj.get('id', '')
                    
                    # Extrahera filnamn - kan vara i olika nycklar
                    file_ref = None
                    for key in ['name', 'file', 'link', 'target', 'blockName', 'label', 'text']:
                        if key in obj and obj[key]:
                            file_ref = obj[key]
                            break
                    
                    # Om vi inte hittade filnamn, försök använda ID
                    if not file_ref and element_id:
                        # ID kan vara på format "PS200:23345" - ta sista delen
                        file_ref = element_id.split(':')[-1] if ':' in element_id else element_id
                    
                    # Debug: Logga om vi inte hittar filnamn
                    if not file_ref:
                        print(f"⚠️  SubSystemIcon utan filnamn: {obj}")
                    
                    if file_ref:
                        # Ta bort eventuell .svg eller annan extension
                        file_ref = file_ref.replace('.svg', '').replace('.json', '')
                        
                        subsystems.append({
                            'id': element_id,              # SVG-element ID
                            'name': file_ref,              # Filnamn att öppna
                            'metadata': obj,               # Full metadata
                            'position': obj.get('position', {}),
                            'bounds': obj.get('bounds', {})
                        })
                
                # Fortsätt söka i alla nycklar
                for key, value in obj.items():
                    search_dict(value, key)
                    
            elif isinstance(obj, list):
                for item in obj:
                    search_dict(item, parent_key)
        
        search_dict(metadata)
        return subsystems
    
    def get_file_content(self, version: str, relative_path: str, file_type: str = 'svg') -> Tuple[bool, any]:
        """
        Hämtar innehållet i en fil (SVG eller JSON)
        Returnerar: (success, content/error)
        """
        if version not in self.versions:
            return False, "Version inte hittad"
        
        webview_path = Path(self.versions[version]["path"])
        file_path = webview_path / relative_path
        
        if not file_path.exists():
            return False, f"Fil inte hittad: {relative_path}"
        
        try:
            if file_type == 'json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                return True, content
            else:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return True, content
        except Exception as e:
            return False, str(e)


# Global scanner-instans
scanner = SimulinkFileScanner(NETWORK_PATH)


@app.route('/api/versions')
def get_versions():
    """
    Returnerar lista över tillgängliga versioner med deras produkter
    """
    versions = scanner.scan_versions()
    
    if "error" in versions:
        return jsonify(versions), 500
    
    # Formatera data för frontend
    result = []
    for version, data in versions.items():
        result.append({
            "version": version,
            "version_display": version.replace('_', '.'),
            "products": data["products"],
            "product_count": len(data["products"])
        })
    
    return jsonify({
        "versions": result,
        "count": len(result)
    })


@app.route('/api/version/<version>/products')
def get_version_products(version: str):
    """
    Returnerar tillgängliga produkter för en specifik version
    """
    if version not in scanner.versions:
        scanner.scan_versions()
    
    if version in scanner.versions:
        return jsonify({
            "version": version,
            "products": scanner.versions[version]["products"]
        })
    else:
        return jsonify({"error": "Version inte hittad"}), 404


@app.route('/api/version/<version>/product/<product_name>/tree')
def get_product_tree(version: str, product_name: str):
    """
    Bygger och returnerar navigeringsträdet för en specifik produkt
    Trädet byggs dynamiskt från root-filen genom att följa .slx-referenser
    """
    if version not in scanner.versions:
        scanner.scan_versions()
    
    tree = scanner.build_tree_from_root(version, product_name)
    
    if "error" in tree:
        return jsonify(tree), 404
    
    return jsonify(tree)


@app.route('/api/version/<version>/warmup')
def warmup_version(version: str):
    """
    Pre-bygger alla träd för en version (uppvärmning)
    Returnerar progress och status
    """
    if version not in scanner.versions:
        scanner.scan_versions()
    
    if version not in scanner.versions:
        return jsonify({"error": "Version inte hittad"}), 404
    
    products = scanner.versions[version]["products"]
    results = []
    
    print(f"🔥 Värmer upp version {version} med {len(products)} produkter...")
    
    for product in products:
        try:
            tree = scanner.build_tree_from_root(version, product["name"], use_cache=False)
            results.append({
                "product": product["name"],
                "status": "success",
                "nodes": count_nodes(tree)
            })
        except Exception as e:
            results.append({
                "product": product["name"],
                "status": "error",
                "error": str(e)
            })
    
    return jsonify({
        "version": version,
        "products_processed": len(results),
        "results": results,
        "cache_size": len(scanner.tree_cache)
    })


def count_nodes(tree: Dict) -> int:
    """Räknar antalet noder i trädet"""
    count = 1
    if "children" in tree:
        for child in tree["children"]:
            count += count_nodes(child)
    return count


@app.route('/api/version/<version>/file/<path:filepath>')
def serve_file(version: str, filepath: str):
    """
    Serverar SVG eller JSON fil från en specifik version
    """
    try:
        file_type = 'json' if filepath.endswith('.json') else 'svg'
        success, content = scanner.get_file_content(version, filepath, file_type)
        
        if not success:
            return jsonify({"error": content}), 404
        
        if file_type == 'json':
            return jsonify(content)
        else:
            from flask import Response
            return Response(content, mimetype='image/svg+xml')
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/scan')
def rescan():
    """
    Tvingar en ny skanning av nätverksmappen
    """
    versions = scanner.scan_versions()
    return jsonify({
        "message": "Skanning klar",
        "versions_found": len(versions)
    })


@app.route('/')
def index():
    """
    Root endpoint med API-information
    """
    return jsonify({
        "name": "Simulink WebView Navigation API",
        "version": "2.0",
        "description": "Dynamisk trädnavigering baserat på JSON-metadata",
        "endpoints": {
            "/api/versions": "Lista alla versioner med produkter",
            "/api/version/<version>/products": "Lista produkter för en version",
            "/api/version/<version>/product/<product>/tree": "Bygg navigeringsträd för produkt",
            "/api/version/<version>/file/<filepath>": "Hämta SVG eller JSON fil",
            "/api/scan": "Skanna om nätverksmappen"
        }
    })


if __name__ == '__main__':
    print(f"Skannar nätverksmapp: {NETWORK_PATH}")
    print("Startar Flask-server...")
    app.run(debug=True, host='0.0.0.0', port=5000)
