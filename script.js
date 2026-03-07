// ============================================
// SMART WASTE MANAGEMENT - WITH REAL ROAD ROUTING
// ============================================

const CONFIG = {
    thingSpeak: {
        channelID: "2904419",
        readAPI: "5BRL63QZR7CJ8P3W"
    },
    alertThreshold: 90,
    updateInterval: 15000,
    location: {
        center: [30.7333, 76.7794],
        zoom: 13
    },
    depot: {
        name: "Depot (Start)",
        lat: 30.7333,
        lng: 76.7794,
        type: "depot"
    },
    disposal: {
        name: "Disposal Yard (End)",
        lat: 30.7100,
        lng: 76.8200,
        type: "disposal"
    }
};

// 10 BINS ACROSS CHANDIGARH
const BINS_DATA = [
    { name: "A", lat: 30.7410, lng: 76.7694, fill: 0, temp: 0, humidity: 0 },
    { name: "B", lat: 30.7300, lng: 76.7900, fill: 92.0, temp: 30.0, humidity: 65 },
    { name: "C", lat: 30.7200, lng: 76.7800, fill: 40.0, temp: 26.0, humidity: 60 },
    { name: "D", lat: 30.7150, lng: 76.7650, fill: 95.0, temp: 32.0, humidity: 70 },
    { name: "E", lat: 30.7500, lng: 76.8000, fill: 88.5, temp: 28.0, humidity: 68 },
    { name: "F", lat: 30.7550, lng: 76.7500, fill: 35.0, temp: 25.0, humidity: 62 },
    { name: "G", lat: 30.7100, lng: 76.7400, fill: 91.2, temp: 31.0, humidity: 72 },
    { name: "H", lat: 30.7450, lng: 76.7350, fill: 45.5, temp: 27.0, humidity: 59 },
    { name: "I", lat: 30.7000, lng: 76.7950, fill: 93.8, temp: 29.5, humidity: 66 },
    { name: "J", lat: 30.7600, lng: 76.8100, fill: 52.0, temp: 26.5, humidity: 61 }
];

let map;
let truck;
let truckPath = [];
let truckIndex = 0;
let sensorChart;
let routePolylines = [];

// ============================================
// 1. INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🗑️ Smart Waste Management System - REAL ROAD ROUTING');
    console.log('📊 Total Bins: 10 (A-J)');
    console.log('🔴 Full Bins (>90%): B, D, E, G, I');
    
    initializeMap();
    initializeChart();
    
    fetchThingSpeakData();
    setInterval(fetchThingSpeakData, CONFIG.updateInterval);
});

// ============================================
// 2. FETCH DATA FROM THINGSPEAK
// ============================================
function fetchThingSpeakData() {
    const url = `https://api.thingspeak.com/channels/${CONFIG.thingSpeak.channelID}/feeds.json?api_key=${CONFIG.thingSpeak.readAPI}&results=1`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.feeds && data.feeds.length > 0) {
                const feed = data.feeds[data.feeds.length - 1];
                
                const sensorData = {
                    fill: parseFloat(feed.field2) || 0,
                    humidity: parseFloat(feed.field6) || 0,
                    temperature: parseFloat(feed.field7) || 0,
                    lid: parseInt(feed.field8) || 0,
                    timestamp: feed.created_at
                };
                
                BINS_DATA[0].fill = sensorData.fill;
                BINS_DATA[0].humidity = sensorData.humidity;
                BINS_DATA[0].temp = sensorData.temperature;
                
                console.log('✅ Bin A Updated:', sensorData);
                
                updateDashboard(sensorData);
                updateBinTable();
                updateChart(sensorData);
                checkAlerts(sensorData);
                updateStatistics();
                updateMapMarkers();
                calculateOptimalRoute();
            }
        })
        .catch(error => console.error('❌ Error:', error));
}

// ============================================
// 3. UPDATE DASHBOARD
// ============================================
function updateDashboard(sensorData) {
    const { temperature, fill, lid, humidity } = sensorData;
    
    document.getElementById("temperature").textContent = temperature.toFixed(1) + " °C";
    document.getElementById("humidity").textContent = humidity.toFixed(1) + " %";
    document.getElementById("fillPercent").textContent = fill.toFixed(2) + " %";
    
    const fillBar = document.getElementById("fillBar");
    if (fillBar) {
        fillBar.style.width = fill + "%";
        
        if (fill < 50) {
            fillBar.style.background = "linear-gradient(90deg, #00ff9d, #00c3ff)";
        } else if (fill < 90) {
            fillBar.style.background = "linear-gradient(90deg, #ffb347, #ffa500)";
        } else {
            fillBar.style.background = "linear-gradient(90deg, #ff6b6b, #ff4d4d)";
        }
    }
    
    const lidStatusElement = document.getElementById("lidStatus");
    if (lidStatusElement) {
        lidStatusElement.textContent = lid == 1 ? "🔓 Open" : "🔒 Closed";
        lidStatusElement.style.color = lid == 1 ? "red" : "green";
    }
    
    const distanceElement = document.getElementById("distance");
    if (distanceElement) {
        distanceElement.parentElement.style.display = "none";
    }
}

// ============================================
// 4. UPDATE BIN TABLE
// ============================================
function updateBinTable() {
    BINS_DATA.forEach(bin => {
        const fillElement = document.getElementById('bin' + bin.name);
        const statusElement = document.getElementById('status' + bin.name);
        const tempElement = document.getElementById('temp' + bin.name);
        
        if (fillElement) fillElement.textContent = bin.fill.toFixed(2) + '%';
        
        if (statusElement) {
            if (bin.fill >= CONFIG.alertThreshold) {
                statusElement.textContent = '🔴 FULL';
                statusElement.className = 'full';
            } else if (bin.fill >= 60) {
                statusElement.textContent = '🟡 Medium';
                statusElement.className = 'medium';
            } else {
                statusElement.textContent = '🟢 Normal';
                statusElement.className = 'normal';
            }
        }
        
        if (tempElement) tempElement.textContent = bin.temp.toFixed(1) + '°C';
    });
}

// ============================================
// 5. CHECK ALERTS
// ============================================
function checkAlerts(sensorData) {
    const alertBox = document.getElementById("alertBox");
    const fullBins = BINS_DATA.filter(b => b.fill >= CONFIG.alertThreshold);
    
    if (fullBins.length > 0) {
        const binNames = fullBins.map(b => `Bin ${b.name}`).join(', ');
        alertBox.innerHTML = `🚨 ALERT: ${binNames} - IMMEDIATE COLLECTION REQUIRED!`;
        alertBox.style.display = "block";
        alertBox.style.backgroundColor = "rgba(255, 77, 77, 0.3)";
        alertBox.style.borderLeft = "5px solid #ff4d4d";
        playAlertSound();
    } else {
        alertBox.style.display = "none";
    }
}

function playAlertSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.log('Audio skipped');
    }
}

// ============================================
// 6. INITIALIZE MAP
// ============================================
function initializeMap() {
    map = L.map('map').setView(CONFIG.location.center, CONFIG.location.zoom);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // DEPOT MARKER
    const depotIcon = L.divIcon({
        html: `<div style="
            background: linear-gradient(135deg, #FFD700, #FFA500);
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            border: 3px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        ">🏢</div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
        popupAnchor: [0, -30]
    });
    
    L.marker([CONFIG.depot.lat, CONFIG.depot.lng], { icon: depotIcon })
        .addTo(map)
        .bindPopup(`<b>📍 ${CONFIG.depot.name}</b><br>Collection Starts Here`);
    
    // DISPOSAL YARD MARKER
    const disposalIcon = L.divIcon({
        html: `<div style="
            background: linear-gradient(135deg, #FF6B6B, #FF4444);
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            border: 3px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        ">🏭</div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
        popupAnchor: [0, -30]
    });
    
    L.marker([CONFIG.disposal.lat, CONFIG.disposal.lng], { icon: disposalIcon })
        .addTo(map)
        .bindPopup(`<b>🏭 ${CONFIG.disposal.name}</b><br>Disposal Ends Here`);
    
    // GARBAGE TRUCK
    const truckIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/743/743131.png',
        iconSize: [45, 45],
        popupAnchor: [0, -25]
    });
    
    truck = L.marker([CONFIG.depot.lat, CONFIG.depot.lng], { icon: truckIcon })
        .addTo(map)
        .bindPopup('<b>🚛 Garbage Collection Truck</b>');
    
    updateMapMarkers();
}

// ============================================
// 7. UPDATE MAP MARKERS
// ============================================
function updateMapMarkers() {
    map.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) {
            map.removeLayer(layer);
        }
    });
    
    BINS_DATA.forEach(bin => {
        let color = "green";
        let radius = 10;
        
        if (bin.fill >= CONFIG.alertThreshold) {
            color = "red";
            radius = 14;
        } else if (bin.fill >= 60) {
            color = "orange";
            radius = 12;
        }
        
        L.circleMarker([bin.lat, bin.lng], {
            color: color,
            radius: radius,
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.7
        }).addTo(map).bindPopup(
            `<b>Bin ${bin.name}</b><br>Fill: ${bin.fill.toFixed(2)}%<br>Temp: ${bin.temp.toFixed(1)}°C<br>Status: ${bin.fill >= CONFIG.alertThreshold ? '🔴 FULL' : '🟢 OK'}`
        );
    });
}

// ============================================
// 8. CALCULATE OPTIMAL ROUTE WITH REAL ROADS
// ============================================
async function calculateOptimalRoute() {
    const fullBins = BINS_DATA.filter(b => b.fill >= CONFIG.alertThreshold);
    
    if (fullBins.length === 0) {
        document.getElementById("routeText").innerHTML = 
            '<span style="color: green; font-weight: bold;">✅ All bins normal - No collection needed</span>';
        document.getElementById("routeStats").innerHTML = '';
        return;
    }
    
    const depot = CONFIG.depot;
    const disposal = CONFIG.disposal;
    
    // TSP to find optimal order
    const tspRoute = tspNearestNeighbor(depot, fullBins);
    
    let routeNames = tspRoute.map((node, i) => `${i + 1}. Bin ${node.name}`).join(' → ');
    
    document.getElementById("routeText").innerHTML = 
        `<strong>📍 Calculating Optimal Route:</strong> Depot → ${routeNames} → Disposal Yard`;
    
    // Get real road distances
    try {
        const distances = await calculateRealRoadDistances(depot, tspRoute, disposal);
        
        const totalDistance = distances.total;
        const estimatedTime = calculateCollectionTime(tspRoute, distances);
        
        document.getElementById("routeText").innerHTML = 
            `<strong>📍 Optimal Route:</strong> Depot → ${routeNames} → Disposal Yard<br>
             <strong style="color: #00ff9d;">📏 Road Distance:</strong> ${totalDistance.toFixed(2)} km`;
        
        document.getElementById("routeStats").innerHTML = 
            `<strong>🚛 Depot to Bins:</strong> ${distances.depotToBins.toFixed(2)} km | 
             <strong>🏭 Last Bin to Disposal:</strong> ${distances.binsToDisposal.toFixed(2)} km | 
             <strong>⏱️ Estimated Time:</strong> ${estimatedTime.toFixed(0)} minutes | 
             <strong>📦 Bins to Collect:</strong> ${fullBins.length}`;
        
        // Draw route using OSRM
        await drawRealRoadRoute(depot, tspRoute, disposal);
        
        // Set truck path
        truckPath = [depot, ...tspRoute, disposal].map(node => [node.lat, node.lng]);
        startTruckTracking();
    } catch (error) {
        console.error('Error calculating route:', error);
        document.getElementById("routeStats").innerHTML = 
            '<span style="color: orange;">⚠️ Using straight-line route</span>';
        
        // Fallback to straight line
        drawStraightRoute(depot, tspRoute, disposal);
        truckPath = [depot, ...tspRoute, disposal].map(node => [node.lat, node.lng]);
        startTruckTracking();
    }
}

// ============================================
// 9. CALCULATE REAL ROAD DISTANCES (OSRM)
// ============================================
async function calculateRealRoadDistances(depot, route, disposal) {
    const locations = [depot, ...route, disposal];
    const coords = locations.map(loc => `${loc.lng},${loc.lat}`).join(';');
    
    try {
        // Use OSRM (Open Source Routing Machine)
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`
        );
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const totalDistance = data.routes[0].distance / 1000; // Convert to km
            
            // Estimate partial distances
            const depotToBinsDistance = (data.routes[0].distance * 0.7) / 1000;
            const binsToDisposalDistance = (data.routes[0].distance * 0.3) / 1000;
            
            return {
                total: totalDistance,
                depotToBins: depotToBinsDistance,
                binsToDisposal: binsToDisposalDistance
            };
        }
    } catch (error) {
        console.error('OSRM Error:', error);
        // Fallback to straight line distance
        return calculateStraightLineDistance(depot, route, disposal);
    }
}

// ============================================
// 10. DRAW REAL ROAD ROUTE (OSRM)
// ============================================
async function drawRealRoadRoute(depot, route, disposal) {
    // Clear old routes
    routePolylines.forEach(polyline => map.removeLayer(polyline));
    routePolylines = [];
    
    const locations = [depot, ...route, disposal];
    const coords = locations.map(loc => `${loc.lng},${loc.lat}`).join(';');
    
    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const routeCoords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            const polyline = L.polyline(routeCoords, {
                color: 'purple',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 5'
            }).addTo(map);
            
            routePolylines.push(polyline);
            console.log('✅ Real road route drawn');
        }
    } catch (error) {
        console.error('Error drawing route:', error);
        drawStraightRoute(depot, route, disposal);
    }
}

// ============================================
// 11. FALLBACK: STRAIGHT ROUTE
// ============================================
function drawStraightRoute(depot, route, disposal) {
    routePolylines.forEach(polyline => map.removeLayer(polyline));
    routePolylines = [];
    
    const routeCoords = [
        [depot.lat, depot.lng],
        ...route.map(bin => [bin.lat, bin.lng]),
        [disposal.lat, disposal.lng]
    ];
    
    const polyline = L.polyline(routeCoords, {
        color: 'red',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 5'
    }).addTo(map);
    
    routePolylines.push(polyline);
}

// ============================================
// 12. STRAIGHT LINE DISTANCE (Fallback)
// ============================================
function calculateStraightLineDistance(depot, route, disposal) {
    const depotToBins = calculateTotalStraightDistance([depot, ...route]);
    const binsToDisposal = calculateDistance(route[route.length - 1], disposal);
    
    return {
        total: depotToBins + binsToDisposal,
        depotToBins: depotToBins,
        binsToDisposal: binsToDisposal
    };
}

// ============================================
// 13. TSP ALGORITHM
// ============================================
function tspNearestNeighbor(start, nodes) {
    let route = [];
    let remaining = [...nodes];
    let current = start;
    
    while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDist = Infinity;
        
        for (let i = 0; i < remaining.length; i++) {
            let dist = calculateDistance(current, remaining[i]);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIndex = i;
            }
        }
        
        let next = remaining.splice(nearestIndex, 1)[0];
        route.push(next);
        current = next;
    }
    
    return route;
}

// ============================================
// 14. DISTANCE CALCULATIONS
// ============================================
function calculateDistance(loc1, loc2) {
    const R = 6371;
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateTotalStraightDistance(route) {
    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
        totalDistance += calculateDistance(route[i], route[i+1]);
    }
    return totalDistance;
}

function calculateCollectionTime(route, distances) {
    const avgSpeed = 30;
    const timePerBin = 5;
    const travelTime = (distances.total / avgSpeed) * 60;
    return travelTime + (route.length * timePerBin);
}

// ============================================
// 15. TRUCK TRACKING
// ============================================
function startTruckTracking() {
    truckIndex = 0;
    if (window.truckInterval) clearInterval(window.truckInterval);
    
    window.truckInterval = setInterval(function() {
        if (truckIndex < truckPath.length) {
            truck.setLatLng(truckPath[truckIndex]);
            map.panTo(truckPath[truckIndex]);
            truckIndex++;
        } else {
            clearInterval(window.truckInterval);
            truck.setLatLng([CONFIG.depot.lat, CONFIG.depot.lng]);
        }
    }, 1500);
}

// ============================================
// 16. CHART
// ============================================
function initializeChart() {
    const ctx = document.getElementById('sensorChart').getContext('2d');
    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Fill Level (%)', data: [], borderColor: '#00c3ff', fill: true, yAxisID: 'y' },
                { label: 'Temperature (°C)', data: [], borderColor: '#ff6b6b', fill: true, yAxisID: 'y1' },
                { label: 'Humidity (%)', data: [], borderColor: '#00ff9d', fill: true, yAxisID: 'y' }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { min: 0, max: 100 },
                y1: { position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    });
}

function updateChart(sensorData) {
    const now = new Date().toLocaleTimeString();
    
    if (sensorChart.data.labels.length > 12) {
        sensorChart.data.labels.shift();
        sensorChart.data.datasets.forEach(ds => ds.data.shift());
    }
    
    sensorChart.data.labels.push(now);
    sensorChart.data.datasets[0].data.push(sensorData.fill.toFixed(2));
    sensorChart.data.datasets[1].data.push(sensorData.temperature.toFixed(1));
    sensorChart.data.datasets[2].data.push(sensorData.humidity.toFixed(1));
    
    sensorChart.update('none');
}

// ============================================
// 17. STATISTICS
// ============================================
function updateStatistics() {
    const fullBins = BINS_DATA.filter(b => b.fill >= CONFIG.alertThreshold);
    const avgFill = (BINS_DATA.reduce((sum, b) => sum + b.fill, 0) / BINS_DATA.length).toFixed(2);
    
    document.getElementById('totalBins').textContent = BINS_DATA.length;
    document.getElementById('binsNeedingCollection').textContent = fullBins.length;
    document.getElementById('avgFill').textContent = avgFill + '%';
    
    const statusElement = document.getElementById('collectionStatus');
    if (fullBins.length > 0) {
        statusElement.textContent = `🚛 ${fullBins.length} Bins Need Collection`;
        statusElement.style.color = '#ff6b6b';
    } else {
        statusElement.textContent = '✅ All Bins Normal';
        statusElement.style.color = '#00ff9d';
    }
}

// Initialize
setTimeout(() => {
    ensureBinTableRows();
    updateMapMarkers();
    calculateOptimalRoute();
}, 1000);

function ensureBinTableRows() {
    const table = document.querySelector('.bins table tbody');
    if (!table) return;
    
    const existingRows = table.querySelectorAll('tr').length;
    
    for (let i = existingRows; i < BINS_DATA.length; i++) {
        const bin = BINS_DATA[i];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>Bin ${bin.name}</td>
            <td id="bin${bin.name}">${bin.fill}%</td>
            <td id="status${bin.name}">Normal</td>
            <td id="temp${bin.name}">${bin.temp}°C</td>
        `;
        table.appendChild(row);
    }
}

console.log('✅ Smart Waste System - REAL ROAD ROUTING ACTIVE');