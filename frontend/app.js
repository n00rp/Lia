/**
 * Simulink WebView Navigator - Frontend JavaScript v2.0
 * Dynamisk trädnavigering baserat på JSON-metadata
 */

// Konfiguration
const API_BASE_URL = 'http://localhost:5000/api';

// Global state
const state = {
    versions: [],
    currentVersion: null,
    currentProduct: null,
    navigationTree: null,
    currentNode: null,
    zoomLevel: 1.0
};

// DOM-element
const elements = {
    welcomeScreen: null,
    mainApp: null,
    versionGrid: null,
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
    loadVersions();
});

/**
 * Initialisera DOM-element referenser
 */
function initializeElements() {
    elements.welcomeScreen = document.getElementById('welcome-screen');
    elements.mainApp = document.getElementById('main-app');
    elements.versionGrid = document.getElementById('version-grid');
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
    elements.backBtn.addEventListener('click', showWelcomeScreen);
    elements.zoomInBtn.addEventListener('click', () => adjustZoom(1.2));
    elements.zoomOutBtn.addEventListener('click', () => adjustZoom(0.8));
    elements.resetZoomBtn.addEventListener('click', resetZoom);
    elements.fitScreenBtn.addEventListener('click', fitToScreen);
    elements.popupClose.addEventListener('click', closeMetadataPopup);
    
    // Stäng popup vid klick utanför
    elements.metadataPopup.addEventListener('click', (e) => {
        if (e.target === elements.metadataPopup) {
            closeMetadataPopup();
        }
    });
    
    // Tangentbordsgenvägar
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * API-anrop: Hämta alla versioner och visa dem på startsidan
 */
async function loadVersions() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/versions`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        state.versions = data.versions || [];
        renderVersionCards();
        
        console.log(`Hittade ${state.versions.length} versioner`);
    } catch (error) {
        console.error('Fel vid laddning av versioner:', error);
        elements.versionGrid.innerHTML = `
            <div class="grid-placeholder">
                <p style="color: #ef4444;">❌ Kunde inte ladda versioner</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">Kontrollera att backend körs på ${API_BASE_URL}</p>
                <p style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.8;">${error.message}</p>
            </div>
        `;
    } finally {
        showLoading(false);
    }
}

/**
 * Rendera versionskort på startsidan
 */
function renderVersionCards() {
    if (state.versions.length === 0) {
        elements.versionGrid.innerHTML = `
            <div class="grid-placeholder">
                <p>Inga versioner hittades.</p>
            </div>
        `;
        return;
    }
    
    elements.versionGrid.innerHTML = '';
    
    state.versions.forEach(versionData => {
        const card = document.createElement('div');
        card.className = 'version-card';
        
        let productsHTML = '';
        if (versionData.products && versionData.products.length > 0) {
            productsHTML = '<div class="products">';
            versionData.products.forEach(product => {
                productsHTML += `
                    <div class="product-item" data-version="${versionData.version}" data-product="${product.name}">
                        <span class="product-name">📄 ${product.name}</span>
                    </div>
                `;
            });
            productsHTML += '</div>';
            
            // Lägg till warmup-knapp
            productsHTML += `
                <button class="warmup-btn" data-version="${versionData.version}">
                    🔥 Förbered version (snabbare laddning)
                </button>
            `;
        } else {
            productsHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">Inga produkter hittades</p>';
        }
        
        card.innerHTML = `
            <h2>Version ${versionData.version_display}</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem;">${versionData.product_count} produkt(er)</p>
            <div class="warmup-status" data-version="${versionData.version}"></div>
            ${productsHTML}
        `;
        
        // Lägg till klick-lyssnare på produkter
        card.querySelectorAll('.product-item').forEach(productItem => {
            productItem.addEventListener('click', () => {
                const version = productItem.dataset.version;
                const product = productItem.dataset.product;
                loadProduct(version, product);
            });
        });
        
        // Lägg till klick-lyssnare på warmup-knapp
        const warmupBtn = card.querySelector('.warmup-btn');
        if (warmupBtn) {
            warmupBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const version = warmupBtn.dataset.version;
                warmupVersion(version, warmupBtn);
            });
        }
        
        elements.versionGrid.appendChild(card);
    });
}

/**
 * Värm upp (pre-build) alla träd för en version
 */
async function warmupVersion(version, buttonElement) {
    const statusElement = document.querySelector(`.warmup-status[data-version="${version}"]`);
    
    buttonElement.disabled = true;
    buttonElement.textContent = '⏳ Förbereder...';
    statusElement.innerHTML = '<p style="color: #f59e0b; font-size: 0.875rem;">Bygger träd i bakgrunden...</p>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/version/${version}/warmup`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        console.log('Warmup klar:', data);
        
        buttonElement.textContent = '✅ Redo!';
        buttonElement.style.backgroundColor = '#10b981';
        statusElement.innerHTML = `
            <p style="color: #10b981; font-size: 0.875rem;">
                ✅ ${data.products_processed} produkter förberedda 
                (${data.cache_size} träd i cache)
            </p>
        `;
        
        setTimeout(() => {
            statusElement.innerHTML = '';
        }, 5000);
        
    } catch (error) {
        console.error('Warmup misslyckades:', error);
        buttonElement.textContent = '❌ Misslyckades';
        buttonElement.style.backgroundColor = '#ef4444';
        statusElement.innerHTML = `<p style="color: #ef4444; font-size: 0.875rem;">Fel: ${error.message}</p>`;
        
        setTimeout(() => {
            buttonElement.disabled = false;
            buttonElement.textContent = '🔥 Förbered version';
            buttonElement.style.backgroundColor = '';
        }, 3000);
    }
}

/**
 * Ladda en specifik produkt och bygg trädet
 */
async function loadProduct(version, productName) {
    showLoading(true);
    
    try {
        // Spara aktuell version och produkt
        state.currentVersion = version;
        state.currentProduct = productName;
        
        // Hämta trädet från backend
        const response = await fetch(`${API_BASE_URL}/version/${version}/product/${productName}/tree`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        state.navigationTree = data;
        
        // Visa huvudapplikationen
        showMainApp();
        
        // Uppdatera UI
        elements.currentVersionSpan.textContent = version.replace(/_/g, '.');
        elements.currentProductSpan.textContent = productName;
        
        // Rendera trädet
        renderNavigationTree(data);
        
        // Ladda root-filen automatiskt
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
    
    // Skapa nod-element
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
    
    // Klick på nod laddar filen
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Toggle expandering om det finns barn
        if (node.children && node.children.length > 0) {
            item.classList.toggle('expanded');
            item.classList.toggle('collapsed');
            const childrenContainer = container.querySelector('.children-container');
            if (childrenContainer) {
                childrenContainer.style.display = 
                    childrenContainer.style.display === 'none' ? 'block' : 'none';
            }
        }
        
        // Ladda filen
        loadNode(node);
        
        // Markera som aktiv
        document.querySelectorAll('.tree-item').forEach(t => t.classList.remove('active'));
        item.classList.add('active');
    });
    
    container.appendChild(item);
    
    // Lägg till barn rekursivt
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
        // Hämta SVG-fil
        const svgResponse = await fetch(
            `${API_BASE_URL}/version/${state.currentVersion}/file/${node.svg_path}`
        );
        const svgContent = await svgResponse.text();
        
        // Visa SVG
        displaySVG(svgContent, node);
        
        // Uppdatera filinfo
        updateFileInfo(node);
        
        // Uppdatera filnamn i toolbar
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
    
    // Återställ och tillämpa zoom
    state.zoomLevel = 1.0;
    applyZoom();
    
    // Lägg till klick-lyssnare på SVG-element
    attachSVGClickListeners(layer, node);
}

/**
 * Koppla klick-lyssnare till SVG-element för navigation
 */
function attachSVGClickListeners(layer, node) {
    const svg = layer.querySelector('svg');
    if (!svg) return;
    
    // Om noden har clickable_elements, använd dem för att identifiera klickbara element
    if (node.clickable_elements && node.clickable_elements.length > 0) {
        console.log('Klickbara element:', node.clickable_elements);
        
        node.clickable_elements.forEach(clickableEl => {
            // Hitta motsvarande SVG-element
            let svgElement = null;
            
            // 1. Försök hitta via exakt ID
            if (clickableEl.id) {
                svgElement = svg.querySelector(`[id="${clickableEl.id}"]`);
                
                // Försök också utan namespace (t.ex "PS200:23345" → "23345")
                if (!svgElement && clickableEl.id.includes(':')) {
                    const simpleId = clickableEl.id.split(':').pop();
                    svgElement = svg.querySelector(`[id*="${simpleId}"]`);
                }
            }
            
            // 2. Om inget ID finns i JSON, försök hitta via filnamn
            if (!svgElement && clickableEl.name) {
                // Försök hitta element vars ID innehåller filnamnet
                const allElements = svg.querySelectorAll('[id]');
                svgElement = Array.from(allElements).find(el => {
                    const elId = el.getAttribute('id');
                    return elId && (
                        elId.includes(clickableEl.name) ||
                        clickableEl.name.includes(elId) ||
                        elId.toLowerCase().includes(clickableEl.name.toLowerCase())
                    );
                });
                
                if (svgElement) {
                    console.log(`Hittade element via filnamn-matchning: ${clickableEl.name} → ${svgElement.id}`);
                }
            }
            
            if (svgElement) {
                // Gör elementet klickbart
                svgElement.style.cursor = 'pointer';
                svgElement.style.transition = 'opacity 0.2s, filter 0.2s';
                
                // Lägg till visuell highlight
                const originalFill = svgElement.getAttribute('fill');
                const originalStroke = svgElement.getAttribute('stroke');
                
                svgElement.addEventListener('mouseenter', () => {
                    svgElement.style.opacity = '0.7';
                    svgElement.style.filter = 'brightness(1.2)';
                    // Lägg till blå outline för att visa att det är klickbart
                    svgElement.setAttribute('stroke', '#2563eb');
                    svgElement.setAttribute('stroke-width', '2');
                });
                
                svgElement.addEventListener('mouseleave', () => {
                    svgElement.style.opacity = '1';
                    svgElement.style.filter = 'none';
                    // Återställ original stroke
                    if (originalStroke) {
                        svgElement.setAttribute('stroke', originalStroke);
                    } else {
                        svgElement.removeAttribute('stroke');
                    }
                    svgElement.removeAttribute('stroke-width');
                });
                
                // Hantera enkelklick vs dubbelklick
                let clickTimer = null;
                
                svgElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    if (clickTimer === null) {
                        // Första klicket - vänta på eventuellt dubbelklick
                        clickTimer = setTimeout(() => {
                            // Enkelklick → Visa metadata
                            showElementMetadata(svgElement, clickableEl, node);
                            clickTimer = null;
                        }, 250); // 250ms delay för att detektera dubbelklick
                    } else {
                        // Dubbelklick detekterat
                        clearTimeout(clickTimer);
                        clickTimer = null;
                        // Dubbelklick → Navigera
                        handleSVGElementDoubleClick(svgElement, clickableEl, node);
                    }
                });
                
                console.log('Klickbart element aktiverat:', clickableEl.id, '→', clickableEl.name);
            }
        });
    } else {
        // Fallback: Gör alla element med ID klickbara
        console.warn('Inga clickable_elements i JSON - använder fallback (alla element med ID)');
        const allElements = svg.querySelectorAll('[id]');
        console.log(`Hittade ${allElements.length} element med ID i SVG`);
        
        allElements.forEach(element => {
            element.style.cursor = 'pointer';
            
            element.addEventListener('mouseenter', () => {
                element.style.opacity = '0.7';
                // Visa vilket element man hovrar över
                console.log('Hover på element:', element.id);
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.opacity = '1';
            });
            
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSVGElementClick(element, node);
            });
        });
    }
}

/**
 * Visa metadata för ett SVG-element (enkelklick)
 */
function showElementMetadata(svgElement, clickableElement, currentNode) {
    const elementId = svgElement.getAttribute('id');
    console.log('Visar metadata för:', elementId);
    
    // Uppdatera popup-titel
    elements.popupTitle.textContent = clickableElement.name || elementId || 'Block-information';
    
    // Bygg metadata-innehåll
    let html = '';
    
    // Grundläggande information
    html += '<div class="metadata-section">';
    html += '<h4>Grundläggande</h4>';
    html += `<div class="metadata-row">
        <span class="metadata-label">ID:</span>
        <span class="metadata-value">${elementId || 'N/A'}</span>
    </div>`;
    html += `<div class="metadata-row">
        <span class="metadata-label">Typ:</span>
        <span class="metadata-value">${clickableElement.metadata?.icon || 'SubSystemIcon_icon'}</span>
    </div>`;
    
    // Visa om det har undermoduler
    const hasChildren = currentNode.children && currentNode.children.some(child => 
        child.name === clickableElement.name || child.svg_element_id === clickableElement.id
    );
    html += `<div class="metadata-row">
        <span class="metadata-label">Undermoduler:</span>
        <span class="metadata-value">${hasChildren ? '✅ Ja (dubbelklicka för att öppna)' : '❌ Nej'}</span>
    </div>`;
    html += '</div>';
    
    // Metadata från JSON
    if (clickableElement.metadata) {
        const metadata = clickableElement.metadata;
        
        // Position
        if (metadata.position) {
            html += '<div class="metadata-section">';
            html += '<h4>Position</h4>';
            if (metadata.position.x !== undefined) {
                html += `<div class="metadata-row">
                    <span class="metadata-label">X:</span>
                    <span class="metadata-value">${metadata.position.x}</span>
                </div>`;
            }
            if (metadata.position.y !== undefined) {
                html += `<div class="metadata-row">
                    <span class="metadata-label">Y:</span>
                    <span class="metadata-value">${metadata.position.y}</span>
                </div>`;
            }
            html += '</div>';
        }
        
        // Bounds/Size
        if (metadata.bounds) {
            html += '<div class="metadata-section">';
            html += '<h4>Storlek</h4>';
            if (metadata.bounds.width !== undefined) {
                html += `<div class="metadata-row">
                    <span class="metadata-label">Bredd:</span>
                    <span class="metadata-value">${metadata.bounds.width}</span>
                </div>`;
            }
            if (metadata.bounds.height !== undefined) {
                html += `<div class="metadata-row">
                    <span class="metadata-label">Höjd:</span>
                    <span class="metadata-value">${metadata.bounds.height}</span>
                </div>`;
            }
            html += '</div>';
        }
        
        // Parametrar (allt annat i metadata)
        const excludeKeys = ['icon', 'id', 'name', 'file', 'position', 'bounds'];
        const paramKeys = Object.keys(metadata).filter(key => !excludeKeys.includes(key));
        
        if (paramKeys.length > 0) {
            html += '<div class="metadata-section">';
            html += '<h4>Parametrar</h4>';
            paramKeys.forEach(key => {
                let value = metadata[key];
                // Formatera värdet
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
    
    // Om ingen metadata finns
    if (html === '') {
        html = '<p style="text-align: center; color: var(--text-secondary);">Ingen metadata tillgänglig för detta block.</p>';
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
 * Hantera dubbelklick på SVG-element (navigation)
 */
function handleSVGElementDoubleClick(svgElement, clickableElement, currentNode) {
    const elementId = svgElement.getAttribute('id');
    console.log('Dubbelklick - navigerar till:', elementId);
    
    // Stäng popup om den är öppen
    closeMetadataPopup();
    
    // Hitta matchande barn-nod
    const matchingChild = currentNode.children.find(child => 
        child.name === clickableElement.name || 
        child.svg_element_id === clickableElement.id
    );
    
    if (matchingChild) {
        console.log('Navigerar till:', matchingChild.name);
        loadNode(matchingChild);
        
        // Markera i trädet
        document.querySelectorAll('.tree-item').forEach(item => {
            if (item.textContent.includes(matchingChild.name)) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    } else {
        console.log('Ingen undermodul hittades för:', clickableElement.name);
        // Visa meddelande att det inte finns någon undermodul
        showError('Detta block har ingen undermodul att navigera till.');
    }
}

/**
 * Hantera klick på SVG-element (LEGACY - används i fallback)
 * Använder clickable_elements från JSON för att mappa SVG-ID till fil
 */
function handleSVGElementClick(element, currentNode) {
    const elementId = element.getAttribute('id');
    console.log('SVG-element klickat:', elementId);
    
    if (!elementId) {
        console.log('Element har inget ID');
        return;
    }
    
    // Använd clickable_elements mappning från JSON-metadata
    if (currentNode.clickable_elements && currentNode.clickable_elements.length > 0) {
        // Hitta matchande element i clickable_elements
        const clickableElement = currentNode.clickable_elements.find(ce => {
            // Exakt matchning på ID
            if (ce.id === elementId) return true;
            
            // Partial matchning (ID kan innehålla namespace, t.ex "PS200:23345")
            if (ce.id && elementId.includes(ce.id)) return true;
            if (elementId.includes(ce.id)) return true;
            
            // Matchning på filnamn
            if (ce.name && elementId.toLowerCase().includes(ce.name.toLowerCase())) return true;
            
            return false;
        });
        
        if (clickableElement) {
            console.log('Hittade klickbart element:', clickableElement);
            
            // Hitta motsvarande barn-nod
            const matchingChild = currentNode.children.find(child => 
                child.name === clickableElement.name || 
                child.svg_element_id === clickableElement.id
            );
            
            if (matchingChild) {
                console.log('Navigerar till:', matchingChild.name);
                loadNode(matchingChild);
                
                // Markera i trädet
                document.querySelectorAll('.tree-item').forEach(item => {
                    if (item.textContent.includes(matchingChild.name)) {
                        item.classList.add('active');
                        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else {
                        item.classList.remove('active');
                    }
                });
            } else {
                console.log('Fil finns inte för:', clickableElement.name);
            }
        } else {
            console.log('Inget klickbart element hittades för ID:', elementId);
        }
    } else {
        console.log('Inga klickbara element i denna nod');
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
    
    if (node.metadata) {
        html += `
            <div class="info-row">
                <span class="info-label">Metadata:</span> ✓ Tillgänglig
            </div>
        `;
    }
    
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
    
    // Rensa state
    state.currentVersion = null;
    state.currentProduct = null;
    state.navigationTree = null;
    state.currentNode = null;
}

/**
 * Visa huvudapplikationen
 */
function showMainApp() {
    elements.welcomeScreen.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
}

/**
 * Justera zoom
 */
function adjustZoom(factor) {
    state.zoomLevel *= factor;
    state.zoomLevel = Math.max(0.1, Math.min(state.zoomLevel, 5.0));
    applyZoom();
}

/**
 * Återställ zoom
 */
function resetZoom() {
    state.zoomLevel = 1.0;
    applyZoom();
}

/**
 * Anpassa till skärm
 */
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
    
    state.zoomLevel = Math.min(scaleX, scaleY) * 0.9; // 90% av max för padding
    applyZoom();
}

/**
 * Tillämpa zoom på SVG
 */
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
    // Förhindra genvägar när man skriver i input-fält
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
            // Stäng popup först om den är öppen
            if (!elements.metadataPopup.classList.contains('hidden')) {
                closeMetadataPopup();
            } else if (!elements.mainApp.classList.contains('hidden')) {
                showWelcomeScreen();
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
    alert(message); // Enkelt för nu, kan ersättas med bättre UI senare
}

// Exportera för debugging
window.appState = state;
window.appElements = elements;
