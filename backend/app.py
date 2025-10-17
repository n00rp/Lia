"""
Flask backend för Simulink WebView Navigation System
Förenklad implementation med .slx-baserad navigation
"""

from flask import Flask, jsonify, Response
import os
from flask_cors import CORS
from pathlib import Path
import json
import re
from typing import Dict, List, Tuple
from collections import defaultdict

app = Flask(__name__)
CORS(app)

NETWORK_PATH = Path(os.getenv('RELEASES_DIR', r"\\FS01\release_hub$\System_Releases")).resolve()

class SimulinkFileScanner:
    """Skannar och organiserar Simulink WebView-filer"""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.products = {}
        self.tree_cache = {}
        
    def scan_products(self) -> Dict:
        """Skannar alla mappar och grupperar per produkt"""
        if not self.base_path.exists():
            return {"error": f"Sökvägen finns inte: {self.base_path}"}
        
        products = defaultdict(list)
        print(f"🔍 Skannar: {self.base_path}")
        
        for item in self.base_path.iterdir():
            if not item.is_dir():
                continue
            
            match = re.match(r'^([A-Za-z0-9]+)(?:\.(\d+))?_(.+)$', item.name)
            
            if match:
                product_name = match.group(1)
                version = match.group(3)
                webview_folder = f"WebView_{product_name}"
                webview_path = item / webview_folder / "support" / "slwebview_files"
                
                if webview_path.exists():
                    print(f"✅ Hittade: {product_name} v{version}")
                    products[product_name].append({
                        'version': version,
                        'folder': item.name,
                        'webview_path': str(webview_path)
                    })
                else:
                    print(f"⚠️  Ingen WebView-mapp för: {item.name}")
        
        for product in products:
            products[product].sort(key=lambda x: x['version'], reverse=True)
        
        self.products = dict(products)
        print(f"📊 Totalt {len(self.products)} produkter hittade")
        return self.products
    
    def build_tree_from_root(self, product: str, version: str, use_cache: bool = True) -> Dict:
        """Bygger navigeringsträd från diagrams_1.json med korrekt klickbarhetslogik"""
        cache_key = f"{product}:{version}"
        if use_cache and cache_key in self.tree_cache:
            print(f"📦 Använder cached träd för {product} v{version}")
            return self.tree_cache[cache_key]
        
        if product not in self.products:
            return {"error": "Produkt inte hittad"}
        
        version_data = next((v for v in self.products[product] if v['version'] == version), None)
        if not version_data:
            return {"error": "Version inte hittad"}
        
        webview_path = Path(version_data['webview_path'])
        diagrams_json = webview_path / f"{product}_diagrams_1.json"
        
        if not diagrams_json.exists():
            return {"error": f"Diagrams JSON hittades inte: {product}_diagrams_1.json"}
        
        print(f"\n🔨 Bygger träd för {product} v{version}...")
        print(f"📄 Läser: {diagrams_json}")
        
        try:
            with open(diagrams_json, 'r', encoding='utf-8') as f:
                hierarchy = json.load(f)
            
            # Hitta root (parent == 0)
            root_node = next((node for node in hierarchy if node.get('parent') == 0), None)
            
            if not root_node:
                return {"error": "Root-nod inte hittad i diagrams_1.json"}
            
            # Bygg lookup-tabeller
            nodes_by_hid = {node['hid']: node for node in hierarchy}
            nodes_by_sid = {node['sid']: node for node in hierarchy if 'sid' in node}
            
            print(f"📊 Totalt {len(nodes_by_hid)} noder i hierarkin")
            print(f"🎯 Root: {root_node.get('name')} (hid:{root_node.get('hid')})\n")
            
            # Bygg träd rekursivt från root
            tree = self._build_tree_node(webview_path, product, root_node, nodes_by_hid, nodes_by_sid, level=0)
            
            self.tree_cache[cache_key] = tree
            print(f"\n✅ Träd byggt och cachat för {product} v{version}")
            
            return tree
            
        except Exception as e:
            print(f"❌ Fel vid läsning av diagrams_1.json: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}
    
    def _build_tree_node(self, webview_path: Path, product: str, node: Dict, nodes_by_hid: Dict, nodes_by_sid: Dict, level: int) -> Dict:
        """Bygger träd-nod från diagrams_1.json med korrekt klickbarhetslogik"""
        
        # Extrahera filnamn från node
        svg_path = node.get('svg', '')
        svg_filename = svg_path.split('/')[-1] if svg_path else f"{product}_d.svg"
        
        sys_view_url = node.get('sysViewURL', '')
        json_filename = sys_view_url.split('/')[-1] if sys_view_url else f"{product}_d.json"
        
        tree_node = {
            "name": node.get('name', product),
            "label": node.get('label', node.get('name', product)),
            "fullname": node.get('fullname', node.get('name', product)),
            "hid": node.get('hid'),
            "sid": node.get('sid'),
            "className": node.get('className'),
            "icon": node.get('icon'),
            "svg": svg_filename,
            "json": json_filename,
            "svg_path": svg_filename,
            "json_path": json_filename,
            "children": [],
            "level": level,
            "is_root": level == 0,
            "product": product,
            "clickable_elements": []
        }
        
        indent = '  ' * level
        print(f"{indent}📄 {node.get('name')} (hid:{node.get('hid')})")
        
        # Hämta elements och children
        elements = node.get('elements', [])
        children_hids = node.get('children', [])
        
        print(f"{indent}   Elements: {len(elements)}, Children HIDs: {children_hids}")
        
        # KORREKT LOGIK: Gå igenom elements array och hitta klickbara
        for element in elements:
            element_sid = element.get('sid')
            element_icon = element.get('icon')
            element_name = element.get('name')
            
            # Bara SubSystem och ModelReference kan vara klickbara
            if element_icon not in ['SubSystemIcon_icon', 'MdlRefBlockIcon_icon']:
                continue
            
            # Extrahera sid-nummer för att bygga filnamn
            if ':' in element_sid:
                product_prefix = element_sid.split(':')[0]
                sid_number = element_sid.split(':')[1]
                expected_svg = f"{product_prefix}_{sid_number}_d.svg"
                expected_json = f"{product_prefix}_{sid_number}_d.json"
            else:
                continue
            
            # Kolla om SVG-filen finns
            svg_file_path = webview_path / expected_svg
            
            if svg_file_path.exists():
                # KLICKBAR!
                clickable = {
                    'sid': element_sid,
                    'name': element_name,
                    'label': element.get('label', element_name),
                    'icon': element_icon,
                    'svg': expected_svg,
                    'json': expected_json
                }
                
                # Kolla om det finns en motsvarande barn-nod i hierarkin
                child_node = nodes_by_sid.get(element_sid)
                
                if child_node and child_node.get('hid') in children_hids:
                    # SubSystem med barn → kan navigeras rekursivt inom samma hierarki
                    clickable['hid'] = child_node['hid']
                    clickable['has_children'] = True
                    clickable['hierarchy_type'] = 'internal'
                    print(f"{indent}   ✅ {element_name} → {expected_svg} (SubSystem, hid:{child_node['hid']})")
                elif element_icon == 'MdlRefBlockIcon_icon':
                    # ModelReference → kolla om det finns en extern hierarki
                    external_diagrams = webview_path / f"{element_name}_diagrams_1.json"
                    
                    if external_diagrams.exists():
                        # ModelRef med egen hierarki!
                        clickable['hid'] = None
                        clickable['has_children'] = True
                        clickable['hierarchy_type'] = 'external'
                        clickable['external_hierarchy'] = f"{element_name}_diagrams_1.json"
                        print(f"{indent}   ✅ {element_name} → {expected_svg} (ModelRef med egen hierarki: {element_name}_diagrams_1.json)")
                    else:
                        # ModelRef utan barn (leaf node)
                        clickable['hid'] = None
                        clickable['has_children'] = False
                        clickable['hierarchy_type'] = 'leaf'
                        print(f"{indent}   ✅ {element_name} → {expected_svg} (ModelRef, leaf node)")
                else:
                    # SubSystem utan barn i hierarkin (leaf node)
                    clickable['hid'] = None
                    clickable['has_children'] = False
                    clickable['hierarchy_type'] = 'leaf'
                    print(f"{indent}   ✅ {element_name} → {expected_svg} (SubSystem, leaf node)")
                
                tree_node['clickable_elements'].append(clickable)
            else:
                print(f"{indent}   ⏭️  {element_name} (SVG finns ej: {expected_svg})")
        
        # Bygg barn-träd ENDAST för SubSystems som finns i hierarkin
        for child_hid in children_hids:
            child_node = nodes_by_hid.get(child_hid)
            if not child_node:
                print(f"{indent}   ⚠️  Child hid:{child_hid} inte hittad i hierarkin")
                continue
            
            # Bygg barn-nod rekursivt
            child_tree = self._build_tree_node(
                webview_path,
                product,
                child_node,
                nodes_by_hid,
                nodes_by_sid,
                level + 1
            )
            tree_node['children'].append(child_tree)
        
        return tree_node
    
    def _build_child_node_from_json(self, webview_path: Path, product: str, hierarchy_node: Dict, level: int) -> Dict:
        """Steg 2: Bygger barn-nod från *_d.json och letar efter .slx i inspector.values"""
        svg_path = hierarchy_node.get('svg', '')
        svg_filename = svg_path.split('/')[-1] if svg_path else ''
        
        sys_view_url = hierarchy_node.get('sysViewURL', '')
        json_filename = sys_view_url.split('/')[-1] if sys_view_url else ''
        
        json_path = webview_path / json_filename
        
        tree_node = {
            "name": hierarchy_node.get('name'),
            "label": hierarchy_node.get('label', hierarchy_node.get('name')),
            "hid": hierarchy_node.get('hid'),
            "sid": hierarchy_node.get('sid'),
            "svg": svg_filename,
            "json": json_filename,
            "svg_path": svg_filename,
            "json_path": json_filename,
            "children": [],
            "level": level,
            "is_root": False,
            "product": product,
            "clickable_elements": []
        }
        
        if json_path.exists():
            print(f"{'  ' * level}🔍 Läser: {json_filename}")
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
                
                # Steg 2: Leta efter .slx i inspector.values
                slx_files = self._extract_slx_from_values(json_data, level)
                
                print(f"{'  ' * level}🔢 Hittade {len(slx_files)} .slx filer")
                
                # För varje .slx, gå till steg 3
                for slx_info in slx_files:
                    slx_file = slx_info['slx']
                    base_name = slx_file.replace('.slx', '')
                    label = slx_info.get('label', base_name)
                    
                    slx_svg = f"{base_name}_d.svg"
                    slx_json = f"{base_name}_d.json"
                    
                    if (webview_path / slx_svg).exists():
                        print(f"{'  ' * level}  ✅ Klickbar: {label} → {base_name}_d")
                        
                        clickable = {
                            'name': base_name,
                            'label': label,
                            'svg': slx_svg,
                            'json': slx_json
                        }
                        tree_node['clickable_elements'].append(clickable)
                        
                        # Steg 3: Bygg barn-nod rekursivt
                        child_tree = self._build_slx_child_node(
                            webview_path, 
                            product, 
                            base_name,
                            label,
                            level + 1
                        )
                        tree_node['children'].append(child_tree)
                    else:
                        print(f"{'  ' * level}  ⏭️  {slx_file} → {slx_svg} finns inte")
                    
            except Exception as e:
                print(f"{'  ' * level}  ❌ Fel vid läsning av {json_filename}: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"{'  ' * level}  ⚠️  JSON finns inte: {json_filename}")
        
        return tree_node
    
    def _extract_slx_from_values(self, json_data, level: int) -> List[Dict]:
        """Extraherar alla .slx filer från inspector.values array i JSON"""
        slx_files = []
        
        # JSON kan vara en lista eller ett objekt
        items_to_check = json_data if isinstance(json_data, list) else [json_data]
        
        print(f"{'  ' * level}📋 Går igenom {len(items_to_check)} objekt")
        
        for item in items_to_check:
            if not isinstance(item, dict):
                print(f"{'  ' * level}  ⏭️ Skippar (inte dict)")
                continue
            
            # VIKTIGT: Leta i "inspector" -> "values"
            inspector = item.get('inspector', {})
            if not inspector:
                continue
                
            values = inspector.get('values', [])
            if not isinstance(values, list) or len(values) == 0:
                continue
            
            print(f"{'  ' * level}  🔎 Kollar inspector.values ({len(values)} items)")
            
            # Hitta första .slx i values
            for idx, val in enumerate(values):
                if isinstance(val, str) and val.endswith('.slx'):
                    # Försök hitta label (ofta vid index 11 i values)
                    label = val.replace('.slx', '')
                    if len(values) > 11 and isinstance(values[11], str) and values[11]:
                        label = values[11]
                    
                    slx_files.append({
                        'slx': val,
                        'label': label
                    })
                    print(f"{'  ' * level}    ✅ Hittade .slx vid index {idx}: {val}")
                    break  # Ta bara första .slx per objekt
        
        return slx_files
    
    def _build_slx_child_node(self, webview_path: Path, product: str, base_name: str, label: str, level: int) -> Dict:
        """Steg 3: Bygger nod för en .slx-fil och fortsätter rekursivt"""
        svg_filename = f"{base_name}_d.svg"
        json_filename = f"{base_name}_d.json"
        json_path = webview_path / json_filename
        
        tree_node = {
            "name": base_name,
            "label": label,
            "svg": svg_filename,
            "json": json_filename,
            "svg_path": svg_filename,
            "json_path": json_filename,
            "children": [],
            "level": level,
            "is_root": False,
            "product": product,
            "clickable_elements": []
        }
        
        # Steg 3: Läs JSON och leta efter fler .slx filer
        if json_path.exists():
            print(f"{'  ' * level}🔍 Läser: {json_filename}")
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
                
                # Leta efter .slx i inspector.values
                slx_files = self._extract_slx_from_values(json_data, level)
                
                print(f"{'  ' * level}📄 {base_name}: Hittade {len(slx_files)} .slx filer")
                
                # Fortsätt rekursivt för varje .slx
                for slx_info in slx_files:
                    child_slx = slx_info['slx']
                    child_base = child_slx.replace('.slx', '')
                    child_label = slx_info.get('label', child_base)
                    child_svg = f"{child_base}_d.svg"
                    child_json = f"{child_base}_d.json"
                    
                    if (webview_path / child_svg).exists():
                        print(f"{'  ' * level}  ✅ Klickbar: {child_label}")
                        
                        clickable = {
                            'name': child_base,
                            'label': child_label,
                            'svg': child_svg,
                            'json': child_json
                        }
                        tree_node['clickable_elements'].append(clickable)
                        
                        # Fortsätt rekursivt
                        grandchild = self._build_slx_child_node(
                            webview_path, 
                            product, 
                            child_base,
                            child_label,
                            level + 1
                        )
                        tree_node['children'].append(grandchild)
            except Exception as e:
                print(f"{'  ' * level}  ❌ Fel: {e}")
        
        return tree_node
    
    def get_file_content(self, product: str, version: str, filename: str, file_type: str = 'svg') -> Tuple[bool, any]:
        """Hämtar innehållet i en fil"""
        if product not in self.products:
            return False, "Produkt inte hittad"
        
        version_data = next((v for v in self.products[product] if v['version'] == version), None)
        if not version_data:
            return False, "Version inte hittad"
        
        webview_path = Path(version_data['webview_path'])
        file_path = webview_path / filename
        
        if not file_path.exists():
            return False, f"Fil inte hittad: {filename}"
        
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


scanner = SimulinkFileScanner(str(NETWORK_PATH))


@app.route('/api/products')
def get_products():
    """Returnerar lista över alla unika produkter"""
    products = scanner.scan_products()
    
    if "error" in products:
        return jsonify(products), 500
    
    product_list = []
    for product_name, versions in products.items():
        product_list.append({
            "name": product_name,
            "version_count": len(versions),
            "latest_version": versions[0]['version'] if versions else None
        })
    
    return jsonify({
        "count": len(product_list),
        "products": sorted(product_list, key=lambda x: x['name'])
    })


@app.route('/api/product/<product>/versions')
def get_product_versions(product: str):
    """Returnerar alla versioner för en specifik produkt"""
    if product not in scanner.products:
        scanner.scan_products()
    
    if product not in scanner.products:
        return jsonify({"error": "Produkt inte hittad"}), 404
    
    versions = scanner.products[product]
    version_list = [{
        "version": v['version'],
        "folder": v['folder']
    } for v in versions]
    
    return jsonify({
        "product": product,
        "count": len(version_list),
        "versions": version_list
    })


@app.route('/api/product/<product>/version/<version>/tree')
def get_product_version_tree(product: str, version: str):
    """Bygger trädet för produkt och version"""
    if product not in scanner.products:
        scanner.scan_products()
    
    tree = scanner.build_tree_from_root(product, version)
    
    if "error" in tree:
        return jsonify(tree), 404
    
    return jsonify(tree)


@app.route('/api/product/<product>/version/<version>/file/<path:filepath>')
def serve_product_file(product: str, version: str, filepath: str):
    """Serverar SVG eller JSON fil"""
    try:
        file_type = 'json' if filepath.endswith('.json') else 'svg'
        success, content = scanner.get_file_content(product, version, filepath, file_type)
        
        if not success:
            return jsonify({"error": content}), 404
        
        if file_type == 'json':
            return jsonify(content)
        else:
            return Response(content, mimetype='image/svg+xml')
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/scan')
def rescan():
    """Tvingar ny skanning"""
    products = scanner.scan_products()
    return jsonify({
        "message": "Skanning klar",
        "products_found": len(products)
    })


@app.route('/')
def index():
    """Root endpoint med API-information"""
    return jsonify({
        "name": "Simulink WebView Navigation API",
        "version": "6.0 - Förenklad",
        "description": ".slx-baserad navigation via inspector.values",
        "logic": {
            "step_1": "Använd children array från diagrams_1.json",
            "step_2": "Leta efter .slx i inspector.values från *_d.json",
            "step_3": "Rekursivt fortsätt leta efter .slx i varje underliggande fil"
        },
        "endpoints": {
            "/api/products": "Lista alla produkter",
            "/api/product/<product>/versions": "Lista versioner",
            "/api/product/<product>/version/<version>/tree": "Bygg träd",
            "/api/product/<product>/version/<version>/file/<filepath>": "Hämta fil"
        }
    })


if __name__ == '__main__':
    print(f"🚀 Skannar: {NETWORK_PATH}")
    print("📂 Steg 1: [Produkt]_diagrams_1.json → children array")
    print("📂 Steg 2: *_d.json → inspector.values → .slx filer")
    print("📂 Steg 3: Rekursivt genom alla .slx filer")
    print("⚡ Startar Flask-server...")
    app.run(debug=True, host='0.0.0.0', port=5000)