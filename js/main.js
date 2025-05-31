// --- Global Variables ---
let network = null;
let nodesDataset = new vis.DataSet();
let edgesDataset = new vis.DataSet();

// --- DOM Element References ---
const loadingGraphEl = document.getElementById('loading-graph');
const networkContainer = document.getElementById('mynetwork');
const selectionInfoEl = document.getElementById('selection-info');
const detailsContentEl = document.getElementById('details-content');
const detailsImageEl = document.getElementById('details-image');
const detailsTitleEl = document.getElementById('details-title');
const detailsTextEl = document.getElementById('details-text');
const relatedListEl = document.getElementById('related-list');
const evidenceListEl = document.getElementById('evidence-list');

// Define cluster configurations
const clusterConfigs = {
    'political-chain': {
      nodes: ['ja','vax','biontech','bmgf','mg','pv'],
      radius: 250,
      title: 'Jacinda Ardern Cluster',
      shortDescription:
        'How Melinda Gates, Jacinda Ardern, BioNTech, and vaccine revenues form a closed loop.',
      description:
        'This network cluster shows how a small group of people and organizations are connected in promoting and profiting from the Pfizer-BioNTech COVID-19 vaccine. At the center is Melinda Gates, who owns both Pivotal Ventures and the Bill & Melinda Gates Foundation. Pivotal Ventures provides funding to Jacinda Ardern, the Prime Minister of New Zealand. Ardern, in turn, promotes the Pfizer-BioNTech vaccine. That vaccine was invented by BioNTech, a company partly owned by the Gates Foundation, and revenue from vaccine sales flows back into BioNTech and ultimately benefits the Bill & Melinda Gates Foundation. In other words, there is a loop of ownership (Gates Foundation → BioNTech), invention (BioNTech → vaccine), promotion (Ardern → vaccine), and funding (Pivotal Ventures → Ardern), with profits cycling back to the Foundation.',
      path: []
    },
  
    'research-chain': {
      nodes: ['sw','vax','biontech','bmgf','itbc'],
      radius: 250,
      title: 'Siouxsie Wiles Cluster',
      shortDescription:
        'How an older TB consortium grant to Siouxsie Wiles links back to Gates ownership of BioNTech and vaccine profits.',
      description:
        'This network cluster illustrates a chain of connections leading from the Bill & Melinda Gates Foundation to the promotion and profit of the Pfizer-BioNTech COVID-19 vaccine. At the bottom, the Bill & Melinda Gates Foundation owns BioNTech. BioNTech invented the Pfizer-BioNTech vaccine, and revenue from vaccine sales flows back into BioNTech and ultimately benefits the Foundation. On the left, more than a decade ago the Foundation also funded the Imaging TB Consortium; that consortium in turn funded Siouxsie Wiles. Wiles has since promoted the Pfizer-BioNTech vaccine. In other words, there is a loop of ownership (Gates Foundation → BioNTech), invention (BioNTech → vaccine), promotion (Wiles → vaccine), and historical funding (Foundation → TB Consortium → Wiles), with profits cycling back to the Foundation. Note that the Imaging TB Consortium relationship is older and therefore less directly tied to the current vaccine‐promotion activities.',
      path: []
    },
  
    'advisory-chain': {
      nodes: ['hph','vax','biontech','bmgf','gvdn'],
      radius: 250,
      title: 'Helen Petousis-Harris Cluster',
      shortDescription:
        'How Gates funding of GVDN and Petousis-Harris’s analyses feed into promoting and profiting from BioNTech’s vaccine.',
      description:
        'This network cluster shows how the Bill & Melinda Gates Foundation’s funding and ownership tie into the promotion and revenue flow of the Pfizer-BioNTech COVID-19 vaccine. At the bottom, the Foundation owns a stake in BioNTech, which invented the Pfizer-BioNTech vaccine; revenue from vaccine sales flows back into BioNTech and ultimately benefits the Foundation. On the left, the Foundation also funds the Global Vaccine Data Network (GVDN). The GVDN conducts analyses of the Pfizer-BioNTech vaccine and is directed by Helen Petousis-Harris. Petousis-Harris uses her role at the GVDN to publicly promote the Pfizer-BioNTech vaccine. In other words, Foundation funding supports both BioNTech (through ownership) and the GVDN’s vaccine analyses, and those analyses and endorsements by Petousis-Harris help drive vaccine promotion—while vaccine revenues cycle back to benefit the Foundation.',
      path: []
    }
  };
  

/**
 * Initialize: Load data and setup visualization
 */
async function initializeDashboard() {
    loadingGraphEl.style.display = 'block';
    networkContainer.style.opacity = '0.3';

    try {
        // Load both CSV files
        const [nodes, edges] = await Promise.all([
            loadCSV('Nodes.csv'),
            loadCSV('Edges.csv')
        ]);

        // Process nodes and edges
        nodes.forEach(node => {
            // Parse EvidenceData if it exists
            if (node.EvidenceData) {
                try {
                    node.EvidenceData = JSON.parse(node.EvidenceData);
                } catch (e) {
                    console.warn(`Could not parse EvidenceData for node ${node.ID}:`, e);
                    node.EvidenceData = [];
                }
            } else {
                node.EvidenceData = [];
            }
            
            // Add required vis.js properties
            node.id = node.ID;  // vis.js requires 'id' property
            node.label = node.Label || node.ID;
            
            // Ensure Details is properly set
            if (node.Details) {
                node.Details = node.Details.trim();
            }
        });

        edges.forEach(edge => {
            // Parse EvidenceData if it exists
            if (edge.EvidenceData) {
                try {
                    console.log(`Processing edge ${edge.ID} evidence:`, edge.EvidenceData);
                    edge.EvidenceData = JSON.parse(edge.EvidenceData);
                    console.log(`Parsed evidence for edge ${edge.ID}:`, edge.EvidenceData);
                } catch (e) {
                    console.warn(`Could not parse EvidenceData for edge ${edge.ID}:`, e);
                    edge.EvidenceData = [];
                }
            } else {
                console.log(`No evidence data for edge ${edge.ID}`);
                edge.EvidenceData = [];
            }
            
            // Add required vis.js properties
            edge.id = edge.ID;      // vis.js requires 'id' property
            edge.from = edge.From;   // vis.js requires 'from' property
            edge.to = edge.To;       // vis.js requires 'to' property
            edge.label = edge.Label || '';  // vis.js uses 'label' property
            
            // Ensure Details is properly set
            if (edge.Details) {
                edge.Details = edge.Details.trim();
            }
        });

        // Add to vis.js datasets
        nodesDataset.clear();
        edgesDataset.clear();
        nodesDataset.add(nodes);
        edgesDataset.add(edges);

        // Draw the network
        drawGraph();

        // Hide loading indicator
        loadingGraphEl.style.display = 'none';
        networkContainer.style.opacity = 1;

    } catch (error) {
        console.error('Error initializing dashboard:', error);
        loadingGraphEl.textContent = 'Error loading data: ' + error.message;
        loadingGraphEl.style.color = 'red';
    }
}

/**
 * Load and parse CSV file using PapaParse
 */
function loadCSV(filename) {
    // Add cache-busting parameter
    const cacheBuster = `?_=${new Date().getTime()}`;
    return new Promise((resolve, reject) => {
        Papa.parse(filename + cacheBuster, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: results => resolve(results.data),
            error: error => reject(error)
        });
    });
}

/**
 * Draw Network Graph using vis.js
 */
function drawGraph() {
    const container = document.getElementById('mynetwork');
    
    const data = {
        nodes: nodesDataset,
        edges: edgesDataset
    };

    const options = {
        nodes: {
            shape: 'dot',
            size: 20,
            font: {
                size: 12,
                color: '#333'
            },
            borderWidth: 2,
            color: {
                background: '#97C2FC',
                border: '#2B7CE9',
                highlight: {
                    background: '#D2E5FF',
                    border: '#2B7CE9'
                }
            }
        },
        edges: {
            width: 1.5,
            color: {
                color: '#2B7CE9',
                highlight: '#000000',
                hover: '#848484'
            },
            font: {
                size: 11,
                align: 'middle',
                color: '#333',
                strokeWidth: 2,
                strokeColor: '#ffffff',
                background: '#ffffff'
            },
            arrows: {
                to: {
                    enabled: true,
                    scaleFactor: 0.7
                }
            },
            smooth: {
                enabled: true,
                type: 'continuous',
                roundness: 0.2
            }
        },
        physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
                gravitationalConstant: -1000,
                centralGravity: 0.005,
                springLength: 200,
                springConstant: 0.04,
                damping: 0.85,
                avoidOverlap: 1
            },
            stabilization: {
                enabled: true,
                iterations: 1000,
                updateInterval: 25,
                onlyDynamicEdges: false,
                fit: true
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 200,
            hideEdgesOnDrag: false,
            navigationButtons: true,
            keyboard: true,
            zoomView: true,
            dragNodes: true,
            dragView: true
        }
    };

    network = new vis.Network(container, data, options);

    // Disable physics after stabilization
    network.on("stabilizationIterationsDone", function () {
        network.setOptions({ physics: { enabled: false } });
    });

    // Re-enable physics temporarily when dragging nodes
    network.on("dragStart", function () {
        network.setOptions({ physics: { enabled: true } });
    });

    network.on("dragEnd", function () {
        // Wait a short moment for the node to settle, then disable physics again
        setTimeout(() => {
            network.setOptions({ physics: { enabled: false } });
        }, 1000);
    });

    // Click handler
    network.on("click", function(params) {
        params.event = "[original event]";
        console.log('Click event:', params);
        
        let selectedId = null;
        let selectedType = null;
        let selectedData = null;

        if (params.nodes.length > 0) {
            selectedId = params.nodes[0];
            selectedType = 'Node';
            selectedData = nodesDataset.get(selectedId);
        } else if (params.edges.length > 0) {
            selectedId = params.edges[0];
            selectedType = 'Edge';
            selectedData = edgesDataset.get(selectedId);
        }

        if (selectedData) {
            resetDetailsPanel();
            updateDetailsPanel(selectedData, selectedType);
            network.unselectAll();
            if (selectedType === 'Node') {
                network.selectNodes([selectedId]);
            } else if (selectedType === 'Edge') {
                network.selectEdges([selectedId]);
            }
        } else {
            // Reset view when clicking empty space
            resetView();
            resetDetailsPanel(true);
            network.unselectAll();
        }
    });
}

/**
 * Reset Details Panel
 */
function resetDetailsPanel(showDefaultMessage = false) {
    // Remove any existing navigation
    const existingNav = detailsContentEl.querySelector('.cluster-navigation');
    if (existingNav) {
        existingNav.remove();
    }

    // Remove any existing overview section
    const existingOverview = detailsContentEl.querySelector('.overview-section');
    if (existingOverview) {
        existingOverview.remove();
    }

    if (showDefaultMessage) {
        detailsTitleEl.textContent = 'COVID-19 Incentive Network';
        detailsTextEl.textContent = 'This network visualizes key relationships between organizations, individuals, and events related to COVID-19 vaccine development and distribution in New Zealand.';
        detailsContentEl.querySelector('p').style.display = 'block';
        
        // Hide the right column
        document.getElementById('details-right-col').style.display = 'none';
        
        // Show highlighted clusters in main content area
        document.getElementById('details-evidence').style.display = 'block';
        document.querySelector('#details-evidence h4').textContent = 'Highlighted Clusters';
        evidenceListEl.innerHTML = '';
        
        // Add cluster links
        Object.entries(clusterConfigs).forEach(([clusterId, config]) => {
            if (clusterId === 'reset') return;
            
            const div = document.createElement('div');
            div.classList.add('related-item');
            div.style.marginBottom = '20px';  // Add more space between clusters
            
            const link = document.createElement('a');
            link.href = '#';
            link.setAttribute('data-cluster', clusterId);
            link.textContent = config.title;
            
            const label = document.createElement('div');  // Changed to div for block display
            label.classList.add('related-label');
            label.style.marginTop = '5px';  // Add space between title and description
            label.style.display = 'block';  // Make description appear on new line
            // Remove leading phrases and make description more concise
            let description = config.shortDescription
                .replace(/^Shows (how |the )?|^Demonstrates |^Illustrates |Shows the |Demonstrates the |Illustrates the /, '')
                .replace(/^relationship |^connection |^pathway /, '');
            label.textContent = shortDescription;
            
            div.appendChild(link);
            div.appendChild(label);
            evidenceListEl.appendChild(div);
        });
        
        // Reinitialize cluster button handlers
        initializeClusterButtons();
    } else {
        detailsTitleEl.textContent = '';
        detailsTextEl.textContent = '';
        detailsContentEl.querySelector('p').style.display = 'none';
        document.getElementById('details-right-col').style.display = 'block';
        document.getElementById('details-evidence').style.display = 'block';
        document.querySelector('#details-evidence h4').textContent = 'Evidence';
        relatedListEl.innerHTML = '';
        evidenceListEl.innerHTML = '';
    }
    
    detailsImageEl.style.display = 'none';
    detailsImageEl.src = '';
}

/**
 * Update Details Panel with selected item data
 */
function updateDetailsPanel(itemData, itemType) {
    resetDetailsPanel();
    detailsContentEl.style.display = 'flex';

    // Set title and text
    detailsTitleEl.textContent = itemData.Label || itemData.ID;
    detailsTextEl.textContent = itemData.Details || '(No description provided)';
    detailsContentEl.querySelector('p').style.display = 'block';  // Make sure the paragraph is visible

    // Handle image for nodes
    if (itemType === 'Node' && itemData.ImageUrl) {
        detailsImageEl.src = itemData.ImageUrl;
        detailsImageEl.style.display = 'block';
        detailsImageEl.onerror = () => {
            console.warn("Could not load image:", itemData.ImageUrl);
            detailsImageEl.style.display = 'none';
        };
    }

    // Show right column with related items
    document.getElementById('details-right-col').style.display = 'block';

    // Show related items
    populateRelatedItems(itemData, itemType);

    // Only show the "Evidence" title + images if evidence actually exists.
    const detailsEvidenceContainer = document.getElementById('details-evidence');
    const evidenceHeading = detailsEvidenceContainer.querySelector('h4');

    // Clear out any previous evidence items
    evidenceListEl.innerHTML = '';

    if (
        itemData.EvidenceData &&
        Array.isArray(itemData.EvidenceData) &&
        itemData.EvidenceData.length > 0
    ) {
        // Show the evidence container and set its heading
        detailsEvidenceContainer.style.display = 'block';
        evidenceHeading.textContent = 'Evidence';

        // Populate the list
        displayEvidence(itemData.EvidenceData);
    } else {
        // Hide the entire evidence section (including the <h4>)
        detailsEvidenceContainer.style.display = 'none';
    }


    // Remove any existing overview section if it exists
    const existingOverview = detailsContentEl.querySelector('.overview-section');
    if (existingOverview) {
        existingOverview.remove();
    }
}

/**
 * Populate Related Items section
 */
function populateRelatedItems(itemData, itemType) {
    relatedListEl.innerHTML = '';
    let relatedFound = false;

    if (itemType === 'Node') {
        // Find all edges connected to this node
        const nodeId = itemData.ID;
        const connectedEdges = edgesDataset.get().filter(edge => 
            edge.From === nodeId || edge.To === nodeId
        );

        connectedEdges.forEach(edge => {
            const otherNodeId = edge.From === nodeId ? edge.To : edge.From;
            const otherNode = nodesDataset.get(otherNodeId);
            if (otherNode) {
                relatedFound = true;
                const div = document.createElement('div');
                div.classList.add('related-item');
                const direction = edge.From === nodeId ? '→' : '←';
                const relationText = edge.Label ? `(${edge.Label})` : '';
                div.innerHTML = `
                    <a href="#" data-type="Node" data-id="${otherNodeId}" 
                       title="View: ${otherNode.Label || otherNodeId}">
                        ${otherNode.Label || otherNodeId}
                    </a>
                    <span class="related-label">${direction} ${relationText}</span>
                `;
                relatedListEl.appendChild(div);
            }
        });
    } else if (itemType === 'Edge') {
        // Show connected nodes
        const fromNode = nodesDataset.get(itemData.From);
        const toNode = nodesDataset.get(itemData.To);

        if (fromNode) {
            relatedFound = true;
            const div = document.createElement('div');
            div.classList.add('related-item');
            div.innerHTML = `From: <a href="#" data-type="Node" data-id="${fromNode.ID}" 
                            title="View: ${fromNode.Label || fromNode.ID}">
                            ${fromNode.Label || fromNode.ID}</a>`;
            relatedListEl.appendChild(div);
        }

        if (toNode) {
            relatedFound = true;
            const div = document.createElement('div');
            div.classList.add('related-item');
            div.innerHTML = `To: <a href="#" data-type="Node" data-id="${toNode.ID}" 
                           title="View: ${toNode.Label || toNode.ID}">
                           ${toNode.Label || toNode.ID}</a>`;
            relatedListEl.appendChild(div);
        }
    }

    if (!relatedFound) {
        relatedListEl.innerHTML = '<i>No direct connections found.</i>';
    }

    // Add click handlers for related items
    relatedListEl.querySelectorAll('a[data-id]').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const itemId = event.target.getAttribute('data-id');
            const itemType = event.target.getAttribute('data-type');
            
            let itemData;
            if (itemType === 'Node') {
                itemData = nodesDataset.get(itemId);
                if (itemData) {
                    updateDetailsPanel(itemData, itemType);
                    network.unselectAll();
                    network.selectNodes([itemId]);
                    network.focus(itemId, { scale: 1.2, animation: true });
                }
            }
        });
    });
}

/**
 * Display Evidence items
 */
function displayEvidence(evidenceArray) {
    evidenceListEl.innerHTML = '';
    
    if (!evidenceArray || evidenceArray.length === 0) {
        evidenceListEl.innerHTML = '<i></i>';
        return;
    }

    evidenceArray.forEach((evidence, index) => {
        // Check for either evidenceUrl or localPath
        const evidencePath = evidence.localPath || evidence.evidenceUrl;
        if (!evidencePath) return;

        const itemDiv = document.createElement('div');
        itemDiv.classList.add('evidence-item');

        // Create image container
        const imgContainer = document.createElement('div');
        imgContainer.style.marginBottom = '20px';
        
        // Add image
        const img = document.createElement('img');
        // Handle the path - use localPath if available, otherwise use evidenceUrl
        const imagePath = evidencePath.startsWith('http') ? 
            evidencePath : 
            evidencePath.replace(/^\//, '').replace(/\\/g, '/');  // Replace backslashes with forward slashes
            
        img.src = imagePath;
        img.alt = `Evidence ${index + 1}`;
        img.style.display = 'block';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        
        // Add error handling with more details
        img.onerror = () => {
            console.warn('Failed to load image:', imagePath);
            img.style.display = 'none';
            const errorText = document.createElement('div');
            errorText.style.color = 'red';
            errorText.style.marginBottom = '10px';
            errorText.innerHTML = `Unable to load image:<br>Path: ${imagePath}`;
            imgContainer.insertBefore(errorText, img);
        };
        
        imgContainer.appendChild(img);
        
        // Add source link below the image
        if (evidence.sourceUrl) {
            const sourceLink = document.createElement('a');
            sourceLink.href = evidence.sourceUrl;
            sourceLink.target = '_blank';
            sourceLink.className = 'source-link';
            sourceLink.textContent = evidence.sourceLabel || '(View Source)';
            imgContainer.appendChild(sourceLink);
        }
        
        itemDiv.appendChild(imgContainer);

        // Add separator between evidence items
        if (index < evidenceArray.length - 1) {
            const separator = document.createElement('hr');
            separator.style.margin = '15px 0';
            separator.style.border = 'none';
            separator.style.borderBottom = '1px solid #eee';
            itemDiv.appendChild(separator);
        }

        evidenceListEl.appendChild(itemDiv);
    });
}

/**
 * Arrange nodes in a circle
 */
function arrangeNodesInCircle(nodeIds, radius = 200) {
    const centerX = 0;
    const centerY = 0;

    // First, remove any existing center node
    try {
        nodesDataset.remove('center');
    } catch (e) {}

    // Reset all nodes to default state and release fixed positions
    nodesDataset.get().forEach(node => {
        node.fixed = false;
        node.x = undefined;
        node.y = undefined;
        node.color = {
            background: '#97C2FC',
            border: '#2B7CE9'
        };
        nodesDataset.update(node);
    });

    // Reset all edges to default state
    edgesDataset.get().forEach(edge => {
        edge.color = { color: '#2B7CE9', highlight: '#000000' };
        edge.width = 1;
        edge.smooth = {
            enabled: true,
            type: 'continuous',
            roundness: 0.2
        };
        edgesDataset.update(edge);
    });

    // Enable physics briefly to reset positions
    network.setOptions({ physics: { enabled: true } });

    // Add invisible center node to force edge routing
    const centerNode = {
        id: 'center',
        label: '',
        size: radius * 0.8,
        color: {
            background: 'rgba(0,0,0,0)',
            border: 'rgba(0,0,0,0)'
        },
        fixed: true,
        x: 0,
        y: 0,
        physics: false,
        hidden: true
    };
    nodesDataset.add(centerNode);

    // Arrange specified nodes in a circle
    nodeIds.forEach((nodeId, index) => {
        const angle = (2 * Math.PI * index) / nodeIds.length - Math.PI/2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        const node = nodesDataset.get(nodeId);
        if (node) {
            node.x = x;
            node.y = y;
            node.fixed = true;
            node.color = {
                background: '#ffeb3b',
                border: '#fbc02d'
            };
            nodesDataset.update(node);
        }
    });

    // Update edge settings for the cluster
    edgesDataset.get().forEach(edge => {
        const isRelevant = nodeIds.includes(edge.from) && nodeIds.includes(edge.to);
        if (isRelevant) {
            edge.color = { color: '#fbc02d', highlight: '#f57f17' };
            edge.width = 2;
            edge.smooth = {
                enabled: true,
                type: 'curvedCCW',
                roundness: 0.2
            };
        }
        edgesDataset.update(edge);
    });

    // Focus and stabilize
    network.fit({
        nodes: nodeIds,
        animation: {
            duration: 1000,
            easingFunction: 'easeInOutQuad'
        }
    });

    // Disable physics after a brief stabilization period
    setTimeout(() => {
        network.setOptions({ physics: { enabled: false } });
    }, 1500);
}

/**
 * Reset the network view
 */
function resetView() {
    // Remove center node if it exists
    try {
        nodesDataset.remove('center');
    } catch (e) {}

    // Reset all nodes to default state
    nodesDataset.get().forEach(node => {
        node.fixed = false;
        node.x = undefined;
        node.y = undefined;
        node.color = {
            background: '#97C2FC',
            border: '#2B7CE9'
        };
        nodesDataset.update(node);
    });

    // Reset edge colors and settings
    edgesDataset.get().forEach(edge => {
        edge.color = { color: '#2B7CE9', highlight: '#000000' };
        edge.width = 1.5;
        edge.smooth = {
            enabled: true,
            type: 'continuous',
            roundness: 0.2
        };
        edgesDataset.update(edge);
    });

    // Enable physics briefly to reorganize
    network.setOptions({ physics: { enabled: true } });

    // Reset the view with animation
    network.fit({
        animation: {
            duration: 1000,
            easingFunction: 'easeInOutQuad'
        }
    });

    // Disable physics after stabilization
    setTimeout(() => {
        network.setOptions({ physics: { enabled: false } });
    }, 1500);
}

/**
 * Build the complete path for a cluster including edges
 */
function buildClusterPath(clusterId) {
    const config = clusterConfigs[clusterId];
    if (!config) return;

    const path = [];
    const nodes = config.nodes;

    // Build the path including edges
    for (let i = 0; i < nodes.length; i++) {  // Now go through all nodes
        const currentNode = nodes[i];
        path.push({ type: 'Node', id: currentNode });

        // Find edge to next node (or back to first node if we're at the last node)
        const nextNode = i < nodes.length - 1 ? nodes[i + 1] : nodes[0];
        const edge = edgesDataset.get().find(e => 
            (e.from === currentNode && e.to === nextNode) ||
            (e.to === currentNode && e.from === nextNode)
        );

        if (edge) {
            path.push({ type: 'Edge', id: edge.id });
        }
    }

    config.path = path;
    return path;
}

/**
 * Display cluster details in the right panel
 */
function displayClusterDetails(clusterId) {
    const config = clusterConfigs[clusterId];
    if (!config) return;

    // Build the complete path if not already built
    if (!config.path.length) {
        buildClusterPath(clusterId);
    }

    // Remove any existing navigation
    const existingNav = detailsContentEl.querySelector('.cluster-navigation');
    if (existingNav) {
        existingNav.remove();
    }

    resetDetailsPanel();
    detailsContentEl.style.display = 'flex';
    detailsContentEl.querySelector('p').style.display = 'none';

    // Set title and description
    detailsTitleEl.textContent = config.title;
    detailsTextEl.textContent = config.Description;

    // Add overview description
    const overviewDiv = document.createElement('div');
    overviewDiv.classList.add('overview-section');  // Add class for identification
    overviewDiv.style.marginTop = '20px';
    overviewDiv.style.marginBottom = '20px';
    // Show the cluster description again, then the generic message
    overviewDiv.innerHTML = `
        <div style="margin-bottom: 8px;">${config.Description}</div>
        <p style="color: #666; margin-bottom: 10px;"</p>
    `;
    detailsTextEl.parentNode.insertBefore(overviewDiv, detailsTextEl.nextSibling);

    // Create explore section right after description
    const exploreDiv = document.createElement('div');
    exploreDiv.classList.add('explore-section');
    exploreDiv.style.marginTop = '15px';
    
    const exploreLink = document.createElement('a');
    exploreLink.href = '#';
    exploreLink.textContent = 'Start Exploring';
    exploreLink.style.color = '#0066cc';
    exploreLink.style.textDecoration = 'none';
    exploreLink.setAttribute('data-cluster-explore', 'true');
    exploreLink.setAttribute('data-cluster', clusterId);
    exploreLink.setAttribute('data-path-index', '0');
    
    exploreDiv.appendChild(exploreLink);
    
    // Insert explore section after overview description
    overviewDiv.appendChild(exploreDiv);

    // Hide evidence section and related items for cluster overview
    document.getElementById('details-evidence').style.display = 'none';
    document.getElementById('details-related').style.display = 'none';

    // Add click handler
    exploreLink.addEventListener('click', (event) => {
        event.preventDefault();
        document.getElementById('details-evidence').style.display = 'block'; // Show evidence section when exploring
        document.getElementById('details-related').style.display = 'block'; // Show related items when exploring
        exploreClusterItem(clusterId, 0);
    });
}

/**
 * Explore a specific item (node or edge) in the cluster
 */
function exploreClusterItem(clusterId, pathIndex) {
    const config = clusterConfigs[clusterId];
    if (!config || !config.path || pathIndex >= config.path.length) return;

    const item = config.path[pathIndex];
    const itemData = item.type === 'Node' ? 
        nodesDataset.get(item.id) : 
        edgesDataset.get(item.id);

    if (!itemData) return;

    // Update details panel with item info
    updateDetailsPanel(itemData, item.type);

    // Remove any existing navigation
    const existingNav = detailsContentEl.querySelector('.cluster-navigation');
    if (existingNav) {
        existingNav.remove();
    }

    // Remove any existing overview/explore section
    const existingOverview = detailsContentEl.querySelector('.overview-section');
    if (existingOverview) {
        existingOverview.remove();
    }

    // Add navigation controls at the top
    const navDiv = document.createElement('div');
    navDiv.classList.add('cluster-navigation');
    navDiv.style.marginBottom = '15px';

    // Back to cluster overview
    const overviewLink = document.createElement('a');
    overviewLink.href = '#';
    overviewLink.textContent = '← Back to Cluster Overview';
    overviewLink.style.marginRight = '15px';
    overviewLink.addEventListener('click', (event) => {
        event.preventDefault();
        displayClusterDetails(clusterId);
    });
    navDiv.appendChild(overviewLink);

    // Add step indicator
    const stepText = document.createElement('span');
    stepText.textContent = `Step ${pathIndex + 1} of ${config.path.length}`;
    stepText.style.color = '#666';
    navDiv.appendChild(stepText);

    // Navigation buttons - now circular
    const prevLink = document.createElement('a');
    prevLink.href = '#';
    prevLink.textContent = '← Previous';
    prevLink.style.marginLeft = '15px';
    prevLink.addEventListener('click', (event) => {
        event.preventDefault();
        const prevIndex = pathIndex > 0 ? pathIndex - 1 : config.path.length - 1;
        exploreClusterItem(clusterId, prevIndex);
    });
    navDiv.appendChild(prevLink);

    const nextLink = document.createElement('a');
    nextLink.href = '#';
    nextLink.textContent = 'Next →';
    nextLink.style.marginLeft = '15px';
    nextLink.addEventListener('click', (event) => {
        event.preventDefault();
        const nextIndex = (pathIndex + 1) % config.path.length;
        exploreClusterItem(clusterId, nextIndex);
    });
    navDiv.appendChild(nextLink);

    // Insert navigation at the top of the content
    detailsContentEl.insertBefore(navDiv, detailsContentEl.firstChild);

    // Focus on the current item
    network.unselectAll();
    if (item.type === 'Node') {
        network.selectNodes([item.id]);
        network.focus(item.id, { scale: 1.2, animation: true });
    } else {
        network.selectEdges([item.id]);
        // For edges, focus on both connected nodes
        const edge = edgesDataset.get(item.id);
        network.fit({
            nodes: [edge.from, edge.to],
            animation: true
        });
    }
}

/**
 * Initialize cluster buttons
 */
function initializeClusterButtons() {
    document.querySelectorAll('a[data-cluster]').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const clusterId = link.getAttribute('data-cluster');
            if (clusterId === 'reset') {
                resetView();
                resetDetailsPanel(true);
            } else {
                const config = clusterConfigs[clusterId];
                if (config) {
                    arrangeNodesInCircle(config.nodes, config.radius);
                    displayClusterDetails(clusterId);
                }
            }
        });
    });
}

// Add to initialization
window.addEventListener('load', () => {
    // Clear any cached data
    nodesDataset.clear();
    edgesDataset.clear();
    localStorage.clear();  // Clear any local storage data
    
    initializeDashboard().then(() => {
        // Show default view with clusters immediately after initialization
        resetDetailsPanel(true);
    });
    initializeClusterButtons();
}); 