// تهيئة الخريطة
const map = L.map('map', {
    minZoom: 2,
    maxZoom: 12,
    zoomControl: false,
    preferCanvas: true,
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    wheelDebounceTime: 100,
    fadeAnimation: false,
    zoomAnimation: true,
    markerZoomAnimation: true,
    renderer: L.canvas({ padding: 0.5 })
}).setView([24.7136, 46.6753], 6);

// إضافة أزرار التحكم في التكبير
L.control.zoom({
    position: 'topright'
}).addTo(map);

// إضافة طبقة الخريطة الأساسية (بدون أسماء)
const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 12,
    minZoom: 2,
    attribution: '© OpenStreetMap, © CartoDB',
    crossOrigin: true,
    updateWhenIdle: true,
    keepBuffer: 4,
    tileSize: 512,
    zoomOffset: -1
}).addTo(map);

// تخزين البيانات في الذاكرة
let searchResults = [];
let markers = L.layerGroup();
let areaLabels = L.layerGroup();
let pointsLayer = L.layerGroup();

// تحسين أداء البحث
const searchInput = document.querySelector('.search-input');
const searchResultsContainer = document.querySelector('.search-results');
let searchTimeout;

// تحميل البيانات من ملف JSON
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        const areasLayer = L.layerGroup();

        // إضافة المناطق
        data.areas.forEach(area => {
            const polygon = L.polygon(area.coordinates, {
                color: '#2c5282',
                weight: 2.5,
                fillOpacity: 0,
                opacity: 0.9,
                smoothFactor: 2,
                lineCap: 'round',
                lineJoin: 'round',
                interactive: true
            }).addTo(areasLayer);

            // إضافة اسم المنطقة
            const bounds = polygon.getBounds();
            const center = bounds.getCenter();
            
            const areaPoint = L.circleMarker(center, {
                radius: 0,
                fillOpacity: 0,
                opacity: 0,
                interactive: false
            }).bindTooltip(area.name, {
                permanent: true,
                direction: 'center',
                className: 'area-label',
                offset: [0, 0]
            }).addTo(areaLabels);

            // إضافة للبحث
            searchResults.push({
                name: area.name,
                type: 'منطقة',
                coordinates: center,
                element: polygon,
                bounds: bounds
            });

            // إضافة تفاعل عند تحريك الماوس
            polygon.on({
                mouseover: () => {
                    polygon.setStyle({ weight: 3, opacity: 1 });
                },
                mouseout: () => {
                    polygon.setStyle({ weight: 2.5, opacity: 0.9 });
                }
            });
        });

        // دالة إضافة النقاط (المدن والمواقع)
        const addPoint = (item, type) => {
            const point = L.circleMarker(item.coordinates, {
                radius: type === 'city' ? 5 : 4,
                fillColor: type === 'city' ? '#2c5282' : '#c53030',
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 1,
                interactive: true
            }).addTo(pointsLayer);

            // إضافة التسمية
            const label = L.circleMarker(item.coordinates, {
                radius: 0,
                fillOpacity: 0,
                opacity: 0,
                interactive: false
            }).bindTooltip(`${item.name}${type === 'city' ? 
                '<div class="location-info">مدينة</div>' : 
                item.type === 'historical' ? '<div class="location-info">موقع تاريخي</div>' : 
                item.type === 'religious' ? '<div class="location-info">موقع ديني</div>' : 
                '<div class="location-info">معلم سياحي</div>'}`, {
                permanent: true,
                direction: 'top',
                className: 'location-label',
                offset: [0, -8]
            }).addTo(pointsLayer);

            // إضافة النافذة المنبثقة
            point.bindPopup(`
                <strong>${item.name}</strong><br>
                ${type === 'city' ? `عدد السكان: ${item.population.toLocaleString('ar-SA')}` : 
                 `النوع: ${item.type === 'historical' ? 'موقع تاريخي' : 
                          item.type === 'religious' ? 'موقع ديني' : 'معلم سياحي'}`}<br>
                <a href="${item.url}" target="_blank" rel="noopener noreferrer">عرض في خرائط Google</a>
            `);

            // إضافة للبحث
            searchResults.push({
                name: item.name,
                type: type === 'city' ? 'مدينة' : 'موقع',
                coordinates: item.coordinates,
                element: point
            });

            // إضافة تفاعل عند تحريك الماوس
            point.on({
                mouseover: () => {
                    point.setStyle({ radius: type === 'city' ? 6 : 5 });
                },
                mouseout: () => {
                    point.setStyle({ radius: type === 'city' ? 5 : 4 });
                }
            });
        };

        // إضافة المدن والمواقع
        data.cities.forEach(city => addPoint(city, 'city'));
        data.locations.forEach(location => addPoint(location, 'location'));

        // إضافة الطبقات للخريطة
        areasLayer.addTo(map);
        areaLabels.addTo(map);
        pointsLayer.remove();

        // تحديث الطبقات حسب مستوى التكبير
        const updateLayers = () => {
            const zoom = map.getZoom();
            if (zoom >= 8) {
                if (!map.hasLayer(pointsLayer)) {
                    areaLabels.remove();
                    pointsLayer.addTo(map);
                }
            } else {
                if (!map.hasLayer(areaLabels)) {
                    pointsLayer.remove();
                    areaLabels.addTo(map);
                }
            }
        };

        // تحديث الطبقات عند تغيير مستوى التكبير
        map.on('zoomend', updateLayers);
        updateLayers();

        // تحسين البحث
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const searchTerm = e.target.value.trim();
            
            searchTimeout = setTimeout(() => {
                if (searchTerm.length < 2) {
                    searchResultsContainer.style.display = 'none';
                    return;
                }

                const filteredResults = searchResults
                    .filter(item => 
                        item.name.includes(searchTerm) || 
                        item.type.includes(searchTerm)
                    )
                    .slice(0, 8);

                searchResultsContainer.innerHTML = '';
                
                if (filteredResults.length > 0) {
                    filteredResults.forEach(result => {
                        const div = document.createElement('div');
                        div.className = 'search-result-item';
                        div.setAttribute('role', 'option');
                        div.innerHTML = `${result.name} (${result.type})`;
                        div.addEventListener('click', () => {
                            if (result.bounds) {
                                map.fitBounds(result.bounds, { padding: [50, 50] });
                            } else {
                                map.setView(result.coordinates, 9);
                            }
                            result.element.openPopup();
                            searchResultsContainer.style.display = 'none';
                            searchInput.value = '';
                            searchInput.blur();
                        });
                        searchResultsContainer.appendChild(div);
                    });
                    searchResultsContainer.style.display = 'block';
                } else {
                    searchResultsContainer.style.display = 'none';
                }
            }, 150);
        });

        // إخفاء نتائج البحث عند النقر خارج القائمة
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.search-container')) {
                searchResultsContainer.style.display = 'none';
            }
        });
    })
    .catch(error => console.error('خطأ في تحميل بيانات الخريطة:', error));
