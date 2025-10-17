/**
 * Simulink WebView Navigator - Frontend JavaScript v3.0
 * Produkt-först navigation med WebView_[Produkt] stöd
 */

// Konfiguration
const API_BASE_URL = 'http://localhost:5000/api';

// Global state
const state = {
    products: [],
    currentProduct: null,
    currentVersion: null,
    navigationTree: null,
    currentNode: null,
    zoomLevel: 1.0
};

// DOM-element
const elements = {
    welcomeScreen: null,
    mainApp: null,
    productGrid: null,
    treeContainer: null,
    svgStackContainer: null,
    fileInfoContent: null,
    currentVersionSpan: null,
    currentProductSpan: null,
    currentFileName: null,
    loadingIndicator: null,
    backBtn: null,
    zoomInBtn: null,
    zoomOutBtn: null,
    resetZoomBtn: null,
    fitScreenBtn: null,
    metadataPopup: null,
    popupTitle: null,
    popupContent: null,
    popupClose: null
};

/**
 * Initialisering när DOM är laddad
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    attachEventListeners();
    loadProducts();
});

/**
 * Initialisera DOM-element referenser
 */
function initializeElements() {
    elements.welcomeScreen = document.getElementById('welcome-screen');
    elements.mainApp = document.getElementById('main-app');
    elements.productGrid = document.getElementById('version-grid'); // Återanvänder samma ID
    elements.treeContainer = document.getElementById('tree-container');
    elements.svgStackContainer = document.getElementById('svg-stack-container');
    elements.fileInfoContent = document.getElementById('file-info-content');
    elements.currentVersionSpan = document.getElementById('current-version');
    elements.currentProductSpan = document.getElementById('current-product');
    elements.currentFileName = document.getElementById('current-file-name');
    elements.loadingIndicator = document.getElementById('loading-indicator');
    elements.backBtn = document.getElementById('back-btn');
    elements.zoomInBtn = document.getElementById('zoom-in');
    elements.zoomOutBtn = document.getElementById('zoom-out');
    elements.resetZoomBtn = document.getElementById('reset-zoom');
    elements.fitScreenBtn = document.getElementById('fit-screen');
    elements.metadataPopup = document.getElementById('metadata-popup');
    elements.popupTitle = document.getElementById('popup-title');
    elements.popupContent = document.getElementById('popup-content');
    elements.popupClose = document.getElementById('popup-close');
}

/**
 * Koppla event listeners
 */
function attachEventListeners() {
    elements.backBtn.addEventListener('click', handleBackButton);
    elements.zoomInBtn.addEventListener('click', () => adjustZoom(1.2));
    elements.zoomOutBtn.addEventListener('click', () => adjustZoom(0.8));
    elements.resetZoomBtn.addEventListener('click', resetZoom);
    elements.fitScreenBtn.addEventListener('click', fitToScreen);
    elements.popupClose.addEventListener('click', closeMetadataPopup);
    
    elements.metadataPopup.addEventListener('click', (e) => {
        if (e.target === elements.metadataPopup) {
            closeMetadataPopup();
        }
    });
    
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Hantera tillbaka-knapp (olika beteende beroende på state)
 */
function handleBackButton() {
    if (state.currentVersion && state.currentProduct) {
        // Om vi visar ett träd, gå tillbaka till versionsval
        showVersionSelection(state.currentProduct);
    } else if (state.currentProduct) {
        // Om vi visar versioner, gå tillbaka till produktval
        showWelcomeScreen();
    } else {
        // Annars gå till startsidan
        showWelcomeScreen();
    }
}

/**
 * API-anrop: Hämta alla produkter
 */
async function loadProducts() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        state.products = data.products || [];
        renderProductCards();
        
        console.log(`Hittade ${state.products.length} produkter`);
    } catch (error) {
        console.error('Fel vid laddning av produkter:', error);
        elements.productGrid.innerHTML = `
            <div class="grid-placeholder">
                <p style="color: #ef4444;">❌ Kunde inte ladda produkter</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">Kontrollera att backend körs på ${API_BASE_URL}</p>
                <p style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.8;">${error.message}</p>
            </div>
        `;
    } finally {
        showLoading(false);
    }
}

/**
 * Rendera produktkort på startsidan
 */
function renderProductCards() {
    if (state.products.length === 0) {
        elements.productGrid.innerHTML = `
            <div class="grid-placeholder">
                <p>Inga produkter hittades.</p>
            </div>
        `;
        return;
    }
    
    elements.productGrid.innerHTML = '';
    
    state.products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'version-card';
        card.style.cursor = 'pointer';
        
        card.innerHTML = `
            <h2>📦 ${product.name}</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem;">
                ${product.version_count} version(er)
            </p>
            ${product.latest_version ? `
                <p style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 0.5rem;">
                    Senaste: ${product.latest_version}
                </p>
            ` : ''}
        `;
        
        card.addEventListener('click', () => {
            showVersionSelection(product.name);
        });
        
        elements.productGrid.appendChild(card);
    });
}

/**
 * Visa versionsval för en produkt
 */
async function showVersionSelection(productName) {
    showLoading(true);
    state.currentProduct = productName;
    
    try {
        const response = await fetch(`${API_BASE_URL}/product/${productName}/versions`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        renderVersionCards(productName, data.versions);
        console.log(`Hittade ${data.versions.length} versioner för ${productName}`);
    } catch (error) {
        console.error('Fel vid laddning av versioner:', error);
        showError(`Kunde inte ladda versioner: ${error.message}`);
        showWelcomeScreen();
    } finally {
        showLoading(false);
    }
}

/**
 * Rendera versionskort för en produkt
 */
function renderVersionCards(productName, versions) {
    elements.productGrid.innerHTML = '';
    
    // Lägg till header med tillbaka-info
    const header = document.createElement('div');
    header.style.gridColumn = '1 / -1';
    header.style.marginBottom = '1rem';
    header.innerHTML = `
        <h2 style="color: var(--text-primary); margin-bottom: 0.5rem;">
            📦 ${productName}
        </h2>
        <p style="color: var(--text-secondary); font-size: 0.875rem;">
            Välj version för att öppna
        </p>
    `;
    elements.productGrid.appendChild(header);
    
    versions.forEach(versionData => {
        const card = document.createElement('div');
        card.className = 'version-card';
        card.style.cursor = 'pointer';
        
        card.innerHTML = `
            <h3>Version ${versionData.version}</h3>
            <p style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 0.5rem;">
                ${versionData.folder}
            </p>
        `;
        
        card.addEventListener('click', () => {
            loadProductVersion(productName, versionData.version);
        });
        
        elements.productGrid.appendChild(card);
    });
}

/**
 * Ladda en specifik produkt och version
 */
async function loadProductVersion(productName, version) {
    showLoading(true);
    
    try {
        state.currentProduct = productName;
        state.currentVersion = version;
        
        const response = await fetch(`${API_BASE_URL}/product/${productName}/version/${version}/tree`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        state.navigationTree = data;
        
        showMainApp();
        
        elements.currentVersionSpan.textContent = version;
        elements.currentProductSpan.textContent = productName;
        
        renderNavigationTree(data);
        loadNode(data);
        
        console.log('Träd laddat:', data);
    } catch (error) {
        console.error('Fel vid laddning av produkt:', error);
        showError(`Kunde inte ladda produkt: ${error.message}`);
        showLoading(false);
    }
}

/**
 * Rendera navigeringsträdet
 */
function renderNavigationTree(tree) {
    elements.treeContainer.innerHTML = '';
    const treeElement = buildTreeNode(tree);
    elements.treeContainer.appendChild(treeElement);
    showLoading(false);
}

/**
 * Bygg DOM-element för en trädnod rekursivt
 */
function buildTreeNode(node, level = 0) {
    const container = document.createElement('div');
    container.className = 'tree-node';
    container.style.marginLeft = `${level * 1}rem`;
    
    const item = document.createElement('div');
    item.className = 'tree-item file';
    
    if (node.children && node.children.length > 0) {
        item.classList.add('folder', 'expanded');
    }
    
    item.innerHTML = `
        <span class="icon"></span>
        <span>${node.name}</span>
        ${node.children && node.children.length > 0 ? ` (${node.children.length})` : ''}
    `;
    
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (node.children && node.children.length > 0) {
            item.classList.toggle('expanded');
            item.classList.toggle('collapsed');
            const childrenContainer = container.querySelector('.children-container');
            if (childrenContainer) {
                childrenContainer.style.display = 
                    childrenContainer.style.display === 'none' ? 'block' : 'none';
            }
        }
        
        loadNode(node);
        
        document.querySelectorAll('.tree-item').forEach(t => t.classList.remove('active'));
        item.classList.add('active');
    });
    
    container.appendChild(item);
    
    if (node.children && node.children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container';
        
        node.children.forEach(child => {
            childrenContainer.appendChild(buildTreeNode(child, level + 1));
        });
        
        container.appendChild(childrenContainer);
    }
    
    return container;
}

/**
 * Ladda och visa en nod (SVG + JSON)
 */
async function loadNode(node) {
    showLoading(true);
    state.currentNode = node;
    
    try {
        const svgResponse = await fetch(
            `${API_BASE_URL}/product/${state.currentProduct}/version/${state.currentVersion}/file/${node.svg_path}`
        );
        const svgContent = await svgResponse.text();
        
        displaySVG(svgContent, node);
        updateFileInfo(node);
        elements.currentFileName.textContent = node.svg;
        
        console.log('Fil laddad:', node.name);
    } catch (error) {
        console.error('Fel vid laddning av fil:', error);
        showError(`Kunde inte ladda fil: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

/**
 * Visa SVG i huvudområdet
 */
function displaySVG(svgContent, node) {
    elements.svgStackContainer.innerHTML = '';
    
    const layer = document.createElement('div');
    layer.className = 'svg-layer';
    layer.innerHTML = svgContent;
    
    elements.svgStackContainer.appendChild(layer);
    
    state.zoomLevel = 1.0;
    applyZoom();
    
    attachSVGClickListeners(layer, node);
}

/**
 * Koppla klick-lyssnare till SVG-element
 */
function attachSVGClickListeners(layer, node) {
    const svg = layer.querySelector('svg');
    if (!svg) return;
    
    if (node.clickable_elements && node.clickable_elements.length > 0) {
        console.log('Klickbara element:', node.clickable_elements);
        
        node.clickable_elements.forEach(clickableEl => {
            let svgElement = null;
            
            // Använd 'sid' istället för 'id'
            const elementId = clickableEl.sid || clickableEl.id;
            
            if (elementId) {
                // 1. Försök exakt matchning på ID
                svgElement = svg.querySelector(`[id="${elementId}"]`);
                
                // 2. Om ID innehåller kolon (PS200:34341), försök med nummer-delen
                if (!svgElement && elementId.includes(':')) {
                    const simpleId = elementId.split(':').pop();
                    svgElement = svg.querySelector(`[id*="${simpleId}"]`);
                }
                
                // 3. Försök med hela sid som substring
                if (!svgElement) {
                    const allElements = svg.querySelectorAll('[id]');
                    svgElement = Array.from(allElements).find(el => {
                        const elId = el.getAttribute('id');
                        return elId && elId.includes(elementId);
                    });
                }
            }
            
            // 4. Fallback: Sök baserat på label
            if (!svgElement && clickableEl.label) {
                const allElements = svg.querySelectorAll('[id]');
                svgElement = Array.from(allElements).find(el => {
                    const elId = el.getAttribute('id');
                    return elId && elId.toLowerCase().includes(clickableEl.label.toLowerCase());
                });
            }
            
            if (svgElement) {
                svgElement.style.cursor = 'pointer';
                svgElement.style.transition = 'opacity 0.2s, filter 0.2s';
                
                const originalStroke = svgElement.getAttribute('stroke');
                
                svgElement.addEventListener('mouseenter', () => {
                    svgElement.style.opacity = '0.7';
                    svgElement.style.filter = 'brightness(1.2)';
                    svgElement.setAttribute('stroke', '#2563eb');
                    svgElement.setAttribute('stroke-width', '2');
                });
                
                svgElement.addEventListener('mouseleave', () => {
                    svgElement.style.opacity = '1';
                    svgElement.style.filter = 'none';
                    if (originalStroke) {
                        svgElement.setAttribute('stroke', originalStroke);
                    } else {
                        svgElement.removeAttribute('stroke');
                    }
                    svgElement.removeAttribute('stroke-width');
                });
                
                let clickTimer = null;
                
                svgElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    if (clickTimer === null) {
                        clickTimer = setTimeout(() => {
                            showElementMetadata(svgElement, clickableEl, node);
                            clickTimer = null;
                        }, 250);
                    } else {
                        clearTimeout(clickTimer);
                        clickTimer = null;
                        handleSVGElementDoubleClick(svgElement, clickableEl, node);
                    }
                });
                
                console.log('Klickbart element aktiverat:', clickableEl.id, '→', clickableEl.name);
            }
        });
    }
}

/**
 * Visa metadata för ett SVG-element
 */
function showElementMetadata(svgElement, clickableElement, currentNode) {
    const elementId = svgElement.getAttribute('id');
    
    elements.popupTitle.textContent = clickableElement.name || elementId || 'Block-information';
    
    let html = '';
    
    html += '<div class="metadata-section">';
    html += '<h4>Grundläggande</h4>';
    html += `<div class="metadata-row">
        <span class="metadata-label">ID:</span>
        <span class="metadata-value">${elementId || 'N/A'}</span>
    </div>`;
    
    const hasChildren = currentNode.children && currentNode.children.some(child => 
        child.name === clickableElement.name || child.svg_element_id === clickableElement.id
    );
    html += `<div class="metadata-row">
        <span class="metadata-label">Undermoduler:</span>
        <span class="metadata-value">${hasChildren ? '✅ Ja (dubbelklicka för att öppna)' : '❌ Nej'}</span>
    </div>`;
    html += '</div>';
    
    if (clickableElement.metadata) {
        const metadata = clickableElement.metadata;
        
        const excludeKeys = ['icon', 'id', 'name', 'file', 'position', 'bounds'];
        const paramKeys = Object.keys(metadata).filter(key => !excludeKeys.includes(key));
        
        if (paramKeys.length > 0) {
            html += '<div class="metadata-section">';
            html += '<h4>Parametrar</h4>';
            paramKeys.forEach(key => {
                let value = metadata[key];
                if (typeof value === 'object') {
                    value = JSON.stringify(value, null, 2);
                }
                html += `<div class="metadata-row">
                    <span class="metadata-label">${key}:</span>
                    <span class="metadata-value">${value}</span>
                </div>`;
            });
            html += '</div>';
        }
    }
    
    if (html === '') {
        html = '<p style="text-align: center; color: var(--text-secondary);">Ingen metadata tillgänglig.</p>';
    }
    
    elements.popupContent.innerHTML = html;
    elements.metadataPopup.classList.remove('hidden');
}

/**
 * Stäng metadata-popup
 */
function closeMetadataPopup() {
    elements.metadataPopup.classList.add('hidden');
}

/**
 * Hantera dubbelklick - navigering (fixad för hierarchy_type)
 */
function handleSVGElementDoubleClick(svgElement, clickableElement, currentNode) {
    closeMetadataPopup();
    
    console.log('🔎 Dubbelklick på:', clickableElement.name);
    console.log('   hierarchy_type:', clickableElement.hierarchy_type);
    console.log('   has_children:', clickableElement.has_children);
    console.log('   hid:', clickableElement.hid);
    
    // Kolla hierarchy_type
    if (clickableElement.hierarchy_type === 'internal') {
        // SubSystem med barn i samma hierarki
        const matchingChild = currentNode.children.find(child => 
            child.hid === clickableElement.hid
        );
        
        if (matchingChild) {
            console.log('✅ Navigerar till internal:', matchingChild.name);
            loadNode(matchingChild);
            
            document.querySelectorAll('.tree-item').forEach(item => {
                if (item.textContent.includes(matchingChild.name)) {
                    item.classList.add('active');
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    item.classList.remove('active');
                }
            });
        } else {
            console.error('❌ Kunde inte hitta barn-nod med hid:', clickableElement.hid);
            showError('Kunde inte navigera till barn-nod.');
        }
    } 
    else if (clickableElement.hierarchy_type === 'external') {
        // ModelReference med egen hierarki
        console.log('📊 Extern hierarki:', clickableElement.external_hierarchy);
        console.log('📊 SVG:', clickableElement.svg);
        
        // TODO: Implementera laddning av extern hierarki
        showError(`ModelReference "${clickableElement.name}" har egen hierarki (${clickableElement.external_hierarchy}).\n\nSteg att implementera:\n1. Ladda ${clickableElement.external_hierarchy}\n2. Bygg nytt träd\n3. Visa ${clickableElement.svg}`);
        
        // Tillfällig lösning: visa bara SVG:n
        loadSVGOnly(clickableElement.svg, clickableElement.name);
    }
    else if (clickableElement.hierarchy_type === 'leaf') {
        // Leaf node - ingen vidare navigation
        console.log('🍃 Leaf node, ingen vidare navigation');
        showError(`"${clickableElement.name}" är en leaf node (inga undermoduler).`);
    }
    else {
        // Ingen hierarchy_type (gammal data?)
        console.warn('⚠️  Ingen hierarchy_type definierad, försöker gammal logik');
        
        const matchingChild = currentNode.children.find(child => 
            child.name === clickableElement.name
        );
        
        if (matchingChild) {
            console.log('✅ Navigerar till (fallback):', matchingChild.name);
            loadNode(matchingChild);
        } else {
            showError('Detta block har ingen undermodul att navigera till.');
        }
    }
}

/**
 * Ladda endast SVG utan navigation (för leaf nodes)
 */
async function loadSVGOnly(svgFilename, elementName) {
    showLoading(true);
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/product/${state.currentProduct}/version/${state.currentVersion}/file/${svgFilename}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const svgText = await response.text();
        
        // Visa SVG utan att ändra träd-state
        elements.svgStackContainer.innerHTML = svgText;
        elements.currentFileName.textContent = `${elementName} (${svgFilename})`;
        
        console.log(`🇮 Laddade SVG: ${svgFilename}`);
        
    } catch (error) {
        console.error('❌ Fel vid laddning av SVG:', error);
        showError(`Kunde inte ladda ${svgFilename}: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

/**
 * Uppdatera filinfo-panelen
 */
function updateFileInfo(node) {
    let html = `
        <div class="info-row">
            <span class="info-label">Fil:</span> ${node.svg}
        </div>
        <div class="info-row">
            <span class="info-label">Nivå:</span> ${node.level}
        </div>
        <div class="info-row">
            <span class="info-label">Barn:</span> ${node.children ? node.children.length : 0}
        </div>
    `;
    
    if (node.children && node.children.length > 0) {
        html += `<hr style="margin: 0.75rem 0; border: none; border-top: 1px solid var(--border-color);">`;
        html += `<div style="font-size: 0.75rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-secondary);">UNDERLIGGANDE:</div>`;
        node.children.forEach(child => {
            html += `<div style="font-size: 0.8125rem; margin-bottom: 0.25rem;">→ ${child.name}</div>`;
        });
    }
    
    elements.fileInfoContent.innerHTML = html;
}

/**
 * Visa välkomstskärmen
 */
function showWelcomeScreen() {
    elements.welcomeScreen.classList.remove('hidden');
    elements.mainApp.classList.add('hidden');
    
    state.currentVersion = null;
    state.currentProduct = null;
    state.navigationTree = null;
    state.currentNode = null;
    
    loadProducts();
}

/**
 * Visa huvudapplikationen
 */
function showMainApp() {
    elements.welcomeScreen.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
}

/**
 * Zoom-funktioner
 */
function adjustZoom(factor) {
    state.zoomLevel *= factor;
    state.zoomLevel = Math.max(0.1, Math.min(state.zoomLevel, 5.0));
    applyZoom();
}

function resetZoom() {
    state.zoomLevel = 1.0;
    applyZoom();
}

function fitToScreen() {
    const svg = elements.svgStackContainer.querySelector('svg');
    if (!svg) return;
    
    const container = elements.svgStackContainer;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const svgWidth = svg.viewBox.baseVal.width || svg.width.baseVal.value;
    const svgHeight = svg.viewBox.baseVal.height || svg.height.baseVal.value;
    
    const scaleX = containerWidth / svgWidth;
    const scaleY = containerHeight / svgHeight;
    
    state.zoomLevel = Math.min(scaleX, scaleY) * 0.9;
    applyZoom();
}

function applyZoom() {
    const svgLayers = elements.svgStackContainer.querySelectorAll('.svg-layer svg');
    svgLayers.forEach(svg => {
        svg.style.transform = `scale(${state.zoomLevel})`;
        svg.style.transformOrigin = 'center center';
        svg.style.transition = 'transform 0.2s ease';
    });
}

/**
 * Tangentbordsgenvägar
 */
function handleKeyboardShortcuts(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') {
        return;
    }
    
    switch (event.key) {
        case '+':
        case '=':
            adjustZoom(1.2);
            event.preventDefault();
            break;
        case '-':
            adjustZoom(0.8);
            event.preventDefault();
            break;
        case '0':
            resetZoom();
            event.preventDefault();
            break;
        case 'f':
        case 'F':
            fitToScreen();
            event.preventDefault();
            break;
        case 'Escape':
            if (!elements.metadataPopup.classList.contains('hidden')) {
                closeMetadataPopup();
            } else {
                handleBackButton();
            }
            event.preventDefault();
            break;
    }
}

/**
 * Visa/dölj laddningsindikator
 */
function showLoading(show) {
    if (show) {
        elements.loadingIndicator.classList.remove('hidden');
    } else {
        elements.loadingIndicator.classList.add('hidden');
    }
}

/**
 * Visa felmeddelande
 */
function showError(message) {
    console.error(message);
    alert(message);
}

window.appState = state;
window.appElements = elements;